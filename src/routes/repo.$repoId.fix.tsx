import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { FIX_DETAILS, type FileDiff } from "@/lib/mock-data";
import { getRepoFn, getScanFn } from "@/lib/api/db.functions";
import { createFixRequest, getFixPreviewFn } from "@/lib/api/github.functions";
import { getUserPlanFn } from "@/lib/api/credits.functions";
import { UpgradeModal } from "@/components/upgrade-modal";
import { DiffView } from "@/components/diff-view";
import { defaultFixBranchName } from "@/lib/fix-branch";
import { AI_FIX_COSTS, AI_FIX_IDS } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import {
  expandBundledFixIds,
  isBundledReadmeFix,
  isReadmeBundledWithEnvExample,
} from "@/lib/fix-bundling";
import {
  ArrowLeft,
  Coins,
  FileEdit,
  FilePlus2,
  GitBranch,
  GitPullRequest,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
  Lock,
} from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/repo/$repoId/fix")({
  head: () => ({ meta: [{ title: "Preview changes — LaunchReadyy" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ fixes: (s.fixes as string) ?? "" }),
  component: FixPage,
  notFoundComponent: () => <div className="p-10 text-center">Not found.</div>,
  errorComponent: ({ error }) => (
    <div className="p-10 text-center text-critical">{error.message}</div>
  ),
  loader: async ({ params }) => {
    const [repo, scan, planData] = await Promise.all([
      getRepoFn({ data: { repoId: params.repoId } }),
      getScanFn({ data: { repoId: params.repoId } }),
      getUserPlanFn().catch(() => null),
    ]);
    if (!repo || !scan) throw notFound();
    return { repo, scan, planData };
  },
});

function FixPage() {
  const { repo, scan, planData } = Route.useLoaderData();
  const { fixes } = Route.useSearch();
  const navigate = Route.useNavigate();
  const currentPlan = planData?.plan ?? "free";
  const creditBalance = planData?.balance ?? 0;
  const scanFixIds = useMemo(() => new Set(scan.issues.map((i) => i.fixId)), [scan]);
  const bundledReadme = isReadmeBundledWithEnvExample(scanFixIds);
  const availableFixes = useMemo(
    () =>
      Object.entries(FIX_DETAILS).filter(
        ([id]) => scanFixIds.has(id) && !isBundledReadmeFix(id, scanFixIds),
      ),
    [scanFixIds],
  );
  const initial = fixes
    ? fixes.split(",").filter(Boolean)
    : availableFixes.slice(0, 4).map(([id]) => id);
  const [selected, setSelected] = useState<string[]>(initial);
  const effectiveSelected = useMemo(
    () => expandBundledFixIds(selected, scanFixIds),
    [selected, scanFixIds],
  );
  const [branchName, setBranchName] = useState(defaultFixBranchName);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<"ai-fixes" | "credits" | null>(null);
  const [realDiffs, setRealDiffs] = useState<FileDiff[] | null>(null);
  const [diffsLoading, setDiffsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Approximate file/dep counts from templates (instant, no server call)
  const preview = useMemo(() => {
    const added = new Set<string>();
    const changed = new Set<string>();
    const deps = new Set<string>();
    let credits = 0;
    effectiveSelected.forEach((id) => {
      const f = FIX_DETAILS[id];
      if (!f) return;
      f.files_added.forEach((x) => added.add(x));
      f.files_changed.forEach((x) => changed.add(x));
      f.deps.forEach((x) => deps.add(x));
      credits += AI_FIX_IDS.has(id) ? (AI_FIX_COSTS[id] ?? 0) : 0;
    });
    return { added: [...added], changed: [...changed], deps: [...deps], credits };
  }, [effectiveSelected]);

  // Real diffs fetched from the server — debounced so rapid checkbox clicks don't spam
  useEffect(() => {
    if (effectiveSelected.length === 0) {
      setRealDiffs([]);
      return;
    }
    setDiffsLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const diffs = await getFixPreviewFn({
          data: { repoId: repo.id, fixIds: effectiveSelected },
        });
        setRealDiffs(diffs as FileDiff[]);
      } catch {
        setRealDiffs(null); // fall back to template diffs on error
      } finally {
        setDiffsLoading(false);
      }
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [effectiveSelected, repo.id]);

  // Use real diffs when available, fall back to template diffs only when not loading.
  // For AI fixes the server only returns the package.json change — supplement with
  // mock diffs so users see the AI-generated file that will be created.
  const displayDiffs: FileDiff[] = useMemo(() => {
    if (diffsLoading) return [];
    if (realDiffs !== null) {
      const merged = [...realDiffs];
      effectiveSelected.forEach((id) => {
        if (!AI_FIX_IDS.has(id)) return;
        FIX_DETAILS[id]?.diffs.forEach((d) => {
          if (!merged.some((r) => r.path === d.path)) merged.push(d);
        });
      });
      return merged;
    }
    const diffs: FileDiff[] = [];
    effectiveSelected.forEach((id) => {
      FIX_DETAILS[id]?.diffs.forEach((d) => diffs.push(d));
    });
    return diffs;
  }, [realDiffs, diffsLoading, effectiveSelected]);

  // Use real diff paths once loaded — show nothing while loading to avoid flicker
  const fileListAdded = realDiffs !== null
    ? [...new Set([
        ...realDiffs.filter((d) => d.status === "added").map((d) => d.path),
        ...effectiveSelected.flatMap((id) =>
          AI_FIX_IDS.has(id) ? (FIX_DETAILS[id]?.files_added ?? []) : []
        ),
      ])]
    : [];
  const fileListChanged = realDiffs !== null ? realDiffs.filter((d) => d.status === "modified").map((d) => d.path) : [];

  const submit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { jobId } = await createFixRequest({
        data: {
          repoId: repo.id,
          scanId: scan.id,
          fixes: effectiveSelected.join(","),
          branchName,
          estFilesAdded: preview.added.length,
          estFilesChanged: preview.changed.length,
          estDeps: preview.deps.length,
          creditsCost: preview.credits,
        },
      });
      navigate({ to: "/repo/$repoId/job/$jobId", params: { repoId: repo.id, jobId }, search: { from: "" } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create job. Please try again.";
      if (msg.includes("Insufficient AI credits")) {
        setUpgradeModal("credits");
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {upgradeModal && (
        <UpgradeModal
          open
          onClose={() => setUpgradeModal(null)}
          reason={upgradeModal}
          currentPlan={currentPlan}
        />
      )}
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/repo/$repoId"
          params={{ repoId: repo.id }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to analysis
        </Link>
        <h1 className="mt-4 font-display text-2xl font-semibold">Preview your pull request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review what LaunchReadyy will add to <span className="font-mono">{repo.full_name}</span>.
        </p>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <div className="text-sm">
            <div className="font-medium text-foreground">
              We never commit directly to <span className="font-mono">main</span>.
            </div>
            <div className="mt-0.5 text-muted-foreground">
              LaunchReadyy creates a new branch and opens a Pull Request you can review before
              merging.
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-sm font-semibold">Fixes ({selected.length})</h3>
            <div className="mt-3 space-y-2">
              {availableFixes.map(([id, f]) => {
                const isAiFix = AI_FIX_IDS.has(id);
                const fixCost = isAiFix ? (AI_FIX_COSTS[id] ?? 0) : 0;
                const isLocked = isAiFix && creditBalance < fixCost;
                const isSel = selected.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm ${isLocked ? "opacity-60" : ""}`}
                    onClick={
                      isLocked
                        ? (e) => {
                            e.preventDefault();
                            setUpgradeModal(currentPlan === "free" ? "ai-fixes" : "credits");
                          }
                        : undefined
                    }
                  >
                    {isLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() =>
                          setSelected((s) =>
                            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                          )
                        }
                        className="h-4 w-4 accent-[color:var(--color-primary)]"
                      />
                    )}
                    <span className="flex-1">
                      {(id === "env-example" || id === "env-example-ai") && bundledReadme
                        ? "Add .env.example + setup docs"
                        : f.label}
                    </span>
                    {isAiFix ? (
                      <span
                        className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isLocked ? "bg-muted text-muted-foreground" : "bg-accent/10 text-accent"}`}
                      >
                        <Coins className="h-2.5 w-2.5" />
                        {fixCost}cr
                      </span>
                    ) : (
                      <span className="text-[10px] text-success font-medium">Free</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-primary" />
                <span className="font-medium">Branch name</span>
              </div>
              <Input
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="font-mono text-sm"
                spellCheck={false}
                aria-label="Pull request branch name"
              />
              <p className="text-xs text-muted-foreground">
                Opens on a new branch — edit if you already used this name today.
              </p>
            </div>

            <PreviewBlock
              icon={<FilePlus2 className="h-4 w-4 text-primary" />}
              title="Files added"
              items={fileListAdded}
              mono
              loading={diffsLoading}
            />
            <PreviewBlock
              icon={<FileEdit className="h-4 w-4 text-warning" />}
              title="Files changed"
              items={fileListChanged}
              mono
              loading={diffsLoading}
            />
            <PreviewBlock
              icon={<Package className="h-4 w-4 text-accent" />}
              title="Dependencies to install"
              items={preview.deps}
              mono
            />

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold">File diffs</h3>
                <span className="text-xs text-muted-foreground flex items-center gap-2">
                  {diffsLoading && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  {displayDiffs.length} file{displayDiffs.length === 1 ? "" : "s"}
                </span>
              </div>
              {displayDiffs.length === 0 && !diffsLoading ? (
                <div className="text-sm text-muted-foreground">
                  Select a fix on the left to preview its diff.
                </div>
              ) : diffsLoading && displayDiffs.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Computing diffs…
                </div>
              ) : (
                <div className="space-y-3">
                  {displayDiffs.map((d, i) => {
                    const isAiPlaceholder = effectiveSelected.some(
                      (id) => AI_FIX_IDS.has(id) && FIX_DETAILS[id]?.ai_output_file === d.path,
                    );
                    if (isAiPlaceholder) {
                      return (
                        <div key={`${d.path}-${i}`} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <code className="text-xs font-mono text-muted-foreground">{d.path}</code>
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">AI generated</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4 text-primary shrink-0" />
                            Claude will analyse your repo and write this file based on your actual code when you click <strong>Generate PR</strong>.
                          </div>
                        </div>
                      );
                    }
                    return <DiffView key={`${d.path}-${i}`} diff={d} />;
                  })}
                </div>
              )}
            </div>

            {effectiveSelected.includes("monitoring") && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium mb-1">⚠️ After merging this PR</p>
                <ol className="list-decimal list-inside space-y-0.5 text-xs">
                  <li>Sign up at <a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="underline">sentry.io</a> (free)</li>
                  <li>Create a project and copy your DSN</li>
                  <li>Add <code className="font-mono bg-amber-500/20 px-1 rounded">{(repo.framework === "React Vite" || repo.framework === "Vite" || repo.framework === "React") ? "VITE_SENTRY_DSN" : "SENTRY_DSN"}</code> to your environment variables</li>
                </ol>
              </div>
            )}

            {submitError && (
              <div className="rounded-md border border-critical/30 bg-critical/10 px-4 py-2.5 text-sm text-critical">
                {submitError}
              </div>
            )}
            <div className="sticky bottom-4 flex items-center justify-between rounded-xl border border-primary/30 bg-card/90 p-4 backdrop-blur glow-primary">
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  {fileListAdded.length} added · {fileListChanged.length} changed ·{" "}
                  {preview.deps.length} dep{preview.deps.length !== 1 ? "s" : ""}
                </div>
                <div className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs sm:flex">
                  <Coins className="h-3 w-3 text-primary" />
                  {preview.credits === 0 ? (
                    <span className="text-success font-medium">Free</span>
                  ) : (
                    <span className="font-medium">
                      {preview.credits} credit{preview.credits !== 1 ? "s" : ""}
                    </span>
                  )}
                  {planData && (
                    <span className="text-muted-foreground">· {planData.balance} remaining</span>
                  )}
                </div>
              </div>
              <button
                onClick={submit}
                disabled={submitting || selected.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                <GitPullRequest className="h-4 w-4" />
                {submitting ? "Creating job…" : "Generate PR"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({
  icon,
  title,
  items,
  mono,
  loading,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  mono?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : items.length}
        </span>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">Nothing in this category.</div>
      ) : (
        <ul
          className={`mt-3 grid gap-1.5 ${mono ? "font-mono text-xs" : "text-sm"} sm:grid-cols-2`}
        >
          {items.map((x) => (
            <li key={x} className="rounded-md border border-border bg-surface px-2.5 py-1.5">
              {x}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
