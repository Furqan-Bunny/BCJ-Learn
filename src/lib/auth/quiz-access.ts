import "server-only";

// Server-side gate: can a user START a fresh quiz attempt right now?
//
// The quiz is a POST-seminar activity. Before the seminar a manager must NOT be
// able to open the quiz — not via the UI and not by typing the quiz URL. The UI
// already hides the button (see computeQuizState's "awaiting-seminar"), but that
// is cosmetic; this is the hard server-side enforcement used by both the quiz
// page and the startQuiz action.
//
// A fresh attempt is allowed only once the seminar has effectively opened:
//   • the user has checked in for the current delivery, OR
//   • the trainer has ended the session (opens the quiz to the room), OR
//   • the training day has passed (self-serve make-up).
// Anyone with ANY prior attempt (a scheduled/failed retake, or an in-progress
// row to resume) is already past this gate. Mirrors computeQuizState exactly.

import { dbClient } from "@/lib/supabase/db-client";
import { getCurrentDelivery, getCheckedInStatus } from "@/lib/db/deliveries";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export async function canStartQuizNow(slug: string, userId: string): Promise<boolean> {
  if (DEMO_MODE) return true; // demos aren't gated

  const sb = await dbClient();

  // Any prior attempt → already engaged (retake / resume) → allowed.
  const { data: attempts } = await sb
    .from("attempts")
    .select("id")
    .eq("manager_id", userId)
    .eq("module_slug", slug)
    .limit(1);
  if ((attempts?.length ?? 0) > 0) return true;

  const [{ data: mod }, delivery, checkin] = await Promise.all([
    sb.from("modules").select("scheduled_date").eq("slug", slug).maybeSingle(),
    getCurrentDelivery(slug),
    getCheckedInStatus(slug, userId),
  ]);

  if (checkin.checkedIn) return true;          // in the room
  if (delivery?.sessionEndedAt) return true;   // trainer opened the quiz to the room

  // Training day passed → self-serve make-up. Parse the date as LOCAL midnight to
  // avoid a UTC off-by-one (a date-only string is otherwise treated as UTC).
  const scheduledDate = (mod as { scheduled_date?: string | null } | null)?.scheduled_date ?? "";
  const [sy, sm, sd] = scheduledDate.split("-").map(Number);
  if (sy) {
    const now = new Date();
    const schedMidnight = new Date(sy, (sm || 1) - 1, sd || 1).getTime();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (schedMidnight < todayMidnight) return true;
  }

  // Before the seminar, never checked in, session not ended → blocked.
  return false;
}
