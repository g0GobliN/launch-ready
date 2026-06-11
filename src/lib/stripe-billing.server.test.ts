import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  planIdFromStripePrice,
  stripePriceIdFromSubscription,
  subscriptionPeriodIso,
  subscriptionPlanChanged,
} from "./stripe-billing.server";

const envBackup = {
  STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER,
  STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO,
  STRIPE_PRICE_AGENCY: process.env.STRIPE_PRICE_AGENCY,
};

beforeEach(() => {
  process.env.STRIPE_PRICE_STARTER = "price_starter";
  process.env.STRIPE_PRICE_PRO = "price_pro";
  process.env.STRIPE_PRICE_AGENCY = "price_agency";
});

afterEach(() => {
  process.env.STRIPE_PRICE_STARTER = envBackup.STRIPE_PRICE_STARTER;
  process.env.STRIPE_PRICE_PRO = envBackup.STRIPE_PRICE_PRO;
  process.env.STRIPE_PRICE_AGENCY = envBackup.STRIPE_PRICE_AGENCY;
});

describe("planIdFromStripePrice", () => {
  it("maps known price ids to plan ids", () => {
    expect(planIdFromStripePrice("price_pro")).toBe("pro");
    expect(planIdFromStripePrice("price_unknown")).toBeNull();
  });
});

describe("subscriptionPeriodIso", () => {
  it("reads period from subscription item", () => {
    const period = subscriptionPeriodIso({
      items: {
        data: [{ current_period_start: 1_700_000_000, current_period_end: 1_700_086_400 }],
      },
    });
    expect(period?.start).toBe(new Date(1_700_000_000_000).toISOString());
    expect(period?.end).toBe(new Date(1_700_086_400_000).toISOString());
  });
});

describe("subscriptionPlanChanged", () => {
  it("detects price change in previous_attributes", () => {
    const changed = subscriptionPlanChanged(
      { items: { data: [{ price: { id: "price_pro" } }] } },
      { items: { data: [{ price: { id: "price_starter" } }] } },
    );
    expect(changed).toBe(true);
  });

  it("returns false when price unchanged", () => {
    expect(
      subscriptionPlanChanged(
        { items: { data: [{ price: { id: "price_pro" } }] } },
        { cancel_at: null },
      ),
    ).toBe(false);
  });
});

describe("stripePriceIdFromSubscription", () => {
  it("prefers item price id", () => {
    expect(
      stripePriceIdFromSubscription({ items: { data: [{ price: { id: "price_starter" } }] } }),
    ).toBe("price_starter");
  });
});
