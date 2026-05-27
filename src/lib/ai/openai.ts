// Thin OpenAI SDK wrapper. OPENAI_API_KEY must be set on the server (never
// exposed to the browser). Used for question authoring (GPT-4o) and video/audio
// transcription (Whisper).

import OpenAI from "openai";

let cached: OpenAI | null = null;

export function openaiClient(): OpenAI {
  if (cached) return cached;
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local (local) or the Vercel project env (prod).",
    );
  }
  cached = new OpenAI({ apiKey: key });
  return cached;
}

// GPT-4o: text + vision (reads images/slides) + question authoring.
export const CHAT_MODEL = "gpt-4o";
// Whisper: audio/video transcription.
export const TRANSCRIBE_MODEL = "whisper-1";
