import { createFileRoute } from "@tanstack/react-router";
import { loadAdminRevenueFn } from "@/lib/api/admin.functions";
import { PLANS } from "@/lib/plans";
import { TrendingUp, DollarSign, Calendar, Minus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useState } from "react";

export const Route = createFileRoute("/admin/revenue")({
  head: () => ({ meta: [{ title: "Revenue — Admin" }] }),
  loader: () => loadAdminRevenueFn({ data: { months: 36 } }),
  component: AdminRevenue,
});

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
  fontSize: 13,
};

const TICK = { fontSize: 12, fill: "#94a3b8" };
const GRID_COLOR = "rgba(148,163,184,0.15)";
const MONTH_OPTIONS = [12, 24, 36] as const;
const LEDGER_PAGE_SIZE = 12;

const PAID_PLAN_IDS = ["starter", "pro", "agency"] as const;
type PaidPlanId = typeof PAID_PLAN_IDS[number];

const PLAN_COLORS: Record<PaidPlanId, string> = { starter: "#22c55e", pro: "#3b82f6", agency: "#f59e0b" };
const RANK_LABELS = ["1st", "2nd", "3rd"];

function sparseMonths(data: { month: string }[], months: number) {
  const interval = months <= 12 ? 1 : months <= 24 ? 2 : 3;
  return data.map((d, i) => ({ ...d, displayMonth: i % interval === 0 ? d.month : "" }));
}

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (value === 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> 0%</span>
  );
  return value > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-400"><ChevronUp className="h-3.5 w-3.5" />+{value}%</span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-400"><ChevronDown className="h-3.5 w-3.5" />{value}%</span>
  );
}

function AdminRevenue() {
  const { mrr, arr, planRevenue, mrrByMonth, monthlyDetail } = Route.useLoaderData();
  const [chartMonths, setChartMonths] = useState<12 | 24 | 36>(12);
  const [sortDesc, setSortDesc] = useState(true);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [ledgerPage, setLedgerPage] = useState(1);

  // Plan performance ranked by MRR
  const rankedPlans = [...planRevenue].sort((a, b) => b.mrr - a.mrr);
  const totalMrr = planRevenue.reduce((s, p) => s + p.mrr, 0);
  const totalPaid = planRevenue.reduce((s, p) => s + p.users, 0);

  // Ledger
  const availableYears = Array.from(new Set(monthlyDetail.map((r) => r.isoMonth.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  const filteredDetail = yearFilter === "all" ? monthlyDetail : monthlyDetail.filter((r) => r.isoMonth.startsWith(yearFilter));
  const sortedDetail = sortDesc ? [...filteredDetail].reverse() : filteredDetail;
  const totalLedgerPages = Math.ceil(sortedDetail.length / LEDGER_PAGE_SIZE);
  const pagedDetail = sortedDetail.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE);

  function changeYearFilter(y: string) { setYearFilter(y); setLedgerPage(1); }
  function toggleSort() { setSortDesc((v) => !v); setLedgerPage(1); }

  const yearTotals = yearFilter !== "all" ? {
    totalNewMrr: filteredDetail.reduce((s, r) => s + r.newMrr, 0),
    totalNewPaid: filteredDetail.reduce((s, r) => s + r.newPaidUsers, 0),
    peakMrr: Math.max(0, ...filteredDetail.map((r) => r.totalMrr)),
  } : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Revenue</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Monthly recurring revenue and plan performance.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Current MRR", value: `¥${mrr.toLocaleString()}`, sub: "Monthly recurring revenue", icon: <TrendingUp className="h-4 w-4" /> },
          { label: "ARR", value: `¥${arr.toLocaleString()}`, sub: "Annualised recurring revenue", icon: <Calendar className="h-4 w-4" /> },
          { label: "Paid Users", value: totalPaid, sub: "Across all paid plans", icon: <DollarSign className="h-4 w-4" /> },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4">
            <div className="text-muted-foreground">{icon}</div>
            <div>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-xl font-semibold mt-0.5">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Plan Performance */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <p className="text-sm font-semibold">Plan Performance</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {rankedPlans.map((plan, idx) => {
            const planId = PAID_PLAN_IDS.find((id) => PLANS[id].name === plan.plan);
            const color = planId ? PLAN_COLORS[planId] : "#6b7280";
            const revPct = totalMrr > 0 ? Math.round((plan.mrr / totalMrr) * 100) : 0;
            const userPct = totalPaid > 0 ? Math.round((plan.users / totalPaid) * 100) : 0;
            const isLeader = idx === 0 && plan.mrr > 0;
            return (
              <div key={plan.plan} className="relative rounded-lg border border-border bg-muted/20 p-4">
                {isLeader && (
                  <span className="absolute -top-2 right-3 rounded-full bg-yellow-500/20 border border-yellow-500/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                    Leader
                  </span>
                )}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{RANK_LABELS[idx]}</span>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold">{plan.plan}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{plan.users} users</span>
                </div>
                <div className="text-xl font-bold mb-1">¥{plan.mrr.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></div>
                <div className="space-y-2 mt-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Revenue share</span><span className="font-medium text-foreground">{revPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${revPct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>User share</span><span className="font-medium text-foreground">{userPct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all opacity-60" style={{ width: `${userPct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
                  <span>Per user</span>
                  <span className="font-medium text-foreground">¥{plan.users > 0 ? Math.round(plan.mrr / plan.users).toLocaleString() : 0}</span>
                </div>
              </div>
            );
          })}
          {rankedPlans.every((p) => p.users === 0) && (
            <div className="col-span-3 py-8 text-center text-sm text-muted-foreground">No paid users yet — plan rankings will appear here.</div>
          )}
        </div>
      </div>

      {/* MRR chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">MRR Trend</p>
          <div className="flex gap-1">
            {MONTH_OPTIONS.map((o) => (
              <button key={o} onClick={() => setChartMonths(o)} className={`rounded px-2 py-0.5 text-xs font-medium transition cursor-pointer ${chartMonths === o ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/60"}`}>
                {o}M
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparseMonths(mrrByMonth.slice(-chartMonths), chartMonths)} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gMRR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.55} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="displayMonth" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v.toLocaleString()}`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`¥${v.toLocaleString()}`, "MRR"]} />
              <Area type="monotone" dataKey="mrr" stroke="#22c55e" strokeWidth={2.5} fill="url(#gMRR)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plan breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Revenue by Plan</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={planRevenue} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
                <XAxis dataKey="plan" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${v.toLocaleString()}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`¥${v.toLocaleString()}`, "MRR"]} />
                <Bar dataKey="mrr" radius={[4, 4, 0, 0]}>
                  {planRevenue.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Users by Plan</p>
          <div className="space-y-3 mt-6">
            {planRevenue.map((p) => (
              <div key={p.plan}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{p.plan}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{p.users} users</span>
                    <span className="font-semibold text-foreground">¥{p.mrr.toLocaleString()}/mo</span>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${totalPaid > 0 ? (p.users / totalPaid) * 100 : 0}%`, backgroundColor: p.color }} />
                </div>
              </div>
            ))}
            {planRevenue.every((p) => p.users === 0) && (
              <p className="text-sm text-muted-foreground text-center py-6">No paid users yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Ledger */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Revenue Ledger</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredDetail.length} months · page {ledgerPage} of {totalLedgerPages || 1}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={yearFilter} onChange={(e) => changeYearFilter(e.target.value)} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
              <option value="all">All years</option>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={toggleSort} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition cursor-pointer">
              {sortDesc ? <><ChevronDown className="h-3.5 w-3.5" />Newest first</> : <><ChevronUp className="h-3.5 w-3.5" />Oldest first</>}
            </button>
          </div>
        </div>
        {yearTotals && (
          <div className="flex flex-wrap items-center gap-6 px-5 py-3 bg-primary/5 border-b border-border text-xs">
            <span className="font-semibold text-foreground">{yearFilter} summary</span>
            <span className="text-muted-foreground">New revenue: <span className="font-medium text-emerald-400">+¥{yearTotals.totalNewMrr.toLocaleString()}</span></span>
            <span className="text-muted-foreground">New paid users: <span className="font-medium text-foreground">+{yearTotals.totalNewPaid}</span></span>
            <span className="text-muted-foreground">Peak MRR: <span className="font-medium text-foreground">¥{yearTotals.peakMrr.toLocaleString()}</span></span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground bg-muted/30">
                <th className="px-5 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Total MRR</th>
                <th className="px-4 py-3 font-medium">MoM</th>
                <th className="px-4 py-3 font-medium">New Revenue</th>
                <th className="px-4 py-3 font-medium">Paid Users</th>
                <th className="px-4 py-3 font-medium">New Paid</th>
                <th className="px-4 py-3 font-medium">ARR Run Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedDetail.map((row) => (
                <tr key={row.isoMonth} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground">{row.month}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">¥{row.totalMrr.toLocaleString()}</td>
                  <td className="px-4 py-3"><GrowthBadge value={row.momGrowth} /></td>
                  <td className="px-4 py-3 text-xs">{row.newMrr > 0 ? <span className="text-emerald-400 font-medium">+¥{row.newMrr.toLocaleString()}</span> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground"><span className="font-medium text-foreground">{row.totalPaidUsers}</span> total</td>
                  <td className="px-4 py-3 text-xs">{row.newPaidUsers > 0 ? <span className="text-emerald-400 font-medium">+{row.newPaidUsers}</span> : <span className="text-muted-foreground">0</span>}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">¥{(row.totalMrr * 12).toLocaleString()}</td>
                </tr>
              ))}
              {pagedDetail.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">No data for this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalLedgerPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="text-xs text-muted-foreground">Showing {(ledgerPage - 1) * LEDGER_PAGE_SIZE + 1}–{Math.min(ledgerPage * LEDGER_PAGE_SIZE, sortedDetail.length)} of {sortedDetail.length} months</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setLedgerPage(ledgerPage - 1)} disabled={ledgerPage <= 1} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalLedgerPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalLedgerPages - 4, ledgerPage - 2)) + i;
                return (
                  <button key={p} onClick={() => setLedgerPage(p)} className={`min-w-[28px] rounded-md border px-2 py-1 text-xs transition cursor-pointer ${p === ledgerPage ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted text-muted-foreground"}`}>{p}</button>
                );
              })}
              <button onClick={() => setLedgerPage(ledgerPage + 1)} disabled={ledgerPage >= totalLedgerPages} className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
