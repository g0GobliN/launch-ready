import { Link } from "@tanstack/react-router";
import { X, Zap, Check, Loader2, AlertCircle } from "lucide-react";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";
import { createCheckoutSessionFn } from "@/lib/api/stripe.functions";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason: "scan" | "repo" | "credits" | "arch" | "ai-fixes";
  currentPlan: PlanId;
}

const REASON_COPY: Record<UpgradeModalProps["reason"], { title: string; description: string; minPlan: PlanId }> = {
  scan:     { title: "Monthly scan limit reached",       description: "You've used all your scans for this month. Upgrade to scan more repositories.",          minPlan: "starter" },
  repo:     { title: "Repository limit reached",         description: "You've reached the maximum number of repositories on your current plan.",                 minPlan: "starter" },
  credits:  { title: "Insufficient AI credits",          description: "You don't have enough AI credits to run this fix. Upgrade to get more credits per month.", minPlan: "starter" },
  arch:     { title: "Architecture analysis is Pro+",    description: "Deep architecture scanning with AI explanations is available on the Pro plan and above.",   minPlan: "pro"     },
  "ai-fixes": { title: "AI fixes require Starter+",      description: "AI-generated test files and smart fixes are available from the Starter plan.",             minPlan: "starter" },
};

export function UpgradeModal({ open, onClose, reason, currentPlan }: UpgradeModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

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

  const copy = REASON_COPY[reason];
  const relevantPlans = PLAN_ORDER.filter(
    (id) => PLAN_ORDER.indexOf(id) >= PLAN_ORDER.indexOf(copy.minPlan),
  ).map((id) => PLANS[id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 pb-4">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold">{copy.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{copy.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-3">
          {relevantPlans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const isHighlighted = plan.highlighted;
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-4 ${
                  isHighlighted
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-surface"
                } ${isCurrent ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold">{plan.name}</span>
                  {isCurrent && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Current</span>}
                  {isHighlighted && !isCurrent && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">Popular</span>}
                </div>
                <div className="mt-1">
                  {plan.priceYen === 0 ? (
                    <span className="font-display text-xl font-bold">Free</span>
                  ) : (
                    <span className="font-display text-xl font-bold">¥{plan.priceYen.toLocaleString()}<span className="text-xs font-normal text-muted-foreground">/mo</span></span>
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <button
                    disabled={loadingPlan === plan.id}
                    onClick={() => handleUpgrade(plan.id)}
                    className={`mt-4 w-full rounded-md py-1.5 text-center text-xs font-medium transition disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer ${
                      isHighlighted
                        ? "bg-primary text-primary-foreground hover:opacity-90"
                        : "border border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" /> Redirecting…
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
            <Button variant="outline" onClick={() => setErrorMsg(null)}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
