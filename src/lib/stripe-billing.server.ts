import { PLANS, type PlanId } from "./plans";

export function stripePriceIds(): Record<"starter" | "pro" | "agency", string> {
  return {
    starter: process.env.STRIPE_PRICE_STARTER!,
    pro: process.env.STRIPE_PRICE_PRO!,
    agency: process.env.STRIPE_PRICE_AGENCY!,
  };
}

export const STRIPE_PRICE_IDS = stripePriceIds();

type StripeSubscriptionLike = {
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: { id?: string };
      plan?: { id?: string };
    }>;
  };
  plan?: { id?: string };
};

export function planIdFromStripePrice(priceId: string | undefined | null): PlanId | null {
  if (!priceId) return null;
  for (const [id, price] of Object.entries(stripePriceIds())) {
    if (price && price === priceId) return id as PlanId;
  }
  return null;
}

export function stripePriceIdFromSubscription(sub: StripeSubscriptionLike): string | null {
  const item = sub.items?.data?.[0];
  return item?.price?.id ?? item?.plan?.id ?? sub.plan?.id ?? null;
}

export function subscriptionPeriodIso(
  sub: StripeSubscriptionLike,
): { start: string; end: string } | null {
  const start = sub.current_period_start ?? sub.items?.data?.[0]?.current_period_start;
  const end = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  if (!start || !end) return null;
  return {
    start: new Date(start * 1000).toISOString(),
    end: new Date(end * 1000).toISOString(),
  };
}

export function buildPlanUpsertFields(
  planId: PlanId,
  sub?: StripeSubscriptionLike,
  opts?: { resetUsage?: boolean },
) {
  const plan = PLANS[planId];
  const period = sub ? subscriptionPeriodIso(sub) : null;
  const now = new Date();
  const fallbackEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const fields: Record<string, string | number> = {
    plan: planId,
    monthly_scan_limit: plan.scansPerMonth,
    ai_credits_total: plan.aiCreditsPerMonth,
    updated_at: now.toISOString(),
    current_period_start: period?.start ?? now.toISOString(),
    current_period_end: period?.end ?? fallbackEnd.toISOString(),
  };

  if (opts?.resetUsage) {
    fields.monthly_scan_used = 0;
    fields.balance = plan.aiCreditsPerMonth;
  }

  return fields;
}

export function subscriptionPlanChanged(
  sub: StripeSubscriptionLike,
  previousAttributes?: {
    items?: { data?: Array<{ price?: { id?: string }; plan?: { id?: string } }> };
    plan?: { id?: string };
  },
): boolean {
  const currentPrice = stripePriceIdFromSubscription(sub);
  const prevItem = previousAttributes?.items?.data?.[0];
  const prevPrice = prevItem?.price?.id ?? prevItem?.plan?.id ?? previousAttributes?.plan?.id;
  return !!(prevPrice && currentPrice && prevPrice !== currentPrice);
}
