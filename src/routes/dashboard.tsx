import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { saveSelectedRepo, triggerScan, loadDashboardFn } from "@/lib/api/github.functions";
import { UpgradeModal } from "@/components/upgrade-modal";
import type { GitHubRepo } from "@/lib/github.server";
import type { FixRequest } from "@/lib/mock-data";
import type { CreditTransaction, UserPlanData } from "@/lib/credits.server";
import { PLANS } from "@/lib/plans";
import {
  GithubIcon,
  Lock,
  Star,
  Search,
  Zap,
  Globe,
  GitBranch,
  ArrowRight,
  LogOut,
  BriefcaseIcon,
  Coins,
  TrendingDown,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { useState, useEffect } from "react";
import { z } from "zod";

const dashboardSearchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LaunchReadyy" }] }),
  validateSearch: dashboardSearchSchema,
  loader: () => loadDashboardFn(),
  component: Dashboard,
});

function Dashboard() {
  const { user, githubRepos, recentScans, recentJobs, planData, creditHistory } =
    Route.useLoaderData();

  const { error } = Route.useSearch();
  if (!user) return <ConnectPage authError={error} />;
  return (
    <RepoList
      user={user}
      repos={githubRepos}
      recentScans={recentScans}
      recentJobs={recentJobs ?? []}
      planData={planData}
      creditHistory={creditHistory ?? []}
    />
  );
}

function ConnectPage({ authError }: { authError?: string }) {
  const [connecting, setConnecting] = useState(false);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 pt-32 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-xl border border-border bg-card">
          <GithubIcon className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">Connect your GitHub account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Authorize LaunchReadyy to read your repositories. We never commit to your branches without
          your review.
        </p>
        {authError && (
          <p className="mt-4 rounded-md border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
            GitHub sign-in failed: {authError}
          </p>
        )}
        <a
          href="/api/auth/github"
          onClick={() => setConnecting(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-90 disabled:opacity-70"
        >
          {connecting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Connecting…
            </>
          ) : (
            <>
              <GithubIcon className="h-4 w-4" /> Connect GitHub
            </>
          )}
        </a>
        <p className="mt-4 text-xs text-muted-foreground">
          Scopes requested: <code className="rounded bg-muted px-1 py-0.5">read:user</code>{" "}
          <code className="rounded bg-muted px-1 py-0.5">repo</code>
        </p>
      </div>
    </div>
  );
}

const JOB_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-warning" },
  running: { label: "Running", className: "text-primary" },
  completed: { label: "Completed", className: "text-success" },
  failed: { label: "Failed", className: "text-critical" },
  cancelled: { label: "Cancelled", className: "text-muted-foreground" },
};

function RepoList({
  user,
  repos,
  recentScans,
  recentJobs,
  planData,
  creditHistory,
}: {
  user: { login: string; avatarUrl: string };
  repos: GitHubRepo[];
  recentScans: Array<{ repo: string; score: number; when: string }>;
  recentJobs: Array<FixRequest & { repoFullName: string }>;
  planData: UserPlanData | null;
  creditHistory: CreditTransaction[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [scanning, setScanning] = useState<number | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<"scan" | "repo" | null>(null);
  const [grantNotif, setGrantNotif] = useState<CreditTransaction | null>(null);

  useEffect(() => {
    const seenKey = "seen_grant_ids";
    const seen: string[] = JSON.parse(localStorage.getItem(seenKey) ?? "[]");
    const unseen = creditHistory.filter((tx) => tx.type === "grant" && !seen.includes(tx.id));
    if (unseen.length > 0) {
      setGrantNotif(unseen[0]);
      localStorage.setItem(seenKey, JSON.stringify([...seen, ...unseen.map((t) => t.id)]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = repos.filter((r) => r.full_name.toLowerCase().includes(q.toLowerCase()));

  async function analyzeRepo(repo: GitHubRepo) {
    setScanning(repo.id);
    setScanError(null);
    try {
      const { repoId } = await saveSelectedRepo({
        data: {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          updated_at: repo.updated_at,
          private: repo.private,
          owner_login: repo.owner.login,
          default_branch: repo.default_branch,
        },
      });
      await triggerScan({ data: { repoId } });
      await router.navigate({ to: "/repo/$repoId", params: { repoId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed. Please try again.";
      if (msg.startsWith("LIMIT:scan:")) {
        setUpgradeModal("scan");
      } else if (msg.startsWith("LIMIT:repo:")) {
        setUpgradeModal("repo");
      } else {
        setScanError(msg);
      }
    } finally {
      setScanning(null);
    }
  }

  const currentPlan = planData?.plan ?? "free";
  const planDef = PLANS[currentPlan];

  return (
    <div className="min-h-screen">
      {upgradeModal && (
        <UpgradeModal
          open={true}
          onClose={() => setUpgradeModal(null)}
          reason={upgradeModal}
          currentPlan={currentPlan}
        />
      )}
      <SiteHeader user={user} />

      {grantNotif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary mb-4">
                <Coins className="h-7 w-7" />
              </div>
              <h2 className="font-display text-xl font-bold">You received credits!</h2>
              <p className="mt-1 text-4xl font-bold text-primary">+{grantNotif.amount}</p>
              {grantNotif.reason && (
                <p className="mt-3 text-sm text-muted-foreground">"{grantNotif.reason}"</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{grantNotif.when}</p>
              <button
                onClick={() => setGrantNotif(null)}
                className="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
              >
                Nice, thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold">Repositories</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a repo to scan for production readiness.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm">
              {user.avatarUrl && (
                <img src={user.avatarUrl} alt={user.login} className="h-5 w-5 rounded-full" />
              )}
              <GithubIcon className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">
                Connected as <span className="font-medium">@{user.login}</span>
              </span>
              <span className="sm:hidden font-medium">@{user.login}</span>
              <span className="hidden sm:inline text-muted-foreground">· {repos.length} repos</span>
            </div>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div>
            {scanError && (
              <div className="mb-3 rounded-md border border-critical/30 bg-critical/10 px-4 py-2.5 text-sm text-critical">
                {scanError}
              </div>
            )}
            <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search repositories..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium">{r.full_name}</span>
                      {r.private ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Globe className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    {r.description && (
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        {r.description}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      {r.language && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-primary/70" />
                          {r.language}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {r.stargazers_count}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        {r.default_branch}
                      </span>
                      <span className="capitalize">{r.visibility}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => analyzeRepo(r)}
                    disabled={scanning !== null}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {scanning === r.id ? "Scanning…" : "Analyze"}
                  </button>
                </div>
              ))}
              {filtered.length === 0 && repos.length > 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No repos match your search.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            {/* Plan card */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-semibold">{planDef.name} Plan</h3>
                <Link to="/pricing" className="ml-auto text-xs text-primary hover:underline">
                  Upgrade
                </Link>
              </div>

              {/* Scan usage */}
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Scans this month</span>
                    <span className="font-medium">
                      {planData?.monthlyScanUsed ?? 0} /{" "}
                      {planData?.monthlyScanLimit ?? planDef.scansPerMonth}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, ((planData?.monthlyScanUsed ?? 0) / (planData?.monthlyScanLimit ?? planDef.scansPerMonth)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* AI credits */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">AI credits</span>
                    {planDef.aiCreditsPerMonth === 0 ? (
                      <span className="text-muted-foreground">Not available</span>
                    ) : (
                      <span className="font-medium">
                        {planData?.balance ?? 0} /{" "}
                        {planData?.aiCreditsTotal ?? planDef.aiCreditsPerMonth}
                      </span>
                    )}
                  </div>
                  {planDef.aiCreditsPerMonth > 0 && (
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{
                          width: `${Math.min(100, ((planData?.balance ?? 0) / (planData?.aiCreditsTotal ?? planDef.aiCreditsPerMonth)) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Repo limit */}
                <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Repositories</span>
                  <span className="font-medium">Up to {planDef.repos}</span>
                </div>
              </div>

              {/* Credit history */}
              {creditHistory.length > 0 && (
                <div className="mt-4 border-t border-border pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Coins className="h-3 w-3" /> Recent credit activity
                  </div>
                  <div className="space-y-0">
                    {creditHistory.slice(0, 4).map((tx) => {
                      const label =
                        tx.type === "reset"
                          ? "Monthly reset"
                          : tx.type === "refund"
                            ? "Refunded"
                            : tx.type === "grant"
                              ? "Grant"
                              : "Used";
                      const sub = tx.type === "grant" && tx.reason ? tx.reason : null;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-start justify-between gap-2 py-1 text-xs"
                        >
                          <div className="flex items-start gap-1.5 text-muted-foreground min-w-0">
                            {tx.amount < 0 ? (
                              <TrendingDown className="h-3 w-3 text-critical mt-0.5 shrink-0" />
                            ) : (
                              <TrendingUp className="h-3 w-3 text-success mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div>{label}</div>
                              {sub && (
                                <div className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">
                                  {sub}
                                </div>
                              )}
                            </div>
                          </div>
                          <span
                            className={`font-medium tabular-nums shrink-0 ${tx.amount < 0 ? "text-critical" : "text-success"}`}
                          >
                            {tx.amount > 0 ? "+" : ""}
                            {tx.amount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {recentScans.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-display text-sm font-semibold">Recent scans</h3>
                <div className="mt-3 space-y-2">
                  {recentScans.slice(0, 5).map((s) => (
                    <div
                      key={s.repo}
                      className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs">{s.repo}</div>
                        <div className="text-[10px] text-muted-foreground">{s.when}</div>
                      </div>
                      <div
                        className={`font-display text-lg font-semibold ${s.score >= 60 ? "text-warning" : "text-critical"}`}
                      >
                        {s.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentJobs.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <BriefcaseIcon className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-semibold">Job history</h3>
                </div>
                <div className="mt-3 space-y-2">
                  {recentJobs.map((job) => {
                    const cfg = JOB_STATUS_LABELS[job.status] ?? JOB_STATUS_LABELS.cancelled;
                    return (
                      <Link
                        key={job.id}
                        to="/repo/$repoId/job/$jobId"
                        params={{ repoId: job.repoId, jobId: job.id }}
                        className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm transition hover:bg-muted"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs">{job.repoFullName}</div>
                          <div className="text-[10px] text-muted-foreground">{job.createdAt}</div>
                        </div>
                        <span className={`whitespace-nowrap text-xs font-medium ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display text-sm font-semibold">How it works</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Run a scan after every major AI prompt to keep production debt low.
              </p>
              <ol className="mt-3 space-y-2">
                {[
                  { n: "01", t: "Connect GitHub", d: "One-click OAuth — read-only access." },
                  { n: "02", t: "Scan your repo", d: "Get a 0–100 production readiness score." },
                  { n: "03", t: "Pick your fixes", d: "Choose CI, tests, Docker, security…" },
                  { n: "04", t: "Get a PR", d: "Review and merge — we never touch main." },
                ].map((s) => (
                  <li key={s.n} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-px font-mono text-[10px] text-primary/60 shrink-0">
                      {s.n}
                    </span>
                    <div>
                      <span className="font-medium">{s.t}</span>
                      <span className="ml-1.5 text-muted-foreground">{s.d}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                to="/workflow"
                className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                See full walkthrough <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
