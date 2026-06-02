/**
 * Resend connectivity + domain-verification test.
 *
 * Sends one email from RESEND_FROM_EMAIL to a recipient you choose. This tells
 * you whether the sending domain (app.bcjbuildingservices.com) is verified on
 * Resend — i.e. whether real invite / reset emails will actually deliver.
 *
 * Run:  npx tsx scripts/test-resend.ts you@example.com
 *       (no arg → uses Resend's always-accept test address, which does NOT
 *        prove arbitrary-recipient sending)
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Resend } from "resend";

const TO = process.argv[2] || "delivered@resend.dev";
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const KEY = process.env.RESEND_API_KEY;

if (!KEY) {
  console.error("✗ RESEND_API_KEY missing in .env.local");
  process.exit(1);
}

const resend = new Resend(KEY);

async function main() {
  console.log("→ Resend test");
  console.log(`  From: ${FROM}`);
  console.log(`  To:   ${TO}`);
  if (TO === "delivered@resend.dev") {
    console.log("  (tip: pass your own email to truly test domain verification)");
  }
  console.log("");

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: "BCJ Learn — Resend test",
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#041D39">
        <h1 style="margin:0 0 12px 0">It works.</h1>
        <p>If you're reading this in your inbox, BCJ Learn can send email via Resend
        from <b>${FROM}</b> — the sending domain is verified.</p>
        <p style="font-size:12px;color:#64748B;margin-top:32px">Sent via Resend.</p>
      </div>
    `,
  });

  if (error) {
    console.error("✗ Resend error:", JSON.stringify(error, null, 2));
    const msg = JSON.stringify(error).toLowerCase();
    if (msg.includes("domain") || msg.includes("not verified") || msg.includes("403")) {
      console.error(
        "\n→ Diagnosis: the sending domain in RESEND_FROM_EMAIL is NOT verified on Resend.\n" +
        "  Verify 'app.bcjbuildingservices.com' (or your chosen domain) in the Resend dashboard\n" +
        "  (add the DKIM/SPF DNS records via Bluehost), then re-run. Until then, real invite/\n" +
        "  reset emails to arbitrary recipients will be rejected.",
      );
    }
    process.exit(1);
  }
  console.log(`✓ Sent. Message ID: ${data?.id}`);
  console.log(`✓ Domain works — emails from ${FROM} deliver to real recipients.`);
}

main().catch((err) => {
  console.error("💥 Failed:", err);
  process.exit(1);
});
