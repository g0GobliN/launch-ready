import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@launchreadyy.xyz";

function base(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#191d27;font-family:Inter,system-ui,sans-serif;color:#f0f0f0">
  <div style="max-width:520px;margin:40px auto;padding:0 20px">
    <div style="margin-bottom:28px">
      <span style="background:#22c55e;color:#0f1a0f;font-weight:700;font-size:13px;padding:4px 10px;border-radius:6px">LaunchReadyy</span>
    </div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 12px">${title}</h1>
    ${body}
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid #2a2f3d;font-size:12px;color:#6b7280">
      LaunchReadyy · Built for indie hackers and vibe coders
    </div>
  </div>
</body>
</html>`;
}

export async function sendWelcomeEmail(to: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to LaunchReadyy",
    html: base(
      `Welcome, ${name}!`,
      `<p style="color:#9ca3af;line-height:1.6">Your GitHub account is connected. You're on the <strong style="color:#f0f0f0">Free plan</strong> — 1 repo, 3 scans per month.</p>
       <p style="color:#9ca3af;line-height:1.6">Run your first scan from the dashboard and get a production-readiness score in seconds.</p>
       <a href="${process.env.APP_URL}/dashboard" style="display:inline-block;margin-top:16px;background:#22c55e;color:#0f1a0f;font-weight:600;font-size:14px;padding:10px 20px;border-radius:6px;text-decoration:none">Go to dashboard →</a>`,
    ),
  });
}

export async function sendPurchaseEmail(
  to: string,
  name: string,
  planName: string,
  priceYen: number,
) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You're on LaunchReadyy ${planName}`,
    html: base(
      `${planName} plan activated`,
      `<p style="color:#9ca3af;line-height:1.6">Thanks for upgrading, ${name}. Your <strong style="color:#f0f0f0">${planName}</strong> plan is now active.</p>
       <div style="background:#1e2230;border:1px solid #2a2f3d;border-radius:8px;padding:16px;margin:20px 0">
         <div style="display:flex;justify-content:space-between;font-size:14px">
           <span style="color:#9ca3af">Plan</span><span style="font-weight:600">${planName}</span>
         </div>
         <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:8px">
           <span style="color:#9ca3af">Amount</span><span style="font-weight:600">¥${priceYen.toLocaleString()} / month</span>
         </div>
       </div>
       <a href="${process.env.APP_URL}/dashboard" style="display:inline-block;background:#22c55e;color:#0f1a0f;font-weight:600;font-size:14px;padding:10px 20px;border-radius:6px;text-decoration:none">Go to dashboard →</a>`,
    ),
  });
}

export async function sendCancellationEmail(to: string, name: string, planName: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your LaunchReadyy subscription has been cancelled",
    html: base(
      "Subscription cancelled",
      `<p style="color:#9ca3af;line-height:1.6">Hi ${name}, your <strong style="color:#f0f0f0">${planName}</strong> subscription has been cancelled. You'll keep access until the end of your current billing period.</p>
       <p style="color:#9ca3af;line-height:1.6">After that, your account will move to the Free plan (1 repo, 3 scans/month).</p>
       <p style="color:#9ca3af;line-height:1.6">Changed your mind? You can resubscribe anytime.</p>
       <a href="${process.env.APP_URL}/pricing" style="display:inline-block;margin-top:4px;background:#22c55e;color:#0f1a0f;font-weight:600;font-size:14px;padding:10px 20px;border-radius:6px;text-decoration:none">View plans →</a>`,
    ),
  });
}

export async function sendPaymentFailedEmail(to: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Action required: payment failed",
    html: base(
      "Payment failed",
      `<p style="color:#9ca3af;line-height:1.6">Hi ${name}, we couldn't process your last payment. Please update your payment method to keep your plan active.</p>
       <a href="${process.env.APP_URL}/settings" style="display:inline-block;margin-top:4px;background:#ef4444;color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:6px;text-decoration:none">Update payment method →</a>`,
    ),
  });
}
