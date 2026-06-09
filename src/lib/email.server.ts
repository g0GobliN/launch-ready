import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@launchreadyy.xyz";

function base(preheader: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>LaunchReadyy</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:'Segoe UI',Inter,system-ui,sans-serif;color:#e6edf3;-webkit-font-smoothing:antialiased">
  <!-- preheader -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all">${preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1117;min-height:100vh">
    <tr>
      <td align="center" style="padding:48px 16px">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:36px">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#22c55e;border-radius:8px;padding:6px 14px">
                    <span style="color:#052e16;font-weight:800;font-size:14px;letter-spacing:0.5px">LaunchReadyy</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:40px 36px">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;text-align:center">
              <p style="margin:0;font-size:12px;color:#484f58;line-height:1.8">
                LaunchReadyy &nbsp;·&nbsp; Built for indie hackers &amp; vibe coders
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

function signOff() {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:1px solid #21262d">
    <tr>
      <td style="padding-top:24px">
        <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.7">
          — Gurung, solo developer behind LaunchReadyy.<br>
          Thank you for your support — it genuinely means a lot.<br>
          For any questions, reply here or email <a href="mailto:launchreadyy@gmail.com" style="color:#22c55e;text-decoration:none">launchreadyy@gmail.com</a>.
        </p>
      </td>
    </tr>
  </table>`;
}

export async function sendWelcomeEmail(to: string, name: string) {
  const resend = getResend();
  if (!resend) return;
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Welcome to LaunchReadyy",
    html: base(
      `Your account is ready, ${name}.`,
      `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e6edf3">Welcome aboard, ${name}</h1>
       <p style="margin:0 0 20px;font-size:13px;color:#22c55e;font-weight:500;letter-spacing:0.3px">FREE PLAN · ACTIVE</p>
       <p style="margin:0 0 16px;font-size:15px;color:#8b949e;line-height:1.7">Your GitHub account is connected and you're ready to go. You have <strong style="color:#e6edf3">1 repository</strong> and <strong style="color:#e6edf3">3 scans per month</strong> on the Free plan.</p>
       <p style="margin:0 0 28px;font-size:15px;color:#8b949e;line-height:1.7">Run your first scan and get a production-readiness score in seconds.</p>
       <table cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td style="background:#22c55e;border-radius:8px">
             <a href="${process.env.APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;color:#052e16;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">Go to dashboard →</a>
           </td>
         </tr>
       </table>
       ${signOff()}`,
    ),
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Your LaunchReadyy ${planName} plan is now active`,
    html: base(
      `${planName} plan is now active.`,
      `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e6edf3">${planName} plan activated</h1>
       <p style="margin:0 0 24px;font-size:13px;color:#22c55e;font-weight:500;letter-spacing:0.3px">PAYMENT CONFIRMED</p>
       <p style="margin:0 0 24px;font-size:15px;color:#8b949e;line-height:1.7">Thank you, <strong style="color:#e6edf3">${name}</strong>. Your <strong style="color:#e6edf3">${planName}</strong> plan is now active and all features are unlocked.</p>

       <!-- Receipt -->
       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d1117;border:1px solid #21262d;border-radius:10px;margin-bottom:28px">
         <tr>
           <td style="padding:20px 24px">
             <table width="100%" cellpadding="0" cellspacing="0" border="0">
               <tr>
                 <td style="font-size:13px;color:#8b949e;padding-bottom:12px">Plan</td>
                 <td align="right" style="font-size:13px;color:#e6edf3;font-weight:600;padding-bottom:12px">${planName}</td>
               </tr>
               <tr>
                 <td style="font-size:13px;color:#8b949e;border-top:1px solid #21262d;padding-top:12px">Amount</td>
                 <td align="right" style="font-size:13px;color:#e6edf3;font-weight:600;border-top:1px solid #21262d;padding-top:12px">$${priceUsd} / month</td>
               </tr>
               <tr>
                 <td style="font-size:13px;color:#8b949e;border-top:1px solid #21262d;padding-top:12px">Status</td>
                 <td align="right" style="border-top:1px solid #21262d;padding-top:12px">
                   <span style="background:#052e16;color:#22c55e;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.3px">Active</span>
                 </td>
               </tr>
             </table>
           </td>
         </tr>
       </table>

       <table cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td style="background:#22c55e;border-radius:8px">
             <a href="${process.env.APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;color:#052e16;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">Go to dashboard →</a>
           </td>
         </tr>
       </table>
       ${signOff()}`,
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
      "You still have access until the end of your billing period.",
      `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e6edf3">Subscription cancelled</h1>
       <p style="margin:0 0 24px;font-size:13px;color:#8b949e;font-weight:500;letter-spacing:0.3px">${planName.toUpperCase()} PLAN</p>
       <p style="margin:0 0 16px;font-size:15px;color:#8b949e;line-height:1.7">Hi <strong style="color:#e6edf3">${name}</strong>, your <strong style="color:#e6edf3">${planName}</strong> subscription has been cancelled.</p>
       <p style="margin:0 0 28px;font-size:15px;color:#8b949e;line-height:1.7">You'll keep full access until the end of your current billing period. After that, your account moves to the Free plan (1 repo, 3 scans / month).</p>

       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1c1207;border:1px solid #2d1f07;border-radius:10px;margin-bottom:28px">
         <tr>
           <td style="padding:16px 20px;font-size:14px;color:#d97706;line-height:1.6">
             Changed your mind? Resubscribe any time and pick up right where you left off.
           </td>
         </tr>
       </table>

       <table cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td style="background:#22c55e;border-radius:8px">
             <a href="${process.env.APP_URL}/pricing" style="display:inline-block;padding:12px 24px;color:#052e16;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">View plans →</a>
           </td>
         </tr>
       </table>
       ${signOff()}`,
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
      "Please update your payment method to keep your plan active.",
      `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e6edf3">Payment failed</h1>
       <p style="margin:0 0 24px;font-size:13px;color:#ef4444;font-weight:500;letter-spacing:0.3px">ACTION REQUIRED</p>
       <p style="margin:0 0 16px;font-size:15px;color:#8b949e;line-height:1.7">Hi <strong style="color:#e6edf3">${name}</strong>, we weren't able to process your last payment.</p>
       <p style="margin:0 0 28px;font-size:15px;color:#8b949e;line-height:1.7">Please update your payment method to avoid losing access to your plan. Your account will be downgraded to Free if payment continues to fail.</p>

       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a0c0c;border:1px solid #3b1212;border-radius:10px;margin-bottom:28px">
         <tr>
           <td style="padding:16px 20px;font-size:14px;color:#ef4444;line-height:1.6">
             Update your payment method as soon as possible to keep your plan active.
           </td>
         </tr>
       </table>

       <table cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td style="background:#ef4444;border-radius:8px">
             <a href="${process.env.APP_URL}/settings" style="display:inline-block;padding:12px 24px;color:#fff;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">Update payment method →</a>
           </td>
         </tr>
       </table>
       ${signOff()}`,
    ),
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
  await resend.emails.send({
    from: FROM,
    to,
    subject: "You are running low on AI credits",
    html: base(
      `Only ${creditsRemaining} AI credit${creditsRemaining === 1 ? "" : "s"} remaining.`,
      `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e6edf3">Running low on AI credits</h1>
       <p style="margin:0 0 24px;font-size:13px;color:#d97706;font-weight:500;letter-spacing:0.3px">HEADS UP</p>
       <p style="margin:0 0 24px;font-size:15px;color:#8b949e;line-height:1.7">Hi <strong style="color:#e6edf3">${name}</strong>, you have <strong style="color:#e6edf3">${creditsRemaining} AI credit${creditsRemaining === 1 ? "" : "s"}</strong> left on your <strong style="color:#e6edf3">${planName}</strong> plan this month.</p>

       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1c1207;border:1px solid #2d1f07;border-radius:10px;margin-bottom:28px">
         <tr>
           <td style="padding:16px 20px;font-size:14px;color:#d97706;line-height:1.6">
             AI credits are used for AI-generated fixes, architecture analysis, and advanced reports. Upgrade to get more credits instantly.
           </td>
         </tr>
       </table>

       <table cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td style="background:#22c55e;border-radius:8px">
             <a href="${process.env.APP_URL}/pricing" style="display:inline-block;padding:12px 24px;color:#052e16;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">Upgrade plan →</a>
           </td>
         </tr>
       </table>
       ${signOff()}`,
    ),
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
  const isScans = limitType === "scans";
  await resend.emails.send({
    from: FROM,
    to,
    subject: `You have hit your ${isScans ? "scan" : "repository"} limit`,
    html: base(
      `Upgrade to keep going.`,
      `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#e6edf3">${isScans ? "Scan" : "Repository"} limit reached</h1>
       <p style="margin:0 0 24px;font-size:13px;color:#d97706;font-weight:500;letter-spacing:0.3px">${planName.toUpperCase()} PLAN LIMIT</p>
       <p style="margin:0 0 24px;font-size:15px;color:#8b949e;line-height:1.7">Hi <strong style="color:#e6edf3">${name}</strong>, you've used all your ${isScans ? "scans" : "repository slots"} for this month on the <strong style="color:#e6edf3">${planName}</strong> plan.</p>

       <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1c1207;border:1px solid #2d1f07;border-radius:10px;margin-bottom:28px">
         <tr>
           <td style="padding:16px 20px;font-size:14px;color:#d97706;line-height:1.6">
             ${isScans ? "Upgrade to run more scans and keep your repos production-ready." : "Upgrade to connect more repositories and scan your full stack."}
           </td>
         </tr>
       </table>

       <table cellpadding="0" cellspacing="0" border="0">
         <tr>
           <td style="background:#22c55e;border-radius:8px">
             <a href="${process.env.APP_URL}/pricing" style="display:inline-block;padding:12px 24px;color:#052e16;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">Upgrade plan →</a>
           </td>
         </tr>
       </table>
       ${signOff()}`,
    ),
  });
}
