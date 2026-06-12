import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { getUserPlanFn } from "@/lib/api/credits.functions";
import { createCheckoutSessionFn } from "@/lib/api/stripe.functions";
import { Check, Zap, Loader2, AlertCircle } from "lucide-react";
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

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — LaunchReadyy" }] }),
  loader: () => getUserPlanFn().catch(() => null),
  component: PricingPage,
});

const FEATURE_ROWS = [
  { label: "Repositories", free: "1", starter: "Unlimited", pro: "Unlimited", agency: "Unlimited" },
  { label: "Scans / month", free: "3", starter: "20", pro: "100", agency: "500" },
  { label: "AI credits", free: "3 trial", starter: "15 / mo", pro: "60 / mo", agency: "200 / mo" },
  { label: "Template fixes", free: "✓", starter: "✓", pro: "✓", agency: "✓" },
  { label: "AI-generated fixes", free: "Trial", starter: "✓", pro: "✓", agency: "✓" },
  { label: "Architecture analysis", free: "—", starter: "—", pro: "✓", agency: "✓" },
  { label: "Job history", free: "—", starter: "✓", pro: "✓", agency: "✓" },
  { label: "Advanced reports", free: "—", starter: "—", pro: "✓", agency: "✓" },
  { label: "Priority processing", free: "—", starter: "—", pro: "✓", agency: "✓" },
  { label: "Team dashboard", free: "—", starter: "—", pro: "—", agency: "✓" },
];

function PricingPage() {
  const planData = Route.useLoaderData();
  const currentPlan = planData?.plan ?? "free";
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold">Simple, transparent pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Built for indie developers, vibe coders, and solo founders. Pay only for what you use.
          </p>
        </div>

        {/* Plan cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = planId === currentPlan;
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
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="rounded-full border border-border bg-card px-3 py-0.5 text-xs text-muted-foreground">
                      Current plan
                    </span>
                  </div>
                )}

                <div className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  {plan.name}
                </div>
                <div className="mt-2 cursor-pointer">
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
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isCurrent ? (
                    <div className="w-full rounded-md border border-border bg-background py-2 text-center text-sm text-muted-foreground">
                      Current plan
                    </div>
                  ) : planId === "free" ? (
                    <Link
                      to="/dashboard"
                      className="block w-full rounded-md border border-border bg-background py-2 text-center text-sm font-medium hover:bg-muted transition cursor-pointer"
                    >
                      Get started free
                    </Link>
                  ) : (
                    <button
                      disabled={loadingPlan === planId}
                      className={`w-full rounded-md py-2 text-sm font-medium transition disabled:opacity-70 cursor-pointer disabled:cursor-not-allowed ${
                        plan.highlighted
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "border border-border bg-background hover:bg-muted"
                      }`}
                      onClick={async () => {
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
                      }}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        {loadingPlan === planId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        {loadingPlan === planId ? "Loading…" : `Upgrade to ${plan.name}`}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Credit costs breakdown */}
        <div className="mt-16">
          <h2 className="font-display text-xl font-semibold">AI credit costs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Template fixes are always free. AI credits are consumed only when AI generates content.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "GitHub Actions CI (template)", cost: 0 },
              { label: "Setup instructions (template)", cost: 0 },
              { label: ".env.example (template)", cost: 0 },
              { label: "CI workflow — AI-tailored", cost: 1 },
              { label: "README setup — AI-written", cost: 1 },
              { label: ".env.example — AI-scanned", cost: 1 },
              { label: "ESLint config", cost: 0 },
              { label: "Express security (Helmet + rate limit)", cost: 0 },
              { label: "Express logging (Winston)", cost: 0 },
              { label: "Vitest test generation", cost: 2 },
              { label: "Playwright E2E tests", cost: 3 },
              { label: "API route tests", cost: 3 },
              { label: "Architecture analysis", cost: 3 },
            ].map(({ label, cost }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm"
              >
                <span className="text-muted-foreground">{label}</span>
                {cost === 0 ? (
                  <span className="font-medium text-success">Free</span>
                ) : (
                  <span className="font-medium">{cost} cr</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Feature comparison table */}
        <div className="mt-16">
          <h2 className="font-display text-xl font-semibold">Full comparison</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left font-medium text-muted-foreground">Feature</th>
                  {PLAN_ORDER.map((id) => (
                    <th
                      key={id}
                      className={`pb-3 text-center font-medium ${id === currentPlan ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {PLANS[id].name}
                      {id === currentPlan && <span className="ml-1 text-[10px]">●</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-surface/50">
                    <td className="py-3 pr-4 text-muted-foreground">{row.label}</td>
                    {PLAN_ORDER.map((id) => {
                      const val = row[id as keyof typeof row];
                      const isCheck = val === "✓";
                      const isDash = val === "—";
                      return (
                        <td key={id} className="py-3 text-center">
                          {isCheck ? (
                            <Check className="mx-auto h-4 w-4 text-success" />
                          ) : isDash ? (
                            <span className="text-muted-foreground/40">—</span>
                          ) : (
                            <span
                              className={id === currentPlan ? "font-semibold text-foreground" : ""}
                            >
                              {val}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Dialog open={!!errorMsg} onOpenChange={() => setErrorMsg(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Unable to continue
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">{errorMsg}</DialogDescription>
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
    </div>
  );
}
