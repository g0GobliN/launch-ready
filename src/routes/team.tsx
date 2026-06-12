import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { UpgradeModal } from "@/components/upgrade-modal";
import { getTeamDashboardFn } from "@/lib/api/github.functions";
import { getUserPlanFn } from "@/lib/api/credits.functions";
import { planAllows } from "@/lib/plans";
import { formatDistanceToNow } from "date-fns";
import {
  GitPullRequest,
  CheckCircle2,
  Clock,
  XCircle,
  Lock,
  ExternalLink,
  Users,
  BarChart2,
  Layers,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team Dashboard — LaunchReadyy" }] }),
  component: TeamDashboard,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async () => {
    const [dashboard, planData] = await Promise.all([
      getTeamDashboardFn().catch(() => null),
      getUserPlanFn().catch(() => null),
    ]);
    return { dashboard, planData };
  },
});

function JobStatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 size={13} className="text-green-400" />;
  if (status === "failed") return <XCircle size={13} className="text-critical" />;
  if (status === "running" || status === "pending")
    return <Clock size={13} className="text-warning" />;
  return null;
}

function TeamDashboard() {
  const { dashboard, planData } = Route.useLoaderData();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const canView =
    planData &&
    planAllows(planData.plan as "free" | "starter" | "pro" | "agency", "agency");

  if (!canView) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold mb-2">Team Dashboard</h1>
          <p className="text-muted-foreground mb-6">
            See all your repositories, scan scores, and open fix PRs in one place. Available on the
            Agency plan.
          </p>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Upgrade to Agency
          </button>
        </main>
        <UpgradeModal
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          reason="team"
          currentPlan={(planData?.plan ?? "free") as "free" | "starter" | "pro" | "agency"}
        />
      </>
    );
  }

  const repos = dashboard?.repos ?? [];
  const totalScanned = repos.filter((r) => r.scan).length;
  const openPRs = repos.filter((r) => r.job && (r.job.status === "running" || r.job.status === "pending")).length;
  const avgScore =
    totalScanned > 0
      ? Math.round(repos.filter((r) => r.scan).reduce((sum, r) => sum + (r.scan?.score ?? 0), 0) / totalScanned)
      : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold">Team Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All repositories across your account
          </p>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <p className="font-display text-3xl font-bold">{repos.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Repositories</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <p className="font-display text-3xl font-bold">{totalScanned}</p>
            <p className="mt-1 text-xs text-muted-foreground">Scanned</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <p className="font-display text-3xl font-bold text-warning">{openPRs}</p>
            <p className="mt-1 text-xs text-muted-foreground">Open fix PRs</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-center">
            <p className="font-display text-3xl font-bold">
              {avgScore !== null ? avgScore : "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Avg score</p>
          </div>
        </div>

        {repos.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">
              No repositories found.{" "}
              <Link to="/dashboard" className="text-primary hover:underline">
                Scan a repo first.
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Repository
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Last scanned
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Latest PR
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {repos.map((repo) => (
                  <tr key={repo.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {repo.private && (
                          <Lock size={12} className="shrink-0 text-muted-foreground" />
                        )}
                        <div>
                          <Link
                            to="/repo/$repoId"
                            params={{ repoId: repo.id }}
                            className="font-medium hover:text-primary"
                          >
                            {repo.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {repo.framework !== "unknown" ? repo.framework : repo.language}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {repo.scan ? (
                        <span
                          className={`font-display text-base font-bold ${
                            repo.scan.score >= 75
                              ? "text-green-400"
                              : repo.scan.score >= 50
                                ? "text-warning"
                                : "text-critical"
                          }`}
                        >
                          {repo.scan.score}
                          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                            /100
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not scanned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {repo.scan
                        ? formatDistanceToNow(new Date(repo.scan.created_at), { addSuffix: true })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {repo.job ? (
                        <div className="flex items-center gap-1.5">
                          <JobStatusIcon status={repo.job.status} />
                          {repo.job.pr_url ? (
                            <a
                              href={repo.job.pr_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <GitPullRequest size={11} />
                              PR #{repo.job.pr_number}
                              <ExternalLink size={9} />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground capitalize">
                              {repo.job.status}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to="/repo/$repoId/report"
                          params={{ repoId: repo.id }}
                          className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-xs hover:bg-muted"
                        >
                          <BarChart2 size={11} />
                          Report
                        </Link>
                        <Link
                          to="/repo/$repoId/fix"
                          params={{ repoId: repo.id }}
                          search={{ fixes: "" }}
                          className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Fix →
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
