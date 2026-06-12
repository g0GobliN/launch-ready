import { createFileRoute } from "@tanstack/react-router";
import { loadAdminEconomicsFn } from "@/lib/api/admin.functions";
import { Users, Zap, DollarSign, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/admin/economics")({
  head: () => ({ meta: [{ title: "Plan Economics — Admin" }] }),
  loader: () => loadAdminEconomicsFn(),
  component: AdminEconomics,
});

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold mt-0.5">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function AdminEconomics() {
  const { stats, planEconomics } = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Plan Economics</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          AI credit usage and per-plan margin if every user maxes their allowance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="AI used (month)"
          value={`${stats.aiCreditsUsedMonth} cr`}
          sub={`~$${stats.estAiCost} est. (${stats.aiProvider})`}
          icon={<Zap className="h-4 w-4" />}
        />
        <StatCard
          label="Est. margin"
          value={`$${stats.estMargin}`}
          sub={`MRR $${stats.mrr} − AI cost`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <StatCard
          label="Heavy users"
          value={stats.heavyUsers}
          sub="≥80% credits used"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Cost / credit"
          value={`$${stats.costPerCredit}`}
          sub="AI_COST_PER_CREDIT"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {planEconomics.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <p className="px-5 py-3 text-sm font-semibold border-b border-border">
            Per-plan margin (if user maxes AI credits)
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground bg-muted/30">
                <th className="px-5 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Users</th>
                <th className="px-4 py-2 font-medium">MRR</th>
                <th className="px-4 py-2 font-medium">$/credit</th>
                <th className="px-4 py-2 font-medium">Max AI cost</th>
                <th className="px-4 py-2 font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {planEconomics.map((row) => (
                <tr key={row.plan}>
                  <td className="px-5 py-2.5 font-medium">{row.plan}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.users}</td>
                  <td className="px-4 py-2.5">${row.mrr.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">${row.revPerCredit}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">${row.maxCost}</td>
                  <td
                    className={`px-4 py-2.5 font-medium ${row.marginIfMaxed < 0 ? "text-destructive" : "text-emerald-400"}`}
                  >
                    ${row.marginIfMaxed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          No paid plans to analyze yet.
        </div>
      )}
    </div>
  );
}
