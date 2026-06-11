import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { createCheckoutSessionFn } from "@/lib/api/stripe.functions";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  GitPullRequest,
  GithubIcon,
  Shield,
  TestTube2,
  Workflow,
  FileCode2,
  Boxes,
  Activity,
  Sparkles,
  Zap,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LaunchReadyy — Turn your AI-built app into a production-ready project" },
      {
        name: "description",
        content:
          "Connect your GitHub repo, find missing engineering setup, and ship production-ready pull requests in one click.",
      },
      { property: "og:title", content: "LaunchReadyy — Production-ready PRs for AI-built apps" },
      {
        property: "og:description",
        content:
          "Cursor and other AI tools build the first 80%. LaunchReadyy finishes the boring production setup.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <WhatWeCheck />
      <Pricing />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/50">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            For Cursor, Bolt & Copilot builders
          </div>
          <h1 className="text-balance font-display text-5xl font-semibold leading-[1.05] sm:text-6xl md:text-7xl">
            Your AI built the app. <span className="text-gradient">LaunchReadyy</span> adds the
            production foundation.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Scan your repo for missing CI, tests, env docs, and deployment basics — then open a PR
            with the boring setup your project still needs.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground glow-primary transition hover:opacity-90"
            >
              <GithubIcon className="h-4 w-4" /> Connect GitHub
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              View Demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            No credit card · 1 free repo scan · Open source friendly
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div className="rounded-xl border border-border bg-card/80 p-2 shadow-2xl shadow-primary/5 backdrop-blur">
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-critical/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          <div className="ml-3 font-mono text-xs text-muted-foreground">
            launchreadyy.xyz/repo/indie-saas
          </div>
        </div>
        <div className="grid gap-4 rounded-lg bg-background p-6 md:grid-cols-[200px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-4">
            <div className="font-display text-5xl font-semibold text-warning">62</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Readiness
            </div>
          </div>
          <div className="space-y-2">
            {[
              { t: "GitHub Actions CI not configured", s: "Critical", c: "text-critical" },
              { t: "Vitest unit tests missing", s: "High", c: "text-warning" },
              { t: ".env.example not committed", s: "High", c: "text-warning" },
              { t: "No Dockerfile for deployment", s: "Medium", c: "text-accent" },
              { t: "ESLint config not found", s: "High", c: "text-warning" },
            ].map((i) => (
              <div
                key={i.t}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
              >
                <span>{i.t}</span>
                <span className={`text-[10px] font-medium uppercase tracking-wider ${i.c}`}>
                  {i.s}
                </span>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                <GitPullRequest className="h-3.5 w-3.5" /> Create PR with 5 fixes
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Problem() {
  return (
    <section className="border-b border-border/50 py-24">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <p className="text-xs uppercase tracking-widest text-primary">The problem</p>
        <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
          AI ships features.{" "}
          <span className="text-muted-foreground">Nobody ships the boring stuff.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          AI tools build the first 80% — a working app. The last 20% — CI, tests, env files,
          monitoring, Docker — is what makes it actually shippable. That part rarely gets done.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { n: "73%", t: "of AI-built repos have no CI" },
            { n: "0", t: "tests in the average vibe-coded SaaS" },
            { n: "12h", t: "saved per repo with one PR" },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border border-border bg-card p-6">
              <div className="font-display text-4xl font-semibold text-primary">{s.n}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      i: <GithubIcon className="h-5 w-5" />,
      t: "Connect GitHub",
      d: "One-click OAuth. We only read your repos — no surprise commits.",
    },
    {
      i: <Activity className="h-5 w-5" />,
      t: "Scan repo",
      d: "We check your real files and produce a 0–100 foundation score.",
    },
    {
      i: <CheckCircle2 className="h-5 w-5" />,
      t: "Pick fixes",
      d: "Choose what to add: Vitest, CI, Docker, monitoring, and more.",
    },
    {
      i: <GitPullRequest className="h-5 w-5" />,
      t: "Get a PR",
      d: "A clean pull request lands on a new branch. Review and merge.",
    },
  ];
  return (
    <section id="how" className="border-b border-border/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            From repo to production-ready in 4 steps
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.t} className="relative rounded-xl border border-border bg-card p-6">
              <div className="font-mono text-xs text-muted-foreground">0{i + 1}</div>
              <div className="mt-3 grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
                {s.i}
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const fs = [
    { i: <TestTube2 />, t: "Testing setup", d: "Vitest + Playwright wired up with sample tests." },
    { i: <Workflow />, t: "GitHub Actions CI", d: "Lint, typecheck, and tests on every push." },
    {
      i: <Shield />,
      t: "Security baseline",
      d: ".env.example, secret scanning hints, dependency audit.",
    },
    { i: <FileCode2 />, t: "Code quality", d: "ESLint + Prettier with sensible team defaults." },
    { i: <Boxes />, t: "Deployment", d: "Dockerfile and deploy guides for Vercel, Fly, Railway." },
    { i: <Activity />, t: "Monitoring", d: "Sentry error tracking with one config file." },
  ];
  return (
    <section id="features" className="border-b border-border/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-widest text-primary">What you get</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
            Everything senior engineers add on day one.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {fs.map((f) => (
            <div
              key={f.t}
              className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary/40"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-surface text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                {f.i}
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatWeCheck() {
  const checks = [
    "GitHub Actions CI workflow",
    ".env.example and README setup section",
    "Vitest + Playwright test scaffolding",
    "ESLint, Prettier, Dockerfile",
    "Sentry monitoring stub (frontend stacks)",
    "Express security: Helmet, rate limits, logging",
    "Next.js error boundary (error.tsx)",
  ];
  const notChecks = [
    "Security audit of your business logic",
    "Performance, scale, or compliance review",
    "Custom documentation for your entire codebase",
    "Guarantee your app is safe to launch tomorrow",
  ];
  return (
    <section id="coverage" className="border-b border-border/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-widest text-primary">Honest scope</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            What we check — and what we don&apos;t
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            LaunchReadyy automates the first-mile production setup indie builders skip. It is a
            checklist scanner, not a full audit.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <h3 className="font-display font-semibold text-primary">We check</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {checks.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Full framework rules for Next.js, Vite, React, and Express. Other JS repos get shared
              checks only.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold">We don&apos;t</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {notChecks.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <span className="text-muted-foreground/60 mt-0.5">—</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleUpgrade(planId: string) {
    setLoadingPlan(planId);
    try {
      const { url } = await createCheckoutSessionFn({
        data: { planId: planId as "starter" | "pro" | "agency" },
      });
      window.location.href = url;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setLoadingPlan(null);
    }
  }

  return (
    <section id="pricing" className="border-b border-border/50 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <p className="text-xs uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            Simple, builder-friendly pricing
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built for indie developers, vibe coders, and solo founders.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            return (
              <div
                key={planId}
                className={`relative rounded-2xl border p-6 ${
                  plan.highlighted
                    ? "border-primary/50 bg-primary/5 shadow-lg"
                    : "border-border bg-card"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                      Most popular
                    </span>
                  </div>
                )}
                <div className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {plan.name}
                </div>
                <div className="mt-2">
                  {plan.priceUsd === 0 ? (
                    <span className="font-display text-3xl font-bold">Free</span>
                  ) : (
                    <>
                      <span className="font-display text-3xl font-bold">${plan.priceUsd}</span>
                      <span className="ml-1 text-sm text-muted-foreground">/ month</span>
                    </>
                  )}
                </div>
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.priceUsd === 0 ? (
                  <Link
                    to="/dashboard"
                    className="mt-6 block w-full rounded-md border border-border bg-background py-2 text-center text-sm font-medium transition hover:bg-muted cursor-pointer"
                  >
                    Get started free
                  </Link>
                ) : (
                  <button
                    disabled={loadingPlan === planId}
                    onClick={() => handleUpgrade(planId)}
                    className={`mt-6 w-full rounded-md py-2 text-sm font-medium transition cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${
                      plan.highlighted
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {loadingPlan === planId ? (
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting…
                      </span>
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            View full plan comparison <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <Dialog open={!!errorMsg} onOpenChange={() => setErrorMsg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Unable to continue
            </DialogTitle>
            <DialogDescription>{errorMsg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorMsg(null)}>
              Dismiss
            </Button>
            {errorMsg === "Not authenticated" && (
              <Button onClick={() => (window.location.href = "/api/auth/github")}>
                Sign in with GitHub
              </Button>
            )}
            {errorMsg?.includes("billing portal") && (
              <Button onClick={() => (window.location.href = "/settings")}>Go to Settings</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FAQ() {
  const qs = [
    {
      q: "Will LaunchReadyy push to my main branch?",
      a: "Never. We always create a new branch and open a pull request for you to review. You stay in full control — nothing merges without your approval.",
    },
    {
      q: "What permissions does the GitHub App need?",
      a: "Read access to repo contents and write access for branches & pull requests on the repos you select. We request the minimum permissions required and never access repos you haven't connected.",
    },
    {
      q: "Does it work with Next.js, Vite, and Express?",
      a: "Yes — those stacks get full framework-specific checks. Other JavaScript repos still get shared checks (CI, README, .env.example, Dockerfile, etc.).",
    },
    {
      q: "Does the score mean my app is production ready?",
      a: "It measures production foundation checklist coverage (CI, tests, docs, deployment basics) — starting at 100 and subtracting by issue severity. It is not a security or launch guarantee.",
    },
    {
      q: "Can I use it on private repos?",
      a: "Pro and Agency plans support private repositories. Free plan is limited to public repos.",
    },
    {
      q: "Is my code ever stored?",
      a: "No. We analyze repo metadata and configs in-memory — code is never persisted to our servers or databases.",
    },
  ];
  return (
    <section id="faq" className="border-b border-border/50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            Questions, answered
          </h2>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {qs.map((x) => (
            <details key={x.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {x.q}
                <span className="text-muted-foreground transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{x.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
      <div className="relative mx-auto max-w-4xl rounded-2xl border border-primary/15 bg-card p-10 text-center">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">
          Ship the boring setup in one PR.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          CI, tests, env docs, Docker — the foundation senior engineers add on day one.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <GithubIcon className="h-4 w-4" /> Connect GitHub
          </Link>
          <Link
            to="/demo"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Zap className="h-4 w-4" /> Try the demo
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> 12h saved per repo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" /> Read-only by default
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GitPullRequest className="h-3.5 w-3.5" /> PR-first workflow
          </span>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-xs text-muted-foreground sm:flex-row">
        <div>© {new Date().getFullYear()} LaunchReadyy</div>
        <div className="flex gap-4">
          <Link to="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
