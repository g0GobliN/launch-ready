import { formatDistanceToNow } from "date-fns";
import { getServiceRoleClient } from "./supabase.server";
import { PLANS, type PlanId, planAllows } from "./plans";

export interface UserPlanData {
  plan: PlanId;
  balance: number;
  aiCreditsTotal: number;
  monthlyScanLimit: number;
  monthlyScanUsed: number;
  currentPeriodEnd: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  reason: string;
  type: string;
  jobId: string | null;
  when: string;
}

async function ensurePlanRow(login: string): Promise<void> {
  const db = getServiceRoleClient();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db.from("user_credits").upsert(
    {
      github_login: login,
      balance: 0,
      plan: "free",
      monthly_scan_limit: PLANS.free.scansPerMonth,
      monthly_scan_used: 0,
      ai_credits_total: 0,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    },
    { onConflict: "github_login", ignoreDuplicates: true },
  );
}

async function checkAndResetPeriod(login: string): Promise<void> {
  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("current_period_end, plan, ai_credits_total")
    .eq("github_login", login)
    .single();
  if (!data || Date.now() <= new Date(data.current_period_end).getTime()) return;

  const plan = PLANS[(data.plan as PlanId) ?? "free"];
  const now = new Date();
  const newEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db
    .from("user_credits")
    .update({
      monthly_scan_used: 0,
      balance: plan.aiCreditsPerMonth,
      ai_credits_total: plan.aiCreditsPerMonth,
      current_period_start: now.toISOString(),
      current_period_end: newEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("github_login", login);

  if (plan.aiCreditsPerMonth > 0) {
    await db.from("credit_transactions").insert({
      id: crypto.randomUUID(),
      github_login: login,
      amount: plan.aiCreditsPerMonth,
      reason: "Monthly credit reset",
      type: "reset",
    });
  }
}

export async function getUserPlanData(login: string): Promise<UserPlanData> {
  await ensurePlanRow(login);
  await checkAndResetPeriod(login);
  const db = getServiceRoleClient();
  const { data } = await db.from("user_credits").select("*").eq("github_login", login).single();
  if (!data) {
    return {
      plan: "free",
      balance: 0,
      aiCreditsTotal: 0,
      monthlyScanLimit: 3,
      monthlyScanUsed: 0,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    };
  }
  return {
    plan: data.plan as PlanId,
    balance: data.balance,
    aiCreditsTotal: data.ai_credits_total,
    monthlyScanLimit: data.monthly_scan_limit,
    monthlyScanUsed: data.monthly_scan_used,
    currentPeriodEnd: data.current_period_end,
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
  };
}

export async function checkScanLimit(login: string): Promise<void> {
  const d = await getUserPlanData(login);
  if (d.monthlyScanUsed >= d.monthlyScanLimit) {
    throw new Error(`LIMIT:scan:${d.plan}:${d.monthlyScanUsed}/${d.monthlyScanLimit}`);
  }
}

export async function incrementScanUsed(login: string): Promise<void> {
  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("monthly_scan_used")
    .eq("github_login", login)
    .single();
  if (data) {
    await db
      .from("user_credits")
      .update({
        monthly_scan_used: data.monthly_scan_used + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("github_login", login);
  }
}

export async function checkRepoLimit(login: string): Promise<void> {
  await ensurePlanRow(login);
  const db = getServiceRoleClient();
  const { data: planRow } = await db
    .from("user_credits")
    .select("plan")
    .eq("github_login", login)
    .single();
  const plan = PLANS[(planRow?.plan as PlanId) ?? "free"];
  const { count } = await db
    .from("repos")
    .select("*", { count: "exact", head: true })
    .eq("owner", login);
  if ((count ?? 0) >= plan.repos) {
    throw new Error(`LIMIT:repo:${plan.id}:${count}/${plan.repos}`);
  }
}

export async function checkPlanFeature(login: string, minPlan: PlanId): Promise<void> {
  const d = await getUserPlanData(login);
  if (!planAllows(d.plan, minPlan)) {
    throw new Error(`LIMIT:plan:${d.plan}:requires_${minPlan}`);
  }
}

export async function getCreditBalance(login: string): Promise<number> {
  await ensurePlanRow(login);
  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("balance")
    .eq("github_login", login)
    .single();
  return data?.balance ?? 0;
}

export async function deductCredits(login: string, amount: number, jobId: string): Promise<void> {
  if (amount === 0) return;
  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("balance")
    .eq("github_login", login)
    .single();
  if (!data || data.balance < amount)
    throw new Error("Insufficient AI credits. Please upgrade your plan.");
  await db
    .from("user_credits")
    .update({ balance: data.balance - amount, updated_at: new Date().toISOString() })
    .eq("github_login", login);
  await db.from("credit_transactions").insert({
    id: crypto.randomUUID(),
    github_login: login,
    amount: -amount,
    reason: "Fix job deduction",
    type: "usage",
    job_id: jobId,
  });
}

export async function refundCredits(login: string, amount: number, jobId: string): Promise<void> {
  if (amount === 0) return;
  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("balance")
    .eq("github_login", login)
    .single();
  if (!data) return;
  await db
    .from("user_credits")
    .update({ balance: data.balance + amount, updated_at: new Date().toISOString() })
    .eq("github_login", login);
  await db.from("credit_transactions").insert({
    id: crypto.randomUUID(),
    github_login: login,
    amount,
    reason: "Refund for failed job",
    type: "refund",
    job_id: jobId,
  });
}

export async function getCreditHistory(login: string): Promise<CreditTransaction[]> {
  const db = getServiceRoleClient();
  const { data } = await db
    .from("credit_transactions")
    .select("id, amount, reason, type, job_id, created_at")
    .eq("github_login", login)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => ({
    id: r.id,
    amount: r.amount,
    reason: r.reason,
    type: r.type,
    jobId: r.job_id,
    when: formatDistanceToNow(new Date(r.created_at), { addSuffix: true }),
  }));
}
