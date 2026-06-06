import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import {
  GithubIcon,
  GitPullRequest,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  TestTube2,
  Workflow,
  FileCode2,
  Boxes,
  Activity,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Clock,
  ExternalLink,
  X,
  TrendingUp,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Live Demo — LaunchReady" },
      {
        name: "description",
        content:
          "See how LaunchReady scans a repo, scores production readiness, and generates a pull request with every missing engineering setup.",
      },
    ],
  }),
  component: DemoPage,
});

/* ─── types ─── */

type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  icon: React.ReactNode;
  fix: string;
  timeSaved: string;
  checked: boolean;
}

/* ─── static demo data ─── */

const DEMO_REPO = {
  owner: "acme-corp",
  name: "indie-saas",
  stars: 47,
  framework: "Next.js + Supabase",
};

const INITIAL_ISSUES: Issue[] = [
  {
    id: "ci",
    title: "GitHub Actions CI not configured",
    severity: "critical",
    category: "CI/CD",
    icon: <Workflow className="h-4 w-4" />,
    fix: ".github/workflows/ci.yml",
    timeSaved: "3h",
    checked: true,
  },
  {
    id: "tests",
    title: "Vitest unit tests missing",
    severity: "high",
    category: "Testing",
    icon: <TestTube2 className="h-4 w-4" />,
    fix: "vitest.config.ts + src/__tests__/",
    timeSaved: "4h",
    checked: true,
  },
  {
    id: "env",
    title: ".env.example not committed",
    severity: "high",
    category: "Security",
    icon: <Shield className="h-4 w-4" />,
    fix: ".env.example",
    timeSaved: "30m",
    checked: true,
  },
  {
    id: "docker",
    title: "No Dockerfile for deployment",
    severity: "medium",
    category: "Deployment",
    icon: <Boxes className="h-4 w-4" />,
    fix: "Dockerfile + .dockerignore",
    timeSaved: "2h",
    checked: false,
  },
  {
    id: "eslint",
    title: "ESLint config not found",
    severity: "high",
    category: "Code Quality",
    icon: <FileCode2 className="h-4 w-4" />,
    fix: "eslint.config.js + .prettierrc",
    timeSaved: "1h",
    checked: true,
  },
  {
    id: "sentry",
    title: "No error tracking (Sentry)",
    severity: "medium",
    category: "Monitoring",
    icon: <Activity className="h-4 w-4" />,
    fix: "sentry.client.config.ts",
    timeSaved: "1.5h",
    checked: false,
  },
];

/* ─── severity config ─── */

const SEVERITY_META: Record<
  Severity,
  { label: string; color: string; bg: string; ring: string }
> = {
  critical: {
    label: "Critical",
    color: "text-critical",
    bg: "bg-critical/10",
    ring: "ring-critical/30",
  },
  high: {
    label: "High",
    color: "text-warning",
    bg: "bg-warning/10",
    ring: "ring-warning/30",
  },
  medium: {
    label: "Medium",
    color: "text-accent",
    bg: "bg-accent/10",
    ring: "ring-accent/30",
  },
  low: {
    label: "Low",
    color: "text-muted-foreground",
    bg: "bg-muted/10",
    ring: "ring-border",
  },
};

function scoreFromIssues(issues: Issue[]) {
  const weights: Record<Severity, number> = {
    critical: 20,
    high: 10,
    medium: 6,
    low: 3,
  };
  const maxPossible = INITIAL_ISSUES.reduce(
    (acc, i) => acc + weights[i.severity],
    0
  );
  const remaining = issues.reduce((acc, i) => acc + weights[i.severity], 0);
  return Math.round(((maxPossible - remaining) / maxPossible) * 55 + 30);
}

/* ─── score ring ─── */

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const progress = (score / 100) * circ;
  const color =
    score >= 80
      ? "text-success stroke-success"
      : score >= 50
        ? "text-warning stroke-warning"
        : "text-critical stroke-critical";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="136" height="136" className="-rotate-90">
        <circle cx="68" cy="68" r={radius} fill="none" strokeWidth="10" className="stroke-border" />
        <circle
          cx="68" cy="68" r={radius} fill="none" strokeWidth="10"
          strokeDasharray={`${progress} ${circ}`}
          strokeLinecap="round"
          className={`transition-all duration-700 ${color}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-display text-4xl font-bold ${color}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">readiness</span>
      </div>
    </div>
  );
}

/* ─── scanner terminal ─── */

type Phase = "idle" | "scanning" | "done" | "generating" | "pr_created";

function ScannerAnimation({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  const lines: { text: string; type: "default" | "error" | "success" }[] = [
    { text: "→ Cloning repo metadata…",                    type: "default" },
    { text: "→ Reading file tree (312 files)…",            type: "default" },
    { text: "→ Detecting framework: Next.js 14",           type: "default" },
    { text: "→ Checking .github/workflows/…  ✗ not found",type: "error"   },
    { text: "→ Checking test runner config… ✗ not found",  type: "error"   },
    { text: "→ Checking .env.example…       ✗ not found",  type: "error"   },
    { text: "→ Checking Dockerfile…         ✗ not found",  type: "error"   },
    { text: "→ Checking eslint.config…      ✗ not found",  type: "error"   },
    { text: "→ Checking sentry config…      ✗ not found",  type: "error"   },
    { text: "→ Calculating readiness score…",              type: "default" },
    { text: "✓ Scan complete — score: 38/100",             type: "success" },
  ];

  useEffect(() => {
    if (line >= lines.length) {
      setTimeout(onDone, 400);
      return;
    }
    const t = setTimeout(() => setLine((l) => l + 1), 160);
    return () => clearTimeout(t);
  }, [line]);

  return <TerminalBox lines={lines.slice(0, line)} showCursor={line < lines.length} title={`scanning ${DEMO_REPO.owner}/${DEMO_REPO.name}`} />;
}

function TerminalBox({
  lines,
  showCursor,
  title,
}: {
  lines: { text: string; type: "default" | "error" | "success" }[];
  showCursor?: boolean;
  title: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 font-mono text-xs shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-critical/60" />
        <span className="h-2 w-2 rounded-full bg-warning/60" />
        <span className="h-2 w-2 rounded-full bg-success/60" />
        <span className="ml-2 text-[11px] text-muted-foreground">launchready — {title}</span>
      </div>
      <div className="space-y-1">
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.type === "success"
                ? "text-primary"
                : l.type === "error"
                  ? "text-critical"
                  : "text-muted-foreground"
            }
          >
            {l.text}
          </div>
        ))}
        {showCursor && (
          <span className="inline-block h-3 w-1.5 animate-pulse bg-primary/70" />
        )}
      </div>
    </div>
  );
}

/* ─── PR modal ─── */

function PRModal({ onClose, timeSaved }: { onClose: () => void; timeSaved: number }) {
  const [thanked, setThanked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-success/10 text-success">
            <GitPullRequest className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Pull request opened</div>
            <div className="font-display font-semibold">PR #42 — ready to review</div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">branch</span>
            <code className="rounded bg-background px-2 py-0.5 text-xs text-primary">
              launchready/production-ready-2025-06-06
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">files added</span>
            <span className="text-xs font-medium text-success">+5 files</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">readiness score</span>
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <span className="text-critical">38</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-success">82</span>
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success">+44 pts</span>
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">time saved</span>
            <span className="text-xs font-semibold text-foreground">~{timeSaved.toFixed(1)}h</span>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5">
          {[
            ".github/workflows/ci.yml",
            "vitest.config.ts + src/__tests__/setup.ts",
            ".env.example",
            "eslint.config.js + .prettierrc",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              <code className="text-xs">{f}</code>
            </li>
          ))}
        </ul>

        {thanked ? (
          <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 px-5 py-4 text-center">
            <p className="font-display font-semibold text-foreground">Thanks for trying LaunchReady!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This was a demo PR — connect your real repo to get one just like it, for free.
            </p>
            <Link
              to="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
            >
              <GithubIcon className="h-4 w-4" /> Connect GitHub — it's free
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => setThanked(true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition"
            >
              <ExternalLink className="h-4 w-4" /> View on GitHub
            </button>
            <Link
              to="/dashboard"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-muted transition"
            >
              <GithubIcon className="h-4 w-4" /> Connect your repo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── main page ─── */

function DemoPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showPR, setShowPR] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const score =
    phase === "done" || phase === "generating" || phase === "pr_created"
      ? scoreFromIssues(issues.filter((i) => !i.checked))
      : 38;

  function startScan() {
    setPhase("scanning");
    setIssues([]);
    setShowPR(false);
  }

  function onScanDone() {
    setIssues(INITIAL_ISSUES);
    setPhase("done");
    setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      100
    );
  }

  function toggleIssue(id: string) {
    setIssues((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  }

  function generatePR() {
    setPhase("generating");
    setTimeout(() => {
      setPhase("pr_created");
      setShowPR(true);
    }, 2200);
  }

  const checkedCount = issues.filter((i) => i.checked).length;
  const timeSaved = issues
    .filter((i) => i.checked)
    .reduce((acc, i) => {
      const n = parseFloat(i.timeSaved);
      return acc + (i.timeSaved.includes("m") ? n / 60 : n);
    }, 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      {showPR && <PRModal onClose={() => setShowPR(false)} timeSaved={timeSaved} />}

      {/* hero */}
      <section className="relative overflow-hidden border-b border-border/50 py-16">
        <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="absolute left-1/2 top-0 -z-10 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Interactive demo — no GitHub account needed
          </div>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            See LaunchReady in{" "}
            <span className="text-gradient">action</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Watch us scan a real-world AI-built SaaS repo, surface every missing piece, and generate a production-ready pull request — all in seconds.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm">
            {[
              { n: "2,800+", label: "repos scanned" },
              { n: "~4.8h",  label: "saved per scan" },
              { n: "38→82",  label: "avg score jump" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-card px-4 py-2 text-center">
                <div className="font-display font-semibold text-foreground">{s.n}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-6 py-14">
        {/* Step 1 — repo card */}
        <div>
          <StepBadge n={1} label="The repository" />
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                <GithubIcon className="h-6 w-6" />
              </div>
              <div>
                <div className="font-display font-semibold">
                  {DEMO_REPO.owner}/{DEMO_REPO.name}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {DEMO_REPO.framework} · ⭐ {DEMO_REPO.stars}
                </div>
              </div>
            </div>
            <button
              id="start-scan-btn"
              onClick={startScan}
              disabled={phase === "scanning"}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-primary hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {phase === "scanning" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {phase === "idle" ? "Run Scan" : phase === "scanning" ? "Scanning…" : "Re-scan"}
            </button>
          </div>
        </div>

        {/* Step 2 — scanner output */}
        {(phase === "scanning" || phase === "done" || phase === "generating" || phase === "pr_created") && (
          <div>
            <StepBadge n={2} label="Scanner output" />
            <div className="mt-4">
              {phase === "scanning" ? (
                <ScannerAnimation onDone={onScanDone} />
              ) : (
                <TerminalBox
                  title="scan complete"
                  lines={[
                    { text: "→ Detected: Next.js 14 · Supabase · TypeScript", type: "default" },
                    { text: "→ 6 production gaps found",                       type: "error"   },
                    { text: "✓ Score: 38/100 — all gaps are auto-fixable",      type: "success" },
                  ]}
                />
              )}
            </div>
          </div>
        )}

        {/* Step 3 — results + fix picker */}
        {(phase === "done" || phase === "generating" || phase === "pr_created") && (
          <div ref={resultRef}>
            <StepBadge n={3} label="Results — pick your fixes" />

            <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
              {/* score ring */}
              <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-4">
                <ScoreRing score={score} />
                <div className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
                  current
                </div>
              </div>

              {/* issues list */}
              <div className="space-y-2">
                {issues.map((issue) => {
                  const meta = SEVERITY_META[issue.severity];
                  return (
                    <label
                      key={issue.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition hover:border-primary/40 ${issue.checked ? "border-primary/30" : "border-border"}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        checked={issue.checked}
                        onChange={() => toggleIssue(issue.id)}
                        disabled={phase === "generating" || phase === "pr_created"}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{issue.title}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${meta.bg} ${meta.color} ${meta.ring}`}
                          >
                            {meta.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {issue.icon}
                            {issue.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            saves ~{issue.timeSaved}
                          </span>
                          <code className="text-[10px]">{issue.fix}</code>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* summary + generate button */}
            {checkedCount > 0 && phase !== "pr_created" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-card px-5 py-4">
                <div className="flex flex-wrap gap-6 text-sm">
                  <span>
                    <span className="font-semibold text-primary">{checkedCount}</span>
                    <span className="text-muted-foreground"> fix{checkedCount !== 1 ? "es" : ""} selected</span>
                  </span>
                  <span>
                    <span className="font-semibold text-success">~{timeSaved.toFixed(1)}h</span>
                    <span className="text-muted-foreground"> saved</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-semibold">{score}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-semibold text-success">{Math.min(score + checkedCount * 9, 95)}</span>
                    <span className="text-muted-foreground">score</span>
                  </span>
                </div>
                <button
                  id="generate-pr-btn"
                  onClick={generatePR}
                  disabled={phase === "generating"}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-60 glow-primary"
                >
                  {phase === "generating" ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Generating PR…
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="h-4 w-4" /> Generate PR
                    </>
                  )}
                </button>
              </div>
            )}

            {phase === "pr_created" && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-5 py-4">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-success">PR #42 opened</span>
                  <span className="text-muted-foreground ml-2">
                    launchready/production-ready-2025-06-06 · ~{timeSaved.toFixed(1)}h saved
                  </span>
                </div>
                <button
                  onClick={() => setShowPR(true)}
                  className="ml-auto text-xs text-primary hover:underline shrink-0"
                >
                  View details →
                </button>
              </div>
            )}
          </div>
        )}

        {/* idle placeholder */}
        {phase === "idle" && (
          <div className="rounded-2xl border border-border bg-card p-8">
            <p className="text-xs uppercase tracking-widest text-primary mb-6">What you'll find</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { icon: <Workflow className="h-4 w-4" />, label: "CI/CD",        text: "Missing GitHub Actions pipelines" },
                { icon: <TestTube2 className="h-4 w-4" />, label: "Testing",     text: "No test runner or config" },
                { icon: <Shield className="h-4 w-4" />,    label: "Security",    text: "Exposed secrets, no .env.example" },
                { icon: <Boxes className="h-4 w-4" />,     label: "Deployment",  text: "No Dockerfile or deploy config" },
                { icon: <FileCode2 className="h-4 w-4" />, label: "Code quality", text: "Missing lint and format setup" },
                { icon: <Activity className="h-4 w-4" />,  label: "Monitoring",  text: "Zero error tracking" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</div>
                    <div className="mt-0.5 text-sm">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Hit <span className="text-foreground font-medium">Run Scan</span> above to see every gap — and get a PR that fixes all of it.
            </p>
          </div>
        )}

        {/* bottom CTA */}
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="font-display text-2xl font-semibold">
            Ready to run this on <em>your</em> repo?
          </h2>
          <p className="mt-2 text-muted-foreground">
            One-click GitHub OAuth. First scan is free. No credit card needed.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              id="connect-github-cta"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary hover:opacity-90 transition"
            >
              <GithubIcon className="h-4 w-4" /> Connect GitHub
            </Link>
            <Link
              to="/workflow"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:bg-muted transition"
            >
              How it works <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-bold text-primary">
        {n}
      </div>
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
