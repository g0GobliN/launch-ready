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

      const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
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
          ...(customerEmail ? { email: customerEmail } : {}),
        },
        { onConflict: "github_login" },
      );

      try {
        const { sendPurchaseEmail } = await import("./lib/email.server");
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
          subscription_cancel_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("github_login", userRow.github_login);

      try {
        const { sendCancellationEmail } = await import("./lib/email.server");
        const customer = await stripe.customers.retrieve(sub.customer);
        const customerEmail = !customer.deleted && "email" in customer ? customer.email : null;
        if (customerEmail) {
          await sendCancellationEmail(customerEmail, userRow.github_login, "plan");
        }
      } catch {
        /* non-critical */
      }
    }
  }

  // customer.subscription.updated — handle cancel_at_period_end (user cancelled, still active until period ends)
  if (event.type === "customer.subscription.updated") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = event.data.object as any;
    console.log(
      `[stripe-webhook] subscription.updated sub.id=${sub.id} cancel_at_period_end=${sub.cancel_at_period_end}`,
    );
    const { data: userRow, error: userRowError } = await db
      .from("user_credits")
      .select("github_login, email")
      .eq("stripe_subscription_id", sub.id)
      .single();
    console.log(
      `[stripe-webhook] userRow=${JSON.stringify(userRow)} error=${JSON.stringify(userRowError)}`,
    );

    if (userRow) {
      if (sub.cancel_at_period_end) {
        console.log(`[stripe-webhook] cancel flow for ${userRow.github_login}`);
        const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null;
        await db
          .from("user_credits")
          .update({ subscription_cancel_at: cancelAt, updated_at: new Date().toISOString() })
          .eq("github_login", userRow.github_login);
        try {
          const { sendCancellationEmail } = await import("./lib/email.server");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stripeEmail = await stripe.customers.retrieve(sub.customer).then((c: any) => (!c.deleted && "email" in c ? c.email : null)).catch((e: unknown) => { console.error("[stripe-webhook] stripe customer retrieve error:", e); return null; });
          const email = userRow.email ?? stripeEmail;
          console.log(`[stripe-webhook] cancel email=${email} stripeEmail=${stripeEmail}`);
          if (email) {
            await sendCancellationEmail(email, userRow.github_login, "plan");
            console.log(`[stripe-webhook] cancellation email sent to ${email}`);
          } else {
            console.warn(`[stripe-webhook] no email found for ${userRow.github_login}`);
          }
        } catch (e) {
          console.error("[stripe-webhook] cancellation email error:", e);
        }
      } else {
        const { data: currentRow } = await db
          .from("user_credits")
          .select("plan, subscription_cancel_at")
          .eq("github_login", userRow.github_login)
          .single();
        const wasScheduledToCancel = !!currentRow?.subscription_cancel_at;
        console.log(`[stripe-webhook] resubscribe flow wasScheduledToCancel=${wasScheduledToCancel} subscription_cancel_at=${currentRow?.subscription_cancel_at}`);
        await db
          .from("user_credits")
          .update({ subscription_cancel_at: null, updated_at: new Date().toISOString() })
          .eq("github_login", userRow.github_login);
        if (wasScheduledToCancel) {
          try {
            const { sendResubscribeEmail } = await import("./lib/email.server");
            const { PLANS } = await import("./lib/plans");
            const planName =
              PLANS[(currentRow?.plan as keyof typeof PLANS) ?? "free"]?.name ?? "plan";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stripeEmail = await stripe.customers.retrieve(sub.customer).then((c: any) => (!c.deleted && "email" in c ? c.email : null)).catch(() => null);
            const email = userRow.email ?? stripeEmail;
            console.log(`[stripe-webhook] resubscribe email=${email}`);
            if (email) {
              await sendResubscribeEmail(email, userRow.github_login, planName);
              console.log(`[stripe-webhook] resubscribe email sent to ${email}`);
            } else {
              console.warn(`[stripe-webhook] no email found for resubscribe ${userRow.github_login}`);
            }
          } catch (e) {
            console.error("[stripe-webhook] resubscribe email error:", e);
          }
        }
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

async function handleUnsubscribe(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const login = url.searchParams.get("login");
  const token = url.searchParams.get("token");

  if (!login || !token) {
    return new Response("Invalid unsubscribe link.", { status: 400 });
  }

  const { verifyUnsubscribeToken } = await import("./lib/email.server");
  if (!verifyUnsubscribeToken(login, token)) {
    return new Response("Invalid or expired unsubscribe link.", { status: 400 });
  }

  const { getServiceRoleClient } = await import("./lib/supabase.server");
  const db = getServiceRoleClient();
  await db.from("user_credits").update({ email_unsubscribed: true }).eq("github_login", login);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed — LaunchReadyy</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:80px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px">
          <tr>
            <td style="padding:32px 36px 24px">
              <span style="background:#16a34a;border-radius:6px;padding:5px 12px;color:#ffffff;font-weight:bold;font-size:14px">LaunchReadyy</span>
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px 36px">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:bold;color:#111111">You've been unsubscribed</h1>
              <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7">You will no longer receive email notifications from LaunchReadyy.</p>
              <p style="margin:0;font-size:14px;color:#71717a;line-height:1.6">Changed your mind? You can re-enable emails from your account settings.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // Intercept Stripe webhook before TanStack SSR
    if (request.method === "POST" && url.pathname === "/api/stripe/webhook") {
      try {
        return await handleStripeWebhook(request);
      } catch (error) {
        console.error("[stripe-webhook] unhandled error:", error);
        return new Response("Internal error", { status: 500 });
      }
    }

    // One-click unsubscribe (GET from email link, POST from Apple Mail / Gmail)
    if (
      (request.method === "GET" || request.method === "POST") &&
      url.pathname === "/api/unsubscribe"
    ) {
      try {
        return await handleUnsubscribe(request);
      } catch (error) {
        console.error("[unsubscribe] unhandled error:", error);
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
