import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  estimateAiCost,
  planRevenuePerCredit,
  activeAiProvider,
  aiCostPerCredit,
} from "../ai-economics.server";
import { isAdminUser, isBootstrapAdmin } from "../admin.server";
import { PLANS, type PlanId } from "../plans";

async function requireAdmin(login: string | undefined) {
  if (!login || !(await isAdminUser(login))) throw new Error("Forbidden");
}

function lastNDays(n: number) {
  const days: { date: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      date: d.toISOString().split("T")[0],
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }
  return days;
}

export const checkAdminFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  await requireAdmin(getStoredUser()?.login);
  return { ok: true };
});

export const loadAdminOverviewFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().default(30) }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    await requireAdmin(getStoredUser()?.login);

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [{ data: users }, { data: allScans }, { data: allJobs }] = await Promise.all([
      db.from("user_credits").select("plan, created_at"),
      db.from("scans").select("id, created_at").gte("created_at", since),
      db.from("fix_requests").select("id, status, created_at").gte("created_at", since),
    ]);

    const days = lastNDays(data.days);
    const signupsByDay = days.map(({ date, label }) => ({
      date: label,
      signups: (users ?? []).filter((u) => u.created_at.startsWith(date)).length,
    }));
    const scansByDay = days.map(({ date, label }) => ({
      date: label,
      scans: (allScans ?? []).filter((s) => s.created_at.startsWith(date)).length,
    }));
    const jobsByDay = days.map(({ date, label }) => ({
      date: label,
      jobs: (allJobs ?? []).filter((j) => j.created_at.startsWith(date)).length,
    }));

    const planDist = (["free", "starter", "pro", "agency"] as const).map((planId) => ({
      plan: PLANS[planId].name,
      count: (users ?? []).filter((u) => u.plan === planId).length,
      color: { free: "#6b7280", starter: "#22c55e", pro: "#3b82f6", agency: "#f59e0b" }[planId],
    }));

    const totalUsers = users?.length ?? 0;
    const paidUsers = (users ?? []).filter((u) => u.plan !== "free").length;
    const mrr = (users ?? []).reduce(
      (sum, u) => sum + (PLANS[u.plan as keyof typeof PLANS]?.priceUsd ?? 0),
      0,
    );
    const scansThisMonth = (allScans ?? []).filter((s) => s.created_at >= monthStart).length;
    const jobsThisMonth = (allJobs ?? []).filter((j) => j.created_at >= monthStart).length;
    const completedJobs = (allJobs ?? []).filter((j) => j.status === "completed").length;
    const failedJobs = (allJobs ?? []).filter((j) => j.status === "failed").length;

    return {
      charts: { signupsByDay, scansByDay, jobsByDay, planDist },
      stats: {
        totalUsers,
        paidUsers,
        mrr,
        scansThisMonth,
        jobsThisMonth,
        completedJobs,
        failedJobs,
        conversionRate: totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0,
      },
    };
  });

export const loadAdminEconomicsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  await requireAdmin(getStoredUser()?.login);

  const { getServiceRoleClient } = await import("../supabase.server");
  const db = getServiceRoleClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ data: users }, { data: usageTxns }] = await Promise.all([
    db.from("user_credits").select("plan, balance, ai_credits_total"),
    db
      .from("credit_transactions")
      .select("github_login, amount")
      .eq("type", "usage")
      .gte("created_at", monthStart),
  ]);

  const mrr = (users ?? []).reduce(
    (sum, u) => sum + (PLANS[u.plan as keyof typeof PLANS]?.priceUsd ?? 0),
    0,
  );
  const aiCreditsUsedMonth = (usageTxns ?? []).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const estAiCost = estimateAiCost(aiCreditsUsedMonth);
  const estMargin = Math.round((mrr - estAiCost) * 100) / 100;
  const heavyUsers = (users ?? []).filter((u) => {
    if (u.plan === "free" || u.ai_credits_total <= 0) return false;
    const used = u.ai_credits_total - u.balance;
    return used / u.ai_credits_total >= 0.8;
  }).length;

  const planEconomics = (["starter", "pro", "agency"] as const).map((planId) => {
    const count = (users ?? []).filter((u) => u.plan === planId).length;
    const plan = PLANS[planId];
    const maxCost = estimateAiCost(plan.aiCreditsPerMonth);
    return {
      plan: plan.name,
      users: count,
      mrr: count * plan.priceUsd,
      credits: plan.aiCreditsPerMonth,
      maxCost,
      marginIfMaxed: Math.round((plan.priceUsd - maxCost) * 100) / 100,
      revPerCredit: Math.round(planRevenuePerCredit(planId) * 100) / 100,
    };
  });

  return {
    stats: {
      mrr,
      aiCreditsUsedMonth,
      estAiCost,
      estMargin,
      heavyUsers,
      costPerCredit: aiCostPerCredit(),
      aiProvider: activeAiProvider(),
    },
    planEconomics,
  };
});

export const loadAdminUsersFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      page: z.number().default(1),
      search: z.string().default(""),
      plan: z.string().default("all"),
    }),
  )
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    await requireAdmin(getStoredUser()?.login);

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();

    const pageSize = 20;
    const from = (data.page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = db
      .from("user_credits")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.search) query = query.ilike("github_login", `%${data.search}%`);
    if (data.plan !== "all") query = query.eq("plan", data.plan);
    query = query.range(from, to);

    const { data: users, count } = await query;

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const logins = (users ?? []).map((u) => u.github_login);
    const usageByLogin: Record<string, number> = {};
    if (logins.length > 0) {
      const { data: txns } = await db
        .from("credit_transactions")
        .select("github_login, amount")
        .eq("type", "usage")
        .gte("created_at", monthStart)
        .in("github_login", logins);
      for (const t of txns ?? []) {
        usageByLogin[t.github_login] = (usageByLogin[t.github_login] ?? 0) + Math.abs(t.amount);
      }
    }

    const enriched = (users ?? []).map((u) => {
      const used = usageByLogin[u.github_login] ?? 0;
      const total = u.ai_credits_total ?? 0;
      const planId = (u.plan as PlanId) ?? "free";
      return {
        ...u,
        isBootstrapAdmin: isBootstrapAdmin(u.github_login),
        aiUsedMonth: used,
        aiUsagePct: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0,
        estCostMonth: estimateAiCost(used),
        revPerCredit: planRevenuePerCredit(planId),
      };
    });

    return { users: enriched, total: count ?? 0, page: data.page, pageSize };
  });

export const loadAdminJobsFn = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      page: z.number().default(1),
      status: z.string().default("all"),
      search: z.string().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    await requireAdmin(getStoredUser()?.login);

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();

    const pageSize = 20;
    const from = (data.page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = db
      .from("fix_requests")
      .select("id, owner_login, status, credits_cost, created_at, repos(name)", { count: "exact" })
      .order("created_at", { ascending: false });
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.search) query = query.ilike("owner_login", `%${data.search}%`);
    query = query.range(from, to);

    const { data: jobs, count } = await query;
    return { jobs: jobs ?? [], total: count ?? 0, page: data.page, pageSize };
  });

function monthsSinceFirstSignup(earliestCreatedAt: string | null, now = new Date()): number {
  if (!earliestCreatedAt) return 1;
  const first = new Date(earliestCreatedAt);
  return (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1;
}

export const loadAdminRevenueFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ months: z.number().default(24) }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    await requireAdmin(getStoredUser()?.login);

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();

    const { data: users } = await db.from("user_credits").select("plan, created_at");

    const planRevenue = (["starter", "pro", "agency"] as const).map((planId) => {
      const count = (users ?? []).filter((u) => u.plan === planId).length;
      return {
        plan: PLANS[planId].name,
        users: count,
        mrr: count * PLANS[planId].priceUsd,
        color: { starter: "#22c55e", pro: "#3b82f6", agency: "#f59e0b" }[planId],
      };
    });

    const mrr = planRevenue.reduce((s, p) => s + p.mrr, 0);
    const arr = mrr * 12;

    // Build month-by-month detail for the selected window
    type MonthRow = {
      month: string;
      isoMonth: string;
      newPaidUsers: number;
      totalPaidUsers: number;
      newMrr: number;
      totalMrr: number;
      momGrowth: number | null;
    };
    const mrrByMonth: { month: string; mrr: number }[] = [];
    const monthlyDetail: MonthRow[] = [];

    const earliestCreatedAt =
      users && users.length > 0
        ? users.reduce((min, u) => (u.created_at < min ? u.created_at : min), users[0].created_at)
        : null;
    const historyMonths = monthsSinceFirstSignup(earliestCreatedAt);
    const monthsToShow = Math.min(data.months, historyMonths);
    const ledgerCapped = historyMonths > data.months;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const isoMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const newPaid = (users ?? []).filter(
        (u) => u.plan !== "free" && u.created_at >= start && u.created_at <= end,
      );
      const cumulativePaid = (users ?? []).filter((u) => u.plan !== "free" && u.created_at <= end);
      const newMrr = newPaid.reduce(
        (s, u) => s + (PLANS[u.plan as keyof typeof PLANS]?.priceUsd ?? 0),
        0,
      );
      const totalMrr = cumulativePaid.reduce(
        (s, u) => s + (PLANS[u.plan as keyof typeof PLANS]?.priceUsd ?? 0),
        0,
      );

      mrrByMonth.push({ month: label, mrr: totalMrr });
      monthlyDetail.push({
        month: label,
        isoMonth,
        newPaidUsers: newPaid.length,
        totalPaidUsers: cumulativePaid.length,
        newMrr,
        totalMrr,
        momGrowth: null,
      });
    }

    // Compute MoM growth
    for (let i = 1; i < monthlyDetail.length; i++) {
      const prev = monthlyDetail[i - 1].totalMrr;
      const curr = monthlyDetail[i].totalMrr;
      monthlyDetail[i].momGrowth =
        prev > 0 ? Math.round(((curr - prev) / prev) * 100) : curr > 0 ? 100 : 0;
    }

    return { mrr, arr, planRevenue, mrrByMonth, monthlyDetail, ledgerCapped };
  });

export const runPromotionFn = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      plan: z.string(),
      type: z.enum(["bonus_credits", "reset_scans"]),
      amount: z.number().int().positive().optional(),
      note: z.string().default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    await requireAdmin(getStoredUser()?.login);

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();

    let query = db
      .from("user_credits")
      .select("github_login, balance, ai_credits_total")
      .neq("plan", "free");
    if (data.plan !== "all") query = (query as typeof query).eq("plan", data.plan);
    const { data: users } = await query;
    if (!users?.length) return { affected: 0 };

    if (data.type === "bonus_credits") {
      const amount = data.amount ?? 0;
      for (const user of users) {
        await db
          .from("user_credits")
          .update({
            balance: user.balance + amount,
            ai_credits_total: user.ai_credits_total + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("github_login", user.github_login);
        await db.from("credit_transactions").insert({
          id: crypto.randomUUID(),
          github_login: user.github_login,
          amount,
          reason: data.note || "Promotional bonus",
          type: "grant",
        });
      }
    } else if (data.type === "reset_scans") {
      const logins = users.map((u) => u.github_login);
      await db
        .from("user_credits")
        .update({ monthly_scan_used: 0, updated_at: new Date().toISOString() })
        .in("github_login", logins);
    }

    return { affected: users.length };
  });

export const grantAdminCreditsFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ githubLogin: z.string(), amount: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    await requireAdmin(getStoredUser()?.login);

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();

    const { data: row } = await db
      .from("user_credits")
      .select("balance, ai_credits_total")
      .eq("github_login", data.githubLogin)
      .single();
    if (!row) throw new Error("User not found");

    await db
      .from("user_credits")
      .update({
        balance: row.balance + data.amount,
        ai_credits_total: row.ai_credits_total + data.amount,
        updated_at: new Date().toISOString(),
      })
      .eq("github_login", data.githubLogin);

    await db.from("credit_transactions").insert({
      id: crypto.randomUUID(),
      github_login: data.githubLogin,
      amount: data.amount,
      reason: "Admin grant",
      type: "grant",
    });

    return { ok: true };
  });

export const toggleAdminFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ githubLogin: z.string(), makeAdmin: z.boolean() }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    const caller = getStoredUser();
    await requireAdmin(caller?.login);
    // Prevent revoking your own admin
    if (caller?.login === data.githubLogin && !data.makeAdmin)
      throw new Error("You cannot revoke your own admin access.");

    const { getServiceRoleClient } = await import("../supabase.server");
    const db = getServiceRoleClient();
    const { error } = await db
      .from("user_credits")
      .update({ is_admin: data.makeAdmin, updated_at: new Date().toISOString() })
      .eq("github_login", data.githubLogin);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
