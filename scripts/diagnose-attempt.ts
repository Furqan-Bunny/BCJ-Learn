/**
 * BCJ Learn — diagnose a single attempt's review data.
 *
 * Shows the attempt row, its attempt_answers, and whether the answered
 * questions still exist — to explain an empty "question-by-question" review.
 *
 * Run with:  npx tsx scripts/diagnose-attempt.ts <attemptId>
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const attemptId = process.argv[2] ?? "807c1f53-c1bb-42d9-b089-a95f8b48c142";
const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`\n=== Attempt ${attemptId} ===`);
  const { data: attempt, error: aErr } = await sb.from("attempts").select("*").eq("id", attemptId).maybeSingle();
  if (aErr) { console.error(aErr); process.exit(1); }
  if (!attempt) { console.log("Attempt not found."); process.exit(0); }
  console.log({
    module_slug: attempt.module_slug,
    pool: attempt.pool,
    status: attempt.status,
    score_pct: attempt.score_pct,
    correct_count: attempt.correct_count,
    total_count: attempt.total_count,
    delivery_id: attempt.delivery_id,
  });

  console.log(`\n=== attempt_answers for this attempt ===`);
  const { data: answers } = await sb
    .from("attempt_answers")
    .select("question_id, selected_option_id, correct")
    .eq("attempt_id", attemptId);
  console.log(`rows: ${answers?.length ?? 0}`);
  (answers ?? []).forEach((a) => console.log("  ", a));

  if (answers && answers.length > 0) {
    const qIds = answers.map((a) => a.question_id);
    const { data: liveQs } = await sb.from("questions").select("id, pool, status").in("id", qIds);
    const liveIds = new Set((liveQs ?? []).map((q) => q.id));
    console.log(`\n=== of ${qIds.length} answered questions, ${liveIds.size} still exist in questions table ===`);
    (liveQs ?? []).forEach((q) => console.log("  ", q));
    const missing = qIds.filter((id) => !liveIds.has(id));
    if (missing.length) console.log("  MISSING (deleted):", missing);
  }

  console.log(`\n=== module ${attempt.module_slug} question bank ===`);
  const { data: bank } = await sb
    .from("questions")
    .select("pool, status")
    .eq("module_slug", attempt.module_slug);
  const tally: Record<string, number> = {};
  (bank ?? []).forEach((q) => { const k = `${q.pool}/${q.status}`; tally[k] = (tally[k] ?? 0) + 1; });
  console.log(tally);
}

main().then(() => process.exit(0));
