import { PLANS, type PlanId } from "./plans";

/** Estimated $ cost per LaunchReadyy AI credit consumed. Tune via AI_COST_PER_CREDIT. */
export function aiCostPerCredit(): number {
  const raw = process.env.AI_COST_PER_CREDIT ?? process.env.CURSOR_COST_PER_CREDIT;
  const n = raw ? Number.parseFloat(raw) : 0.25;
  return Number.isFinite(n) && n > 0 ? n : 0.25;
}

export function activeAiProvider(): string {
  return (process.env.AI_PROVIDER ?? "deepseek").toLowerCase();
}

export function estimateAiCost(creditsUsed: number): number {
  return Math.round(creditsUsed * aiCostPerCredit() * 100) / 100;
}

export function planRevenuePerCredit(planId: PlanId): number {
  const plan = PLANS[planId];
  if (plan.priceUsd === 0 || plan.aiCreditsPerMonth === 0) return 0;
  return plan.priceUsd / plan.aiCreditsPerMonth;
}

export function creditUsagePct(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
