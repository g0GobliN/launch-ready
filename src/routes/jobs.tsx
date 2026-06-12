import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { getAllJobsFn } from "@/lib/api/github.functions";
import { FIX_DETAILS } from "@/lib/mock-data";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  GitPullRequest,
  ExternalLink,
  History,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/jobs")({
  head: () => ({ meta: [{ title: "Job History — LaunchReadyy" }] }),
  component: JobsPage,
  loader: () => getAllJobsFn(),
});

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  completed: {
    label: "Completed",
    icon: <CheckCircle2 size={13} className="text-green-400" />,
    className: "text-green-400",
  },
  failed: {
    label: "Failed",
    icon: <XCircle size={13} className="text-critical" />,
    className: "text-critical",
  },
  running: {
    label: "Running",
    icon: <Clock size={13} className="text-primary" />,
    className: "text-primary",
  },
  pending: {
    label: "Pending",
    icon: <Clock size={13} className="text-warning" />,
    className: "text-warning",
  },
  cancelled: {
    label: "Cancelled",
    icon: <Ban size={13} className="text-muted-foreground" />,
    className: "text-muted-foreground",
  },
};

function JobsPage() {
  const jobs = Route.useLoaderData();

  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const running = jobs.filter(
    (j) => j.status === "running" || j.status === "pending",
  ).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <h1 className="font-display text-2xl font-bold">Job History</h1>
          <span className="ml-auto text-sm text-muted-foreground">
            {jobs.length} total
          </span>
        </div>

        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
            <p className="font-display text-2xl font-bold text-green-400">{completed}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="rounded-xl border border-critical/20 bg-critical/5 p-4 text-center">
            <p className="font-display text-2xl font-bold text-critical">{failed}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Failed</p>
          </div>
          <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-center">
            <p className="font-display text-2xl font-bold text-warning">{running}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">In progress</p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            No jobs yet.{" "}
            <Link to="/dashboard" className="text-primary hover:underline">
              Scan a repo to get started.
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Repository</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Fixes</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">When</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.cancelled;
                  const fixIds = Array.isArray(job.fixes) ? job.fixes : [];
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/repo/$repoId"
                          params={{ repoId: job.repoId }}
                          className="font-mono text-xs hover:text-primary"
                        >
                          {job.repoFullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {fixIds.slice(0, 3).map((id) => (
                            <span
                              key={id}
                              className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {FIX_DETAILS[id]?.label ?? id}
                            </span>
                          ))}
                          {fixIds.length > 3 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              +{fixIds.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.className}`}>
                          {cfg.icon}
                          {cfg.label}
                        </div>
                        {job.errorMessage && (
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                            {job.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.createdAt}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {job.prUrl && (
                            <a
                              href={job.prUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <GitPullRequest size={11} />
                              PR #{job.prNumber}
                              <ExternalLink size={9} />
                            </a>
                          )}
                          <Link
                            to="/repo/$repoId/job/$jobId"
                            params={{ repoId: job.repoId, jobId: job.id }}
                            search={{ from: "jobs" }}
                            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
