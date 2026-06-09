import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PLANS, type PlanId } from "../plans";

const PRICE_IDS: Record<"starter" | "pro" | "agency", string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  pro: process.env.STRIPE_PRICE_PRO!,
  agency: process.env.STRIPE_PRICE_AGENCY!,
};

export const createCheckoutSessionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ planId: z.enum(["starter", "pro", "agency"]) }))
  .handler(async ({ data }) => {
    const { getStoredUser } = await import("../github-token.server");
    const { getStripe } = await import("../stripe.server");
    const { getServiceRoleClient } = await import("../supabase.server");

    const user = getStoredUser();
    if (!user) throw new Error("Not authenticated");

    // Block if user already has an active subscription — they must use the billing portal
    const db = getServiceRoleClient();
    const { data: credits } = await db
      .from("user_credits")
      .select("plan, stripe_subscription_id")
      .eq("github_login", user.login)
      .maybeSingle();

    if (credits?.stripe_subscription_id) {
      if (credits.plan === data.planId) {
        throw new Error("You're already on this plan. Visit Settings to manage your subscription.");
      }
      throw new Error(
        "You already have an active subscription. Please use the billing portal in Settings to change your plan.",
      );
    }

    const appUrl = process.env.APP_URL ?? "https://launchreadyy.xyz";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_IDS[data.planId], quantity: 1 }],
      success_url: `${appUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing`,
      customer_email: user.email ?? undefined,
      metadata: {
        github_login: user.login,
        plan_id: data.planId,
      },
    });

    return { url: session.url! };
  });

export const activatePlanFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data }) => {
    const { getStripe } = await import("../stripe.server");
    const { getServiceRoleClient } = await import("../supabase.server");
    const { PLANS } = await import("../plans");

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["subscription"],
    });

    if (session.status !== "complete") throw new Error("Payment not complete");

    const githubLogin = session.metadata?.github_login;
    const planId = session.metadata?.plan_id as PlanId;
    if (!githubLogin || !planId) throw new Error("Missing metadata");

    const plan = PLANS[planId];
    const db = getServiceRoleClient();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription?.id ?? null);

    await db.from("user_credits").upsert(
      {
        github_login: githubLogin,
        plan: planId,
        monthly_scan_limit: plan.scansPerMonth,
        monthly_scan_used: 0,
        balance: plan.aiCreditsPerMonth,
        ai_credits_total: plan.aiCreditsPerMonth,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        updated_at: now.toISOString(),
        stripe_customer_id: (session.customer as string) ?? null,
        stripe_subscription_id: subscriptionId,
      },
      { onConflict: "github_login" },
    );

    // send purchase confirmation email
    try {
      const { data: userRow } = await db
        .from("user_credits")
        .select("github_login")
        .eq("github_login", githubLogin)
        .single();
      if (userRow) {
        const { sendPurchaseEmail } = await import("../email.server");
        // best-effort — we don't have email from GitHub here, use checkout email if available
        const customerEmail = session.customer_details?.email;
        if (customerEmail) {
          await sendPurchaseEmail(customerEmail, githubLogin, plan.name, plan.priceUsd);
        }
      }
    } catch {
      /* email is non-critical */
    }

    return { planId };
  });

export const createPortalSessionFn = createServerFn({ method: "POST" }).handler(async () => {
  const { getStoredUser } = await import("../github-token.server");
  const { getServiceRoleClient } = await import("../supabase.server");
  const { getStripe } = await import("../stripe.server");

  const user = getStoredUser();
  if (!user) throw new Error("Not authenticated");

  const db = getServiceRoleClient();
  const { data } = await db
    .from("user_credits")
    .select("stripe_customer_id")
    .eq("github_login", user.login)
    .single();

  if (!data?.stripe_customer_id) throw new Error("No billing account found");

  const stripe = getStripe();
  const appUrl = process.env.APP_URL ?? "https://launchreadyy.xyz";
  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${appUrl}/settings`,
  });

  return { url: session.url };
});
