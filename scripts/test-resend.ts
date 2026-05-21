/**
 * One-off Resend connectivity test.
 * Run: npx tsx scripts/test-resend.ts
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { Resend } from "resend";

const TO = "furqan@ten80ten.com";
// Hardcode the Resend sandbox sender — works without a verified domain.
const FROM = "onboarding@resend.dev";
const KEY = process.env.RESEND_API_KEY;

if (!KEY) {
  console.error("✗ RESEND_API_KEY missing in .env.local");
  process.exit(1);
}

const resend = new Resend(KEY);

async function main() {
  console.log(`→ Sending test email`);
  console.log(`  From: ${FROM}`);
  console.log(`  To:   ${TO}\n`);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: TO,
    subject: "BCJ Learn — Resend test",
    html: `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1F3A5F">
        <h1 style="margin:0 0 12px 0">It works.</h1>
        <p>If you're reading this in your inbox, BCJ Learn is wired up to Resend correctly.</p>
        <p style="font-size:12px;color:#64748B;margin-top:32px">
          Sent via Resend from BCJ Learn dev environment.
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("✗ Resend error:", error);
    process.exit(1);
  }
  console.log(`✓ Sent. Message ID: ${data?.id}`);
}

main().catch((err) => {
  console.error("💥 Failed:", err);
  process.exit(1);
});
