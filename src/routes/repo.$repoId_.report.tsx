import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { ScoreRing, SeverityBadge } from "@/components/ui-bits";
import { UpgradeModal } from "@/components/upgrade-modal";
import { getReportFn } from "@/lib/api/github.functions";
import { getUserPlanFn } from "@/lib/api/credits.functions";
import { planAllows } from "@/lib/plans";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  GitPullRequest,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
  BarChart2,
  FileText,
  BrainCircuit,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/repo/$repoId_/report")({
  head: () => ({ meta: [{ title: "Report — LaunchReadyy" }] }),
  component: ReportPage,
  notFoundComponent: () => <div className="p-10 text-center">Not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async ({ params }) => {
    const [report, planData] = await Promise.all([
      getReportFn({ data: { repoId: params.repoId } }).catch(() => null),
      getUserPlanFn().catch(() => null),
    ]);
    if (!report) throw notFound();
    return { report, planData };
  },
});

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-critical",
  warning: "text-warning",
  info: "text-blue-400",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-critical/10 border-critical/20",
  warning: "bg-warning/10 border-warning/20",
  info: "bg-blue-500/10 border-blue-500/20",
};

function JobStatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-400">
        <CheckCircle2 size={12} /> Merged
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-critical">
        <XCircle size={12} /> Failed
      </span>
    );
  if (status === "running" || status === "pending")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-warning">
        <Clock size={12} /> In progress
      </span>
    );
  return <span className="text-xs text-muted-foreground capitalize">{status}</span>;
}

function ReportPage() {
  const { report, planData } = Route.useLoaderData();
  const { repoId } = Route.useParams();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const canView = planData && planAllows(planData.plan as "free" | "starter" | "pro" | "agency", "pro");

  if (!canView) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <BarChart2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold mb-2">Advanced Reports</h1>
          <p className="text-muted-foreground mb-6">
            Detailed scan reports with issue breakdowns and PR history are available on the Pro plan
            and above.
          </p>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Upgrade to Pro
          </button>
        </main>
        <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="report" currentPlan={(planData?.plan ?? "free") as "free" | "starter" | "pro" | "agency"} />
      </>
    );
  }

  const { repo, scan, issues, jobs, archScan } = report;

  const critical = issues.filter((i) => i.severity === "critical");
  const warnings = issues.filter((i) => i.severity === "warning");
  const info = issues.filter((i) => i.severity === "info");

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const openPRs = jobs.filter((j) => j.status === "running" || j.status === "pending");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Back */}
        <Link
          to="/repo/$repoId"
          params={{ repoId }}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to {repo.name}
        </Link>

        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold">{repo.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {repo.full_name} · {repo.framework} · {repo.language}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/repo/$repoId/fix"
              params={{ repoId }}
              search={{ fixes: "" }}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Run fixes
            </Link>
            {repo.framework !== "unknown" && planData && planAllows(planData.plan as "free" | "starter" | "pro" | "agency", "pro") && (
              <Link
                to="/repo/$repoId/arch"
                params={{ repoId }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                <BrainCircuit size={14} />
                Architecture
              </Link>
            )}
          </div>
        </div>

        {!scan ? (
          <div className="rounded-xl border border-border p-10 text-center text-muted-foreground">
            No scan data yet.{" "}
            <Link to="/repo/$repoId" params={{ repoId }} className="underline">
              Run a scan first.
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Score + summary */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6">
                <ScoreRing score={scan.score} size={80} />
                <p className="mt-2 text-xs text-muted-foreground">Production score</p>
              </div>
              <div className="rounded-xl border border-critical/20 bg-critical/5 p-5 text-center">
                <p className="font-display text-3xl font-bold text-critical">{critical.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Critical issues</p>
              </div>
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-5 text-center">
                <p className="font-display text-3xl font-bold text-warning">{warnings.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Warnings</p>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-center">
                <p className="font-display text-3xl font-bold text-blue-400">{info.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Info</p>
              </div>
            </div>

            {/* Scan metadata */}
            <p className="text-xs text-muted-foreground">
              Scanned{" "}
              {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })} · Scan ID:{" "}
              <code className="text-xs">{scan.id.slice(0, 8)}</code>
            </p>

            {/* Issues list */}
            {issues.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Issues found
                </h2>
                <div className="space-y-2">
                  {[...critical, ...warnings, ...info].map((issue) => (
                    <div
                      key={issue.id}
                      className={`rounded-lg border p-4 ${SEVERITY_BG[issue.severity] ?? "bg-card border-border"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          {issue.severity === "critical" && (
                            <AlertTriangle
                              size={15}
                              className="mt-0.5 shrink-0 text-critical"
                            />
                          )}
                          {issue.severity === "warning" && (
                            <AlertTriangle
                              size={15}
                              className="mt-0.5 shrink-0 text-warning"
                            />
                          )}
                          {issue.severity === "info" && (
                            <Info size={15} className="mt-0.5 shrink-0 text-blue-400" />
                          )}
                          <div>
                            <p
                              className={`text-sm font-medium ${SEVERITY_COLOR[issue.severity] ?? ""}`}
                            >
                              {issue.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{issue.why}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <SeverityBadge severity={issue.severity as import("@/lib/mock-data").Severity} />
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                            {issue.category}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        ⏱ Saves {issue.time_saved}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Architecture analysis */}
            {archScan && (
              <section>
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Architecture analysis
                </h2>
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BrainCircuit size={18} className="text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          Architecture score: {archScan.score}/100
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {archScan.scanned_files} files analyzed ·{" "}
                          {formatDistanceToNow(new Date(archScan.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/repo/$repoId/arch"
                      params={{ repoId }}
                      className="text-xs text-primary hover:underline"
                    >
                      Full analysis →
                    </Link>
                  </div>
                </div>
              </section>
            )}

            {/* Fix jobs / PR history */}
            {jobs.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Fix PRs ({completedJobs.length} merged · {openPRs.length} open)
                </h2>
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                          Fixes
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                          Credits
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                          When
                        </th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                            {job.fixes
                              .split(",")
                              .filter(Boolean)
                              .map((f) => (
                                <span
                                  key={f}
                                  className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5"
                                >
                                  {f}
                                </span>
                              ))}
                          </td>
                          <td className="px-4 py-3">
                            <JobStatusBadge status={job.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {job.credits_cost}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {job.pr_url && (
                              <a
                                href={job.pr_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <GitPullRequest size={12} />
                                PR #{job.pr_number}
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {jobs.length === 0 && issues.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No fix PRs created yet.</p>
                <Link
                  to="/repo/$repoId/fix"
                  params={{ repoId }}
                  search={{ fixes: "" }}
                  className="mt-3 inline-block text-sm text-primary hover:underline"
                >
                  Generate fixes →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
