import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import {
  GithubIcon,
  Activity,
  CheckCircle2,
  GitPullRequest,
  ShieldCheck,
  Lock,
  Eye,
  Zap,
  TestTube2,
  Workflow,
  FileCode2,
  Boxes,
  ArrowRight,
  AlertCircle,
  GitBranch,
  Search,
  BarChart3,
  Coins,
} from "lucide-react";

export const Route = createFileRoute("/workflow")({
  head: () => ({ meta: [{ title: "How it works — LaunchReady" }] }),
  component: WorkflowPage,
});

function WorkflowPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-primary">How it works</p>
          <h1 className="mt-3 font-display text-4xl font-bold">The LaunchReady workflow</h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            From connecting your repo to getting a production-ready pull request — here's exactly
            what happens at each step.
          </p>
        </div>

        <div className="mt-16 space-y-16">
          <Step
            number="01"
            icon={<GithubIcon className="h-6 w-6" />}
            title="Connect your GitHub account"
            summary="One-click OAuth. We only request the permissions we need — nothing more."
          >
            <DetailSection title="What happens">
              <p>
                You click <strong>Connect GitHub</strong> and get redirected to GitHub's OAuth page.
                GitHub asks you to authorize LaunchReady. Once you approve, we receive an access
                token scoped only to what we need.
              </p>
            </DetailSection>
            <DetailSection title="Permissions we request">
              <ul className="space-y-2">
                <PermRow
                  icon={<Eye className="h-4 w-4 text-primary" />}
                  label="read:user"
                  desc="Read your username and avatar so we can display your profile."
                />
                <PermRow
                  icon={<Eye className="h-4 w-4 text-primary" />}
                  label="repo"
                  desc="Read your repository contents, file tree, and metadata — so we can scan for missing setup."
                />
                <PermRow
                  icon={<GitBranch className="h-4 w-4 text-success" />}
                  label="write (branches + PRs only)"
                  desc="Create a new branch and open a pull request when you confirm a fix. We never push to your default branch."
                />
              </ul>
            </DetailSection>
            <DetailSection title="What we never do">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {[
                  "Push commits to main or any existing branch",
                  "Store your source code on our servers",
                  "Read private repos you haven't selected",
                  "Share your data with third parties",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {x}
                  </li>
                ))}
              </ul>
            </DetailSection>
            <Callout icon={<Lock className="h-4 w-4" />} color="primary">
              You can revoke access at any time from GitHub → Settings → Applications → Authorized
              OAuth Apps.
            </Callout>
          </Step>

          <Step
            number="02"
            icon={<Activity className="h-6 w-6" />}
            title="Scan your repository"
            summary="We analyze your repo's file tree and config files to produce a 0–100 production readiness score."
          >
            <DetailSection title="What the scanner checks">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  {
                    icon: <Workflow className="h-4 w-4 text-primary" />,
                    label: "CI/CD",
                    desc: "GitHub Actions workflows, build pipelines",
                  },
                  {
                    icon: <TestTube2 className="h-4 w-4 text-warning" />,
                    label: "Testing",
                    desc: "Vitest, Jest, Playwright, test coverage config",
                  },
                  {
                    icon: <FileCode2 className="h-4 w-4 text-accent" />,
                    label: "Code quality",
                    desc: "ESLint, Prettier, TypeScript strict mode",
                  },
                  {
                    icon: <ShieldCheck className="h-4 w-4 text-success" />,
                    label: "Security",
                    desc: ".env.example, secret scanning, dependency audit",
                  },
                  {
                    icon: <Boxes className="h-4 w-4 text-primary" />,
                    label: "Deployment",
                    desc: "Dockerfile, .dockerignore, deploy configs",
                  },
                  {
                    icon: <Activity className="h-4 w-4 text-warning" />,
                    label: "Monitoring",
                    desc: "Error tracking config, logging setup",
                  },
                ].map((c) => (
                  <div
                    key={c.label}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm"
                  >
                    {c.icon}
                    <div>
                      <div className="font-medium">{c.label}</div>
                      <div className="text-xs text-muted-foreground">{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </DetailSection>
            <DetailSection title="How the score is calculated">
              <p>
                Each missing item carries a severity weight —{" "}
                <span className="text-critical font-medium">Critical</span> issues (like no CI)
                deduct more points than{" "}
                <span className="text-muted-foreground font-medium">Low</span> ones. The final score
                is a weighted sum from 0 to 100. A score above 80 means your repo has the essential
                production setup in place.
              </p>
            </DetailSection>
            <DetailSection title="What you see after a scan">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {[
                  "A readiness score ring (0–100)",
                  "Every missing item grouped by category",
                  "A severity badge (Critical / High / Medium / Low) on each issue",
                  "An estimated time-saved per fix",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {x}
                  </li>
                ))}
              </ul>
            </DetailSection>
            <Callout icon={<BarChart3 className="h-4 w-4" />} color="accent">
              Scans are fast — typically under 5 seconds. Re-scan any time after you merge fixes to
              see your score improve.
            </Callout>
          </Step>

          <Step
            number="03"
            icon={<CheckCircle2 className="h-6 w-6" />}
            title="Pick your fixes"
            summary="Choose exactly what goes into the pull request. Everything is opt-in — you're always in control."
          >
            <DetailSection title="Template fixes (always free)">
              <p className="mb-3">
                These are pre-written, best-practice config files. No AI is involved — they're
                generated from a curated template library and adapted to your detected stack.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  "GitHub Actions CI workflow",
                  "ESLint + Prettier config",
                  "Express security (Helmet + rate limit)",
                  "Winston logging setup",
                  ".env.example",
                  "README setup section",
                ].map((x) => (
                  <div
                    key={x}
                    className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{x}</span>
                    <span className="ml-auto text-[10px] font-medium text-success">Free</span>
                  </div>
                ))}
              </div>
            </DetailSection>
            <DetailSection title="AI fixes (require credits)">
              <p className="mb-3">
                AI-generated fixes use Claude to write test files and smart configurations tailored
                to your actual codebase — not generic templates. Each fix costs a small number of
                credits.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { label: "Vitest test generation", cost: 1 },
                  { label: "Playwright E2E tests", cost: 2 },
                  { label: "API route tests", cost: 2 },
                  { label: "Architecture analysis", cost: 3 },
                ].map((x) => (
                  <div
                    key={x.label}
                    className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span>{x.label}</span>
                    <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-accent">
                      <Coins className="h-3 w-3" />
                      {x.cost}cr
                    </span>
                  </div>
                ))}
              </div>
            </DetailSection>
            <DetailSection title="Before you confirm">
              <p>
                On the fix preview page you'll see a full diff for every file that will be added or
                changed, the exact branch name that will be created, and the total credit cost.
                Nothing is submitted until you click <strong>Generate PR</strong>.
              </p>
            </DetailSection>
          </Step>

          <Step
            number="04"
            icon={<GitPullRequest className="h-6 w-6" />}
            title="Review and merge your PR"
            summary="LaunchReady creates a branch and opens a pull request. You review it on GitHub exactly like any other PR."
          >
            <DetailSection title="What gets created">
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  {
                    icon: <GitBranch className="h-4 w-4 text-primary" />,
                    text: "A new branch named launchready/production-ready-YYYY-MM-DD — never touching main.",
                  },
                  {
                    icon: <GitPullRequest className="h-4 w-4 text-primary" />,
                    text: "A pull request with a description listing every file added and dependency installed.",
                  },
                  {
                    icon: <FileCode2 className="h-4 w-4 text-accent" />,
                    text: "All selected config files, workflows, and AI-generated test files committed to that branch.",
                  },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-start gap-2.5">
                    {icon}
                    {text}
                  </li>
                ))}
              </ul>
            </DetailSection>
            <DetailSection title="Your review checklist">
              <ol className="space-y-3 text-sm">
                {[
                  {
                    n: "1",
                    t: "Open the PR on GitHub",
                    d: "Click the PR link on the job page. Review the diff just as you would any teammate's PR.",
                  },
                  {
                    n: "2",
                    t: "Run the new CI workflow",
                    d: "The GitHub Actions workflow we added will trigger automatically. Watch it pass before merging.",
                  },
                  {
                    n: "3",
                    t: "Check the test files",
                    d: "If you chose AI test generation, glance through the generated tests. Add assertions if anything is missing.",
                  },
                  {
                    n: "4",
                    t: "Merge to main",
                    d: "Once CI is green and you're happy with the diff, merge. Your repo's readiness score will go up on the next scan.",
                  },
                ].map((s) => (
                  <li
                    key={s.n}
                    className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
                  >
                    <span className="font-display text-lg font-bold text-primary/40">{s.n}</span>
                    <div>
                      <div className="font-medium">{s.t}</div>
                      <div className="mt-0.5 text-muted-foreground">{s.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </DetailSection>
            <Callout icon={<AlertCircle className="h-4 w-4" />} color="warning">
              Demo mode: GitHub integration is currently mocked. A real PR won't be created yet, but
              you can see exactly what it would look like on the job page.
            </Callout>
          </Step>
        </div>

        <div className="mt-20 rounded-2xl border border-primary/15 bg-card p-10 text-center">
          <h2 className="font-display text-2xl font-semibold">
            Ready to make your repo production-ready?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Connect GitHub and run your first free scan in under a minute.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition cursor-pointer"
          >
            <GithubIcon className="h-4 w-4" /> Connect GitHub
          </Link>
        </div>
      </div>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  summary,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-mt-24" id={`step-${number}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          {icon}
        </div>
        <div>
          <p className="font-mono text-xs text-muted-foreground">{number}</p>
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
        </div>
      </div>
      <p className="mt-3 text-muted-foreground">{summary}</p>
      <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-6">{children}</div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      <div className="text-sm text-foreground/90 leading-relaxed">{children}</div>
    </div>
  );
}

function PermRow({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 text-sm">
      {icon}
      <div>
        <code className="font-mono font-medium">{label}</code>
        <p className="mt-0.5 text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}

function Callout({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: "primary" | "accent" | "warning";
  children: React.ReactNode;
}) {
  const colors = {
    primary: "border-primary/30 bg-primary/5 text-primary",
    accent: "border-accent/30 bg-accent/5 text-accent",
    warning: "border-warning/30 bg-warning/5 text-warning",
  };
  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${colors[color]}`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
