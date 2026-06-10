import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "hello@launchreadyy.xyz";

// ─── Unsubscribe tokens ───────────────────────────────────────────────────────

function unsubscribeSecret() {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET ?? "dev-secret-change-me";
}

export function createUnsubscribeToken(login: string): string {
  return createHmac("sha256", unsubscribeSecret()).update(login).digest("hex");
}

export function verifyUnsubscribeToken(login: string, token: string): boolean {
  const expected = createHmac("sha256", unsubscribeSecret()).update(login).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function unsubscribeUrl(login: string): string {
  const token = createUnsubscribeToken(login);
  return `${process.env.APP_URL}/api/unsubscribe?login=${encodeURIComponent(login)}&token=${token}`;
}

async function isUnsubscribed(login: string): Promise<boolean> {
  try {
    const { getServiceRoleClient } = await import("./supabase.server");
    const db = getServiceRoleClient();
    const { data } = await db
      .from("user_credits")
      .select("email_unsubscribed")
      .eq("github_login", login)
      .single();
    return data?.email_unsubscribed === true;
  } catch {
    return false;
  }
}

// ─── HTML template ────────────────────────────────────────────────────────────

function base(body: string, login: string) {
  const url = unsubscribeUrl(login);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LaunchReadyy</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:8px">

          <tr>
            <td style="padding:32px 36px 24px">
              <span style="background:#16a34a;border-radius:6px;padding:5px 12px;color:#ffffff;font-weight:bold;font-size:14px">LaunchReadyy</span>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 32px">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 36px;border-top:1px solid #e4e4e7">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6">
                LaunchReadyy &middot; Built for indie hackers and vibe coders<br>
                Questions? <a href="mailto:hello@launchreadyy.xyz" style="color:#16a34a;text-decoration:none">hello@launchreadyy.xyz</a><br>
                <a href="${url}" style="color:#a1a1aa;text-decoration:underline">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function emailHeaders(login: string) {
  const url = unsubscribeUrl(login);
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function btn(href: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px">
    <tr>
      <td style="background:#16a34a;border-radius:6px">
        <a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ─── Send functions ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  if (await isUnsubscribed(name)) return;
  const bodyHtml = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#111111">Welcome, ${name}</h1>
       <p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.7">Your GitHub account is connected. You are on the Free plan — 1 repository and 3 scans per month.</p>
       <p style="margin:0;font-size:15px;color:#3f3f46;line-height:1.7">Run your first scan and get a production-readiness score in seconds.</p>
       ${btn(`${process.env.APP_URL}/dashboard`, "Go to dashboard")}`;
  const html = base(bodyHtml, name);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to LaunchReadyy",
    html,
    text: toPlainText(html),
    headers: emailHeaders(name),
  });
}

export async function sendPurchaseEmail(
  to: string,
  name: string,
  planName: string,
  priceUsd: number,
) {
  const resend = getResend();
  if (!resend) return;
  if (await isUnsubscribed(name)) return;
  const bodyHtml = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#111111">${planName} plan activated</h1>
       <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7">Thank you, <strong>${name}</strong>. Your ${planName} plan is now active and all features are unlocked.</p>

       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9f9;border:1px solid #e4e4e7;border-radius:6px;margin-bottom:8px">
         <tr>
           <td style="padding:16px 20px">
             <table width="100%" cellpadding="0" cellspacing="0" border="0">
               <tr>
                 <td style="font-size:13px;color:#71717a;padding-bottom:10px">Plan</td>
                 <td align="right" style="font-size:13px;color:#111111;font-weight:bold;padding-bottom:10px">${planName}</td>
               </tr>
               <tr>
                 <td style="font-size:13px;color:#71717a;border-top:1px solid #e4e4e7;padding-top:10px">Amount</td>
                 <td align="right" style="font-size:13px;color:#111111;font-weight:bold;border-top:1px solid #e4e4e7;padding-top:10px">$${priceUsd} / month</td>
               </tr>
               <tr>
                 <td style="font-size:13px;color:#71717a;border-top:1px solid #e4e4e7;padding-top:10px">Status</td>
                 <td align="right" style="font-size:13px;border-top:1px solid #e4e4e7;padding-top:10px"><span style="background:#dcfce7;color:#16a34a;font-size:12px;font-weight:bold;padding:2px 10px;border-radius:20px">Active</span></td>
               </tr>
             </table>
           </td>
         </tr>
       </table>
       ${btn(`${process.env.APP_URL}/dashboard`, "Go to dashboard")}
       <p style="margin:20px 0 0;font-size:13px;color:#71717a;line-height:1.6">-- Gurung, solo developer behind LaunchReadyy. Thank you for your support, it genuinely means a lot.</p>`;
  const html = base(bodyHtml, name);
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your LaunchReadyy ${planName} plan is now active`,
    html,
    text: toPlainText(html),
    headers: emailHeaders(name),
  });
}

export async function sendCancellationEmail(to: string, name: string, planName: string) {
  const resend = getResend();
  if (!resend) return;
  if (await isUnsubscribed(name)) return;
  const bodyHtml = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#111111">Subscription cancelled</h1>
       <p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.7">Hi <strong>${name}</strong>, your ${planName} subscription has been cancelled.</p>
       <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7">You will keep full access until the end of your current billing period. After that, your account moves to the Free plan.</p>
       <p style="margin:0;font-size:14px;color:#3f3f46;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:6px;padding:14px 18px;line-height:1.6">Changed your mind? Resubscribe any time and pick up right where you left off.</p>
       ${btn(`${process.env.APP_URL}/pricing`, "View plans")}`;
  const html = base(bodyHtml, name);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your LaunchReadyy subscription has been cancelled",
    html,
    text: toPlainText(html),
    headers: emailHeaders(name),
  });
}

export async function sendPaymentFailedEmail(to: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  if (await isUnsubscribed(name)) return;
  const bodyHtml = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#111111">Payment failed</h1>
       <p style="margin:0 0 12px;font-size:15px;color:#3f3f46;line-height:1.7">Hi <strong>${name}</strong>, we were unable to process your last payment.</p>
       <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7">Please update your payment method to avoid losing access to your plan. Your account will be downgraded to Free if payment continues to fail.</p>
       <p style="margin:0;font-size:14px;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;line-height:1.6">Update your payment method as soon as possible to keep your plan active.</p>
       ${btn(`${process.env.APP_URL}/settings`, "Update payment method")}`;
  const html = base(bodyHtml, name);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Action required: payment failed",
    html,
    text: toPlainText(html),
    headers: emailHeaders(name),
  });
}

export async function sendCreditsLowEmail(
  to: string,
  name: string,
  creditsRemaining: number,
  planName: string,
) {
  const resend = getResend();
  if (!resend) return;
  if (await isUnsubscribed(name)) return;
  const bodyHtml = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#111111">Running low on AI credits</h1>
       <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7">Hi <strong>${name}</strong>, you have <strong>${creditsRemaining} AI credit${creditsRemaining === 1 ? "" : "s"}</strong> left on your ${planName} plan this month.</p>
       <p style="margin:0;font-size:14px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;line-height:1.6">AI credits are used for AI-generated fixes and architecture analysis. Upgrade to get more credits instantly.</p>
       ${btn(`${process.env.APP_URL}/pricing`, "Upgrade plan")}`;
  const html = base(bodyHtml, name);
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You are running low on AI credits",
    html,
    text: toPlainText(html),
    headers: emailHeaders(name),
  });
}

export async function sendLimitReachedEmail(
  to: string,
  name: string,
  limitType: "scans" | "repos",
  planName: string,
) {
  const resend = getResend();
  if (!resend) return;
  if (await isUnsubscribed(name)) return;
  const isScans = limitType === "scans";
  const bodyHtml = `<h1 style="margin:0 0 16px;font-size:22px;font-weight:bold;color:#111111">${isScans ? "Scan" : "Repository"} limit reached</h1>
       <p style="margin:0 0 20px;font-size:15px;color:#3f3f46;line-height:1.7">Hi <strong>${name}</strong>, you have used all your ${isScans ? "scans" : "repository slots"} for this month on the ${planName} plan.</p>
       <p style="margin:0;font-size:14px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;line-height:1.6">${isScans ? "Upgrade to run more scans and keep your repos production-ready." : "Upgrade to connect more repositories and scan your full stack."}</p>
       ${btn(`${process.env.APP_URL}/pricing`, "Upgrade plan")}`;
  const html = base(bodyHtml, name);
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You have hit your ${isScans ? "scan" : "repository"} limit`,
    html,
    text: toPlainText(html),
    headers: emailHeaders(name),
  });
}
