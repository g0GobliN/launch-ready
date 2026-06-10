import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { loadDashboardFn } from "@/lib/api/github.functions";
import { createPortalSessionFn } from "@/lib/api/stripe.functions";
import { PLANS } from "@/lib/plans";
import {
  GithubIcon,
  CreditCard,
  User,
  Zap,
  ExternalLink,
  BarChart3,
  ShieldCheck,
  LogOut,
  Loader2,
  CheckCircle2,
  ArrowRight,
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

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — LaunchReadyy" }] }),
  loader: async () => {
    const data = await loadDashboardFn();
    if (!data.user) throw redirect({ to: "/dashboard" });
    return data;
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { user, planData } = Route.useLoaderData();

  const currentPlan = planData?.plan ?? "free";
  const planDef = PLANS[currentPlan];
  const scanPct = Math.min(
    100,
    ((planData?.monthlyScanUsed ?? 0) / (planData?.monthlyScanLimit ?? 3)) * 100,
  );
  const creditPct =
    planDef.aiCreditsPerMonth > 0
      ? Math.min(
          100,
          ((planData?.balance ?? 0) / (planData?.aiCreditsTotal ?? planDef.aiCreditsPerMonth)) *
            100,
        )
      : 0;

  return (
    <div className="min-h-screen">
      <SiteHeader user={user} />
      <div className="mx-auto max-w-3xl px-6 py-12 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your account, plan, and billing.
          </p>
        </div>

        {/* Account */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <User className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Account</h2>
          </div>
          <div className="flex items-center gap-4">
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt={user.login}
                className="h-14 w-14 rounded-full border border-border"
              />
            )}
            <div>
              <div className="font-semibold text-lg">@{user.login}</div>
              {user.email && <div className="text-sm text-muted-foreground">{user.email}</div>}
              <a
                href={`https://github.com/${user.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <GithubIcon className="h-3 w-3" /> View on GitHub{" "}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Sign out</div>
              <div className="text-xs text-muted-foreground">
                You can reconnect your GitHub at any time
              </div>
            </div>
            <a
              href="/api/auth/logout"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </a>
          </div>
        </section>

        {/* Plan & Usage */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Plan & Usage</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              {planDef.name}
            </span>
          </div>

          <div className="space-y-4">
            <UsageBar
              label="Scans this month"
              used={planData?.monthlyScanUsed ?? 0}
              limit={planData?.monthlyScanLimit ?? 3}
              pct={scanPct}
              color="bg-primary"
            />
            {planDef.aiCreditsPerMonth > 0 && (
              <UsageBar
                label="AI credits remaining"
                used={planData?.balance ?? 0}
                limit={planData?.aiCreditsTotal ?? planDef.aiCreditsPerMonth}
                pct={creditPct}
                color="bg-accent"
              />
            )}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Repositories</span>
              <span className="font-medium">Up to {planDef.repos}</span>
            </div>
          </div>

          {currentPlan === "free" && (
            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Upgrade for more scans & repos</div>
                <div className="text-xs text-muted-foreground mt-0.5">Starter from ¥980/month</div>
              </div>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition shrink-0"
              >
                View plans <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </section>

        {/* Billing */}
        {currentPlan !== "free" && (
          <BillingSection
            hasStripe={!!planData?.stripeCustomerId}
            planName={planDef.name}
            priceUsd={planDef.priceUsd}
            periodEnd={planData?.currentPeriodEnd ?? null}
            cancelAt={planData?.subscriptionCancelAt ?? null}
          />
        )}

        {/* Security */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Security & permissions</h2>
          </div>
          <div className="space-y-3 text-sm">
            {[
              "Read access to your repositories",
              "Write access for branches and pull requests only on selected repos",
              "We never commit to your main branch",
              "Your code is never stored — analyzed in-memory only",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  pct,
  color,
}: {
  label: string;
  used: number;
  limit: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function BillingSection({
  hasStripe,
  planName,
  priceUsd,
  periodEnd,
  cancelAt,
}: {
  hasStripe: boolean;
  planName: string;
  priceUsd: number;
  periodEnd: string | null;
  cancelAt: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    try {
      const { url } = await createPortalSessionFn();
      window.location.href = url;
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Could not open billing portal");
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <CreditCard className="h-4 w-4 text-primary" />
        <h2 className="font-display font-semibold">Billing</h2>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current plan</span>
          <span className="font-semibold">{planName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold">${priceUsd} / month</span>
        </div>
        {periodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {cancelAt ? "Access until" : "Next billing date"}
            </span>
            <span className="font-semibold">
              {new Date(cancelAt ?? periodEnd).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        )}
      </div>

      {cancelAt && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-yellow-600 dark:text-yellow-400">
              Subscription cancelled
            </p>
            <p className="text-muted-foreground mt-0.5">
              You have full access until{" "}
              {new Date(cancelAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
              . After that your account moves to the Free plan.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {hasStripe ? (
          <>
            <button
              onClick={openPortal}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {loading ? "Opening portal…" : "Manage billing"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Update payment method, view invoices, or cancel — all in the Stripe billing portal.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            Billing managed externally. Contact support if you need help.
          </p>
        )}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
