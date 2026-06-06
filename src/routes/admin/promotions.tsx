import { createFileRoute } from "@tanstack/react-router";
import { loadAdminRevenueFn, runPromotionFn } from "@/lib/api/admin.functions";
import { PLANS } from "@/lib/plans";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/promotions")({
  head: () => ({ meta: [{ title: "Promotions — Admin" }] }),
  loader: () => loadAdminRevenueFn({ data: { months: 1 } }),
  component: AdminPromotions,
});

type PaidPlanId = "starter" | "pro" | "agency";

const PLAN_COLORS: Record<PaidPlanId, string> = { starter: "#22c55e", pro: "#3b82f6", agency: "#f59e0b" };

function AdminPromotions() {
  const { planRevenue } = Route.useLoaderData();

  const totalPaid = planRevenue.reduce((s, p) => s + p.users, 0);

  const [promoType, setPromoType] = useState<"bonus_credits" | "reset_scans">("bonus_credits");
  const [promoPlan, setPromoPlan] = useState<string>("all");
  const [promoAmount, setPromoAmount] = useState("10");
  const [promoNote, setPromoNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ affected: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function affectedCount() {
    if (promoPlan === "all") return totalPaid;
    const displayName = PLANS[promoPlan as PaidPlanId]?.name;
    return planRevenue.find((p) => p.plan === displayName)?.users ?? 0;
  }

  async function runPromotion() {
    setRunning(true);
    setError(null);
    try {
      const res = await runPromotionFn({
        data: {
          plan: promoPlan,
          type: promoType,
          amount: promoType === "bonus_credits" ? parseInt(promoAmount, 10) : undefined,
          note: promoNote,
        },
      });
      setResult(res);
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  }

  const canSubmit = affectedCount() > 0 && (promoType !== "bonus_credits" || (!!promoAmount && parseInt(promoAmount) >= 1));

  const planTargets = [
    { value: "all",     label: "All paid", count: totalPaid,                                                                                    color: undefined },
    { value: "starter", label: "Starter",  count: planRevenue.find((p) => p.plan === PLANS.starter.name)?.users ?? 0,  color: PLAN_COLORS.starter },
    { value: "pro",     label: "Pro",      count: planRevenue.find((p) => p.plan === PLANS.pro.name)?.users ?? 0,      color: PLAN_COLORS.pro },
    { value: "agency",  label: "Agency",   count: planRevenue.find((p) => p.plan === PLANS.agency.name)?.users ?? 0,   color: PLAN_COLORS.agency },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold">Promotions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Reward paying users with bonus credits or a free scan reset.</p>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {/* Reward type */}
        <div className="p-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Reward type</p>
          <div className="flex gap-2">
            {([
              { value: "bonus_credits", label: "Bonus AI Credits" },
              { value: "reset_scans",   label: "Reset Scan Limit"  },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPromoType(opt.value)}
                className={`rounded-lg border px-4 py-2 text-sm transition cursor-pointer ${promoType === opt.value ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target */}
        <div className="p-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Target audience</p>
          <div className="flex flex-wrap gap-2">
            {planTargets.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPromoPlan(opt.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition cursor-pointer ${promoPlan === opt.value ? "border-primary bg-primary/10 text-foreground font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {opt.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />}
                {opt.label}
                <span className={`text-xs ${promoPlan === opt.value ? "text-primary/70" : "text-muted-foreground/50"}`}>{opt.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Details</p>
          <div className="flex flex-wrap gap-3">
            {promoType === "bonus_credits" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Credits per user</label>
                <Input
                  type="number"
                  min={1}
                  value={promoAmount}
                  onChange={(e) => setPromoAmount(e.target.value)}
                  className="h-9 w-32 text-sm"
                  placeholder="10"
                />
              </div>
            )}
            <div className="flex-1 min-w-48 space-y-1.5">
              <label className="text-xs text-muted-foreground">Note <span className="opacity-50">(optional)</span></label>
              <Input
                value={promoNote}
                onChange={(e) => setPromoNote(e.target.value)}
                placeholder="Shown in each user's credit history"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-muted/20">
          <p className="text-sm text-muted-foreground">
            {promoType === "bonus_credits"
              ? <><strong className="text-foreground">+{promoAmount || 0}</strong> AI credits each</>
              : <>Scan limit reset to <strong className="text-foreground">0</strong></>
            }
            {" · "}
            <strong className="text-foreground">{affectedCount()} users</strong> affected
          </p>
          <Button onClick={() => { setResult(null); setError(null); setConfirmOpen(true); }} disabled={!canSubmit}>
            Run Promotion
          </Button>
        </div>
      </div>

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirm promotion</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-2 text-sm text-muted-foreground">
            <p><strong className="text-foreground">{affectedCount()} users</strong> will be affected.</p>
            {promoType === "bonus_credits" && <p>Each receives <strong className="text-foreground">+{promoAmount} AI credits</strong>.</p>}
            {promoType === "reset_scans" && <p>Monthly scan usage reset to <strong className="text-foreground">0</strong>.</p>}
            {promoNote && <p className="text-xs">Note: "{promoNote}"</p>}
            {error && (
              <p className="flex items-center gap-1.5 text-destructive text-xs pt-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={running}>Cancel</Button>
            <Button onClick={runPromotion} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog open={!!result} onOpenChange={() => setResult(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Done</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Applied to <strong className="text-foreground">{result?.affected} users</strong>.</p>
          <DialogFooter><Button onClick={() => setResult(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
