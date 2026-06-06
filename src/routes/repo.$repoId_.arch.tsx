import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { ScoreRing, SeverityBadge } from "@/components/ui-bits";
import { UpgradeModal } from "@/components/upgrade-modal";
import { getRepoFn } from "@/lib/api/db.functions";
import { getArchScanFn, runArchScanFn } from "@/lib/api/github.functions";
import { getUserPlanFn } from "@/lib/api/credits.functions";
import type { ArchFinding } from "@/lib/arch-scanner.server";
import {
  ArrowLeft,
  BrainCircuit,
  FileX,
  PackageX,
  FileWarning,
  Layers,
  Copy,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/repo/$repoId_/arch")({
  head: () => ({ meta: [{ title: "Architecture — LaunchReady" }] }),
  component: ArchPage,
  notFoundComponent: () => <div className="p-10 text-center">Not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async ({ params }) => {
    const [repo, archScan, planData] = await Promise.all([
      getRepoFn({ data: { repoId: params.repoId } }),
      getArchScanFn({ data: { repoId: params.repoId } }).catch(() => null),
      getUserPlanFn().catch(() => null),
    ]);
    if (!repo) throw notFound();
    return { repo, archScan, planData };
  },
});

// ─── Finding type config ──────────────────────────────────────────────────────

const FINDING_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; color: string }
> = {
  "circular-dep":      { icon: AlertCircle,  label: "Circular dependency",   color: "text-critical" },
  "dead-file":         { icon: FileX,        label: "Dead file",              color: "text-muted-foreground" },
  "unused-package":    { icon: PackageX,     label: "Unused package",         color: "text-muted-foreground" },
  "oversized-file":    { icon: FileWarning,  label: "Oversized file",         color: "text-warning" },
  "separation-issue":  { icon: Layers,       label: "Separation of concerns", color: "text-warning" },
  "duplicate-logic":   { icon: Copy,         label: "Duplicate logic",        color: "text-accent" },
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// ─── Page component ───────────────────────────────────────────────────────────

function ArchPage() {
  const { repo, archScan: initial, planData } = Route.useLoaderData();
  const [archScan, setArchScan] = useState(initial);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const currentPlan = planData?.plan ?? "free";
  const canRunArch = currentPlan === "pro" || currentPlan === "agency";

  async function handleRun() {
    if (!canRunArch) { setUpgradeModal(true); return; }
    setRunning(true);
    setError(null);
    try {
      const result = await runArchScanFn({ data: { repoId: repo.id } });
      setArchScan(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      if (msg.startsWith("LIMIT:plan:")) { setUpgradeModal(true); }
      else if (msg.includes("Insufficient AI credits")) { setError("Not enough AI credits. Check your plan."); }
      else { setError(msg); }
    } finally {
      setRunning(false);
    }
  }

  const sortedFindings = archScan
    ? [...archScan.findings].sort(
        (a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3),
      )
    : [];

  return (
    <div className="min-h-screen">
      <UpgradeModal open={upgradeModal} onClose={() => setUpgradeModal(false)} reason="arch" currentPlan={currentPlan} />
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
          <span>/</span>
          <Link to="/repo/$repoId" params={{ repoId: repo.id }} className="hover:text-foreground font-mono">
            {repo.full_name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Architecture</span>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Architecture Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rule-based scan for structural issues · AI-assisted explanations for complex findings.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {running ? "Scanning…" : archScan ? "Re-scan" : "Run analysis"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-critical/30 bg-critical/10 px-4 py-2.5 text-sm text-critical">
            {error}
          </div>
        )}

        {!archScan && !running && (
          <div className="mt-16 flex flex-col items-center text-center">
            <BrainCircuit className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">
              No architecture analysis yet. Click <strong>Run analysis</strong> to scan{" "}
              <span className="font-mono">{repo.full_name}</span>.
            </p>
          </div>
        )}

        {running && (
          <div className="mt-16 flex flex-col items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">
              Fetching source files and analyzing structure…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Complex findings are explained by Claude. This may take 10–20 s.
            </p>
          </div>
        )}

        {archScan && !running && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* Left panel — score + summary */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex flex-col items-center">
                  <ScoreRing score={archScan.score} />
                  <div className="mt-4 text-center">
                    <div className="font-display text-base font-semibold">Architecture Score</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {archScan.scannedFiles} file{archScan.scannedFiles !== 1 ? "s" : ""} analyzed · {archScan.createdAt}
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-xs">
                  {Object.entries(FINDING_CONFIG).map(([type, cfg]) => {
                    const count = sortedFindings.filter((f) => f.type === type).length;
                    const Icon = cfg.icon;
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Icon className={`h-3 w-3 ${cfg.color}`} />
                          {cfg.label}
                        </div>
                        <span className={count > 0 ? cfg.color : "text-success"}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Link
                to="/repo/$repoId"
                params={{ repoId: repo.id }}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to issues
              </Link>
            </div>

            {/* Right panel — findings list */}
            <div>
              {sortedFindings.length === 0 ? (
                <div className="rounded-xl border border-success/30 bg-success/5 p-10 text-center">
                  <div className="font-display text-lg font-semibold text-success">Clean architecture</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    No structural issues detected in the {archScan.scannedFiles} files analyzed.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {sortedFindings.length} finding{sortedFindings.length !== 1 ? "s" : ""} —{" "}
                    sorted by severity
                  </div>
                  {sortedFindings.map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Finding card ─────────────────────────────────────────────────────────────

function FindingCard({ finding }: { finding: ArchFinding }) {
  const [open, setOpen] = useState(false);
  const cfg = FINDING_CONFIG[finding.type];
  const Icon = cfg?.icon ?? AlertCircle;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-start gap-4 p-4 text-left hover:bg-surface transition cursor-pointer"
      >
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${cfg?.color ?? "text-muted-foreground"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{finding.title}</span>
            <SeverityBadge severity={finding.severity} />
            {finding.aiExplanation && (
              <span className="flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{finding.detail}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">{finding.detail}</p>

          {finding.files.length > 0 && (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Affected files
              </div>
              <div className="flex flex-wrap gap-1.5">
                {finding.files.map((f) => (
                  <span key={f} className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-xs">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {finding.aiExplanation && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-accent">
                <BrainCircuit className="h-3.5 w-3.5" /> Claude's explanation
              </div>
              <p className="text-sm text-foreground">{finding.aiExplanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
