/**
 * One-off Anthropic (Claude) connectivity test.
 * Run: npx tsx scripts/test-anthropic.ts
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import Anthropic from "@anthropic-ai/sdk";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6"; // matches DEFAULT_MODEL in src/lib/ai/claude.ts

if (!KEY) {
  console.error("✗ ANTHROPIC_API_KEY missing in .env.local");
  process.exit(1);
}

const client = new Anthropic({ apiKey: KEY });

async function main() {
  console.log(`→ Pinging Anthropic (${MODEL})…`);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    messages: [{ role: "user", content: "Reply with exactly: BCJ Learn AI connected." }],
  });
  const text = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  console.log("✓ Response:", text.trim());
  console.log(`  tokens: ${msg.usage.input_tokens} in / ${msg.usage.output_tokens} out`);
}

main().catch((err) => {
  console.error("✗ Anthropic error:", err?.message ?? err);
  process.exit(1);
});
