// Thin Anthropic SDK wrapper.
//
// The ANTHROPIC_API_KEY env var must be set on the server (never exposed to
// the browser). Per SOW, Ten80Ten provides the key for the first 30 days of
// production; BCJ then swaps to their own.

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function claudeClient(): Anthropic {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (local) or Vercel project env (prod).",
    );
  }
  cached = new Anthropic({ apiKey: key });
  return cached;
}

// Default model for question authoring — Sonnet 4.6 balances cost and quality.
// Easy to override per-call if needed.
export const DEFAULT_MODEL = "claude-sonnet-4-6";
