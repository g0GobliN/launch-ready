// Node 20 has no native WebSocket — polyfill before any module uses it.
if (!globalThis.WebSocket) {
  const ws = await import("ws");
  (globalThis as unknown as Record<string, unknown>).WebSocket = ws.default || ws;
}

import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// ─── Stripe webhook handler ───────────────────────────────────────────────────
// Must intercept BEFORE TanStack's SSR pipeline so we can read the raw body
// (Stripe signature verification requires the exact raw bytes — no JSON parsing).

async function handleStripeWebhook(request: Request): Promise<Response> {
  const { getStripe } = await import("./lib/stripe.server");
  const { getServiceRoleClient } = await import("./lib/supabase.server");
  const { PLANS } = await import("./lib/plans");

  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return new Response("Webhook secret not configured", { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("[stripe-webhook] event:", event.type);
  const db = getServiceRoleClient();

  // checkout.session.completed — plan activation (backup to /api/stripe/success)
  if (event.type === "checkout.session.completed") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = event.data.object as any;
    const githubLogin = session.metadata?.github_login;
    const planId = session.metadata?.plan_id as keyof typeof PLANS | undefined;
    if (githubLogin && planId && PLANS[planId]) {
      const plan = PLANS[planId];
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((session.subscription as any)?.id ?? null);

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
          stripe_customer_id: session.customer ?? null,
          stripe_subscription_id: subscriptionId,
        },
        { onConflict: "github_login" },
      );

      try {
        const { sendPurchaseEmail } = await import("./lib/email.server");
        const customerEmail = session.customer_details?.email ?? session.customer_email;
        console.log(
          `[stripe-webhook] githubLogin=${githubLogin} customerEmail=${customerEmail ?? "null"}`,
        );
        if (customerEmail) {
          await sendPurchaseEmail(customerEmail, githubLogin, plan.name, plan.priceUsd);
          console.log("[stripe-webhook] purchase email sent to", customerEmail);
        } else {
          console.warn("[stripe-webhook] no email for", githubLogin, "— email skipped");
        }
      } catch (e) {
        console.error("[stripe-webhook] purchase email error:", e);
      }
    }
  }

  // customer.subscription.deleted — downgrade to free
  if (event.type === "customer.subscription.deleted") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = event.data.object as any;
    const { data: userRow } = await db
      .from("user_credits")
      .select("github_login")
      .eq("stripe_subscription_id", sub.id)
      .single();

    if (userRow) {
      const freePlan = PLANS["free"];
      await db
        .from("user_credits")
        .update({
          plan: "free",
          monthly_scan_limit: freePlan.scansPerMonth,
          balance: 0,
          ai_credits_total: 0,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("github_login", userRow.github_login);

      try {
        const { sendCancellationEmail } = await import("./lib/email.server");
        if (sub.customer_email) {
          await sendCancellationEmail(sub.customer_email, userRow.github_login, "plan");
        }
      } catch {
        /* non-critical */
      }
    }
  }

  // invoice.payment_failed — notify user
  if (event.type === "invoice.payment_failed") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invoice = event.data.object as any;
    if (invoice.customer_email) {
      try {
        const { sendPaymentFailedEmail } = await import("./lib/email.server");
        const { data: userRow } = await db
          .from("user_credits")
          .select("github_login")
          .eq("stripe_customer_id", invoice.customer)
          .single();
        if (userRow) {
          await sendPaymentFailedEmail(invoice.customer_email, userRow.github_login);
        }
      } catch {
        /* non-critical */
      }
    }
  }

  return new Response("ok", { status: 200 });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Intercept Stripe webhook before TanStack SSR
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/stripe/webhook") {
      try {
        return await handleStripeWebhook(request);
      } catch (error) {
        console.error("[stripe-webhook] unhandled error:", error);
        return new Response("Internal error", { status: 500 });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
