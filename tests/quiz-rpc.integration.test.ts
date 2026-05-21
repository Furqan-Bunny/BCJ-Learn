// Opt-in integration tests for the quiz-flow RPCs (start_quiz_attempt /
// submit_quiz_attempt) against a real Supabase project.
//
// SKIPPED unless ALL of these env vars are set, so it never runs against the
// production database in normal `npm run test`:
//   TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY,
//   TEST_MANAGER_EMAIL, TEST_MANAGER_PASSWORD, TEST_MODULE_SLUG
//
// Point them at a throwaway/staging Supabase seeded with `npm run seed`, with a
// published module that has approved first-attempt questions.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const ANON = process.env.TEST_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEST_MANAGER_EMAIL;
const PASSWORD = process.env.TEST_MANAGER_PASSWORD;
const MODULE = process.env.TEST_MODULE_SLUG;
const ready = Boolean(URL && ANON && EMAIL && PASSWORD && MODULE);

interface StartPayload {
  attempt_id: string;
  time_limit_minutes: number | null;
  questions: { id: string; text: string; options: { id: string; text: string; order: number }[] }[];
}

describe.skipIf(!ready)("quiz RPC integration", () => {
  // Created in beforeAll (not at collection time) so a skipped suite never
  // touches createClient with undefined env.
  let sb: SupabaseClient;

  beforeAll(async () => {
    sb = createClient(URL!, ANON!);
    const { error } = await sb.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });
    if (error) throw error;
  });

  it("start_quiz_attempt returns questions and never leaks the correct flag", async () => {
    const { data, error } = await sb.rpc("start_quiz_attempt", {
      p_module_slug: MODULE!,
      p_pool: "first-attempt",
    });
    expect(error).toBeNull();
    const payload = data as StartPayload;
    expect(payload.attempt_id).toBeTruthy();
    expect(Array.isArray(payload.questions)).toBe(true);
    for (const q of payload.questions) {
      for (const o of q.options) {
        expect(Object.prototype.hasOwnProperty.call(o, "correct")).toBe(false);
      }
    }
  });

  it("submit_quiz_attempt grades server-side and returns score + pass flag", async () => {
    const start = await sb.rpc("start_quiz_attempt", {
      p_module_slug: MODULE!,
      p_pool: "first-attempt",
    });
    const payload = start.data as StartPayload;
    const answers = payload.questions.map((q) => ({
      question_id: q.id,
      selected_option_id: q.options[0]?.id ?? null,
    }));

    const { data, error } = await sb.rpc("submit_quiz_attempt", {
      p_attempt_id: payload.attempt_id,
      p_answers: answers,
    });
    expect(error).toBeNull();
    const res = data as { score_pct: number; passed: boolean; total_count: number };
    expect(Number.isNaN(Number(res.score_pct))).toBe(false);
    expect(typeof res.passed).toBe("boolean");
    expect(res.total_count).toBe(answers.length);
  });
});
