/**
 * BCJ Learn — backfill the current roster with everyone who took the quiz
 *
 * For a module's CURRENT (open) delivery, adds every manager who already has an
 * attempt on that delivery as an invitee (module_invitees), so they show up in
 * the roster. Idempotent — people already invited are left alone. Use when a
 * seminar was run on a delivery that wasn't invited to (e.g. quiz-takers appear
 * in Reports but not the roster).
 *
 * Usage (run it yourself in the session shell):
 *   ! npx tsx scripts/add-attendees-to-roster.ts
 *   ! npx tsx scripts/add-attendees-to-roster.ts <module-slug>
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const slug = process.argv[2] ?? "hr-core-values-culture-hr-and-our-people";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`🚀  Backfilling roster for module: ${slug}`);

  // 1. Current open delivery.
  const { data: del, error: delErr } = await sb
    .from("module_deliveries")
    .select("id, delivery_index, scheduled_date")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (delErr) throw delErr;
  if (!del) { console.error(`✗ No open delivery for ${slug}.`); process.exit(1); }
  const deliveryId = (del as { id: string; delivery_index: number }).id;
  console.log(`    Current delivery: D${(del as { delivery_index: number }).delivery_index} (${deliveryId})`);

  // 2. Everyone with an attempt on this delivery.
  const { data: attemptRows, error: aErr } = await sb
    .from("attempts")
    .select("manager_id")
    .eq("delivery_id", deliveryId);
  if (aErr) throw aErr;
  const takerIds = Array.from(new Set(((attemptRows ?? []) as { manager_id: string }[]).map((r) => r.manager_id)));
  console.log(`    Distinct quiz-takers on this delivery: ${takerIds.length}`);

  // 3. Who's already an invitee.
  const { data: inviteeRows, error: iErr } = await sb
    .from("module_invitees")
    .select("manager_id")
    .eq("delivery_id", deliveryId);
  if (iErr) throw iErr;
  const already = new Set(((inviteeRows ?? []) as { manager_id: string }[]).map((r) => r.manager_id));

  const toAdd = takerIds.filter((id) => !already.has(id));
  if (toAdd.length === 0) { console.log("✅  Everyone who took it is already on the roster. Nothing to do."); return; }

  // 4. Insert the missing ones (idempotent on the (delivery_id, manager_id) PK).
  const { error: upErr } = await sb
    .from("module_invitees")
    .upsert(toAdd.map((id) => ({ delivery_id: deliveryId, manager_id: id, status: "invited" })), {
      onConflict: "delivery_id,manager_id",
    });
  if (upErr) throw upErr;

  // 5. Print names for confirmation.
  const { data: names } = await sb.from("profiles").select("name").in("id", toAdd);
  console.log(`✅  Added ${toAdd.length} quiz-taker(s) to the roster:`);
  for (const p of (names ?? []) as { name: string }[]) console.log(`     • ${p.name}`);
  console.log("\n    Refresh the module's Roster tab to see them.");
}

main().catch((err) => {
  console.error("\n💥  Failed:", err.message ?? err);
  process.exit(1);
});
