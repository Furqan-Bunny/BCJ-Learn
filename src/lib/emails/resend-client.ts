// Thin Resend wrapper. RESEND_API_KEY and RESEND_FROM_EMAIL must be set on
// the server. The actual Resend account can be Ten80Ten's during build and
// BCJ's at launch — the swap is just an env-var change.

import { Resend } from "resend";

let cached: Resend | null = null;

export function resendClient(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Add it to .env.local (local) or Vercel project env (prod).",
    );
  }
  cached = new Resend(key);
  return cached;
}

export function resendFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "BCJ Learn <noreply@bcj.com>";
}
