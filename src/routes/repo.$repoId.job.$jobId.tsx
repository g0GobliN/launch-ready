import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { FIX_DETAILS } from "@/lib/mock-data";
import { getRepoFn } from "@/lib/api/db.functions";
import { getFixRequestFn, confirmFixRequest, cancelFixRequest } from "@/lib/api/github.functions";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  FileEdit,
  Package,
  GitPullRequest,
  Loader2,
  XCircle,
  Coins,
  AlertCircle,
  Sparkles,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Database } from "@/lib/database.types";

type FixRequestRow = Database["public"]["Tables"]["fix_requests"]["Row"];

export const Route = createFileRoute("/repo/$repoId/job/$jobId")({
  head: () => ({ meta: [{ title: "Fix request — LaunchReady" }] }),
  component: JobPage,
  notFoundComponent: () => <div className="p-10 text-center">Not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async ({ params }) => {
    const [repo, job] = await Promise.all([
      getRepoFn({ data: { repoId: params.repoId } }),
      getFixRequestFn({ data: { jobId: params.jobId } }),
    ]);
    if (!repo || !job) throw notFound();
    return { repo, job };
  },
});

function JobPage() {
  const { repo, job: initialJob } = Route.useLoaderData();
  const { jobId } = Route.useParams();
  const [job, setJob] = useState<FixRequestRow>(initialJob);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Poll every 2 s while the job is running (survives browser navigation back)
  useEffect(() => {
    if (job.status !== "running" && job.status !== "pending") return;
    if (job.status === "pending") return; // only poll when actually running
    const interval = setInterval(async () => {
      const updated = await getFixRequestFn({ data: { jobId } });
      if (updated) setJob(updated);
      if (updated?.status === "completed" || updated?.status === "failed") {
        clearInterval(interval);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [job.status, jobId]);

  const fixIds = job.fixes ? job.fixes.split(",").filter(Boolean) : [];
  const fixLabels = fixIds.map((id) => FIX_DETAILS[id]?.label).filter(Boolean) as string[];

  async function handleConfirm() {
    setConfirming(true);
    try {
      await confirmFixRequest({ data: { jobId } });
      // Optimistically set running; polling will pick up completion
      setJob((prev) => ({ ...prev, status: "running", updated_at: new Date().toISOString() }));
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelFixRequest({ data: { jobId } });
      setJob((prev) => ({ ...prev, status: "cancelled", updated_at: new Date().toISOString() }));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/repo/$repoId/fix"
          params={{ repoId: repo.id }}
          search={{ fixes: "" }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to fix preview
        </Link>

        <h1 className="mt-4 font-display text-2xl font-semibold">Fix request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{repo.full_name}</span>
        </p>

        <div className="mt-6 space-y-4">
          {job.status === "pending" && (
            <PendingView
              job={job}
              fixLabels={fixLabels}
              confirming={confirming}
              cancelling={cancelling}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              repoId={repo.id}
            />
          )}
          {job.status === "running" && <RunningView job={job} />}
          {job.status === "completed" && <CompletedView job={job} fixLabels={fixLabels} repoId={repo.id} />}
          {job.status === "failed" && <FailedView job={job} repoId={repo.id} />}
          {job.status === "cancelled" && <CancelledView repoId={repo.id} />}
        </div>
      </div>
    </div>
  );
}

// ─── Pending: confirmation screen ────────────────────────────────────────────

function PendingView({
  job,
  fixLabels,
  confirming,
  cancelling,
  onConfirm,
  onCancel,
  repoId,
}: {
  job: FixRequestRow;
  fixLabels: string[];
  confirming: boolean;
  cancelling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  repoId: string;
}) {
  return (
    <>
      <StatusBadge status="pending" />

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-semibold">What will be generated</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatPill
            icon={<FilePlus2 className="h-4 w-4 text-primary" />}
            label="Files added"
            value={job.est_files_added}
          />
          <StatPill
            icon={<FileEdit className="h-4 w-4 text-warning" />}
            label="Files changed"
            value={job.est_files_changed}
          />
          <StatPill
            icon={<Package className="h-4 w-4 text-accent" />}
            label="Dependencies"
            value={job.est_deps}
          />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <Coins className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{job.credits_cost} credit{job.credits_cost !== 1 ? "s" : ""}</span>
          <span className="text-sm text-muted-foreground">· {job.credits_cost} fix{job.credits_cost !== 1 ? "es" : ""} selected</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-semibold">Branch</h2>
        <div className="mt-2 font-mono text-sm text-muted-foreground">{job.branch_name}</div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-sm font-semibold">Includes</h2>
        <ul className="mt-3 space-y-1.5">
          {fixLabels.map((label) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card/90 p-4 backdrop-blur">
        <Link
          to="/repo/$repoId/fix"
          params={{ repoId }}
          search={{ fixes: "" }}
          onClick={(e) => {
            e.preventDefault();
            onCancel();
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Cancel
        </Link>
        <button
          onClick={onConfirm}
          disabled={confirming || cancelling}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {confirming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitPullRequest className="h-4 w-4" />
          )}
          {confirming ? "Starting…" : "Confirm & Generate PR"}
        </button>
      </div>
    </>
  );
}

// ─── Running ──────────────────────────────────────────────────────────────────

function RunningView({ job }: { job: FixRequestRow }) {
  return (
    <>
      <StatusBadge status="running" />
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Generating pull request…</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This usually takes a few seconds.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
          You can safely close this tab — the job will continue in the background.
        </div>
        <ProgressBar />
        <p className="mt-4 text-xs text-muted-foreground">Branch: <span className="font-mono">{job.branch_name}</span></p>
      </div>
    </>
  );
}

function ProgressBar() {
  return (
    <div className="mx-auto mt-5 h-1.5 w-64 overflow-hidden rounded-full bg-muted">
      <div className="h-full animate-[progress_3s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  );
}

// ─── Completed ────────────────────────────────────────────────────────────────

interface AiFile { fixId: string; path: string; content: string }

function AiFilesPanel({ json }: { json: string | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!json) return null;
  let files: AiFile[] = [];
  try { files = JSON.parse(json) as AiFile[]; } catch { return null; }
  if (files.length === 0) return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-accent" />
        <h3 className="font-display text-sm font-semibold">AI-generated test files</h3>
        <span className="ml-auto text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2">
        {files.map((f) => (
          <div key={f.path} className="rounded-md border border-border bg-surface">
            <button
              onClick={() => setOpen((p) => (p === f.path ? null : f.path))}
              className="flex w-full items-center justify-between px-3 py-2 text-xs"
            >
              <span className="font-mono text-muted-foreground">{f.path}</span>
              {open === f.path ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {open === f.path && (
              <pre className="max-h-64 overflow-auto border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
                {f.content}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletedView({
  job,
  fixLabels,
  repoId,
}: {
  job: FixRequestRow;
  fixLabels: string[];
  repoId: string;
}) {
  return (
    <>
      <StatusBadge status="completed" />
      <div className="rounded-xl border border-primary/40 bg-card p-8 text-center glow-primary">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-semibold">Pull request created</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          LaunchReady opened PR #{job.pr_number} and it's ready for your review.
        </p>
        {job.pr_url && (
          <a
            href={job.pr_url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <GitPullRequest className="h-4 w-4" /> View PR #{job.pr_number}{" "}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Branch</div>
          <div className="mt-1 font-mono text-sm">{job.branch_name}</div>
          {job.pr_url && (
            <>
              <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">PR URL</div>
              <a
                href={job.pr_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate font-mono text-sm text-primary hover:underline"
              >
                {job.pr_url}
              </a>
            </>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Includes</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {fixLabels.map((l) => (
              <li key={l} className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> {l}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-primary" />
            {job.credits_cost === 0
              ? "No credits used — template fixes are free"
              : `${job.credits_cost} credit${job.credits_cost !== 1 ? "s" : ""} used`}
          </div>
        </div>
      </div>

      <AiFilesPanel json={job.ai_files ?? null} />

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-display text-sm font-semibold">Next steps</h3>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. Review the PR diff on GitHub.</li>
          <li>2. Run the new CI workflow to confirm it passes.</li>
          <li>3. Merge to <span className="font-mono">main</span> — your repo is production-ready.</li>
        </ol>
        <div className="mt-5 flex gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted"
          >
            Back to dashboard
          </Link>
          <Link
            to="/repo/$repoId"
            params={{ repoId }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted"
          >
            Re-scan repo
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Failed ───────────────────────────────────────────────────────────────────

function FailedView({ job, repoId }: { job: FixRequestRow; repoId: string }) {
  return (
    <>
      <StatusBadge status="failed" />
      <div className="rounded-xl border border-critical/30 bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-critical/10 text-critical">
          <XCircle className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Job failed</h2>
        {job.error_message && (
          <p className="mt-2 rounded-md border border-critical/20 bg-critical/5 px-4 py-2 font-mono text-xs text-critical">
            {job.error_message}
          </p>
        )}
        {job.credits_cost > 0 && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-sm text-success">
            <Coins className="h-3.5 w-3.5" />
            {job.credits_cost} credit{job.credits_cost !== 1 ? "s" : ""} refunded to your balance.
          </div>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/repo/$repoId/fix"
            params={{ repoId }}
            search={{ fixes: "" }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </Link>
          <Link
            to="/repo/$repoId"
            params={{ repoId }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-muted"
          >
            Back to repo
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Cancelled ───────────────────────────────────────────────────────────────

function CancelledView({ repoId }: { repoId: string }) {
  return (
    <>
      <StatusBadge status="cancelled" />
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">Job cancelled</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The fix request was cancelled. You can create a new one from the fix preview.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/repo/$repoId/fix"
            params={{ repoId }}
            search={{ fixes: "" }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to fix preview
          </Link>
        </div>
      </div>
    </>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  pending:   { label: "Pending confirmation",  className: "bg-warning/10 text-warning border-warning/20" },
  running:   { label: "Running",               className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Completed",             className: "bg-success/10 text-success border-success/20" },
  failed:    { label: "Failed",                className: "bg-critical/10 text-critical border-critical/20" },
  cancelled: { label: "Cancelled",             className: "bg-muted/50 text-muted-foreground border-border" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${cfg.className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {cfg.label}
    </div>
  );
}

function StatPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      {icon}
      <div>
        <div className="font-display text-lg font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
