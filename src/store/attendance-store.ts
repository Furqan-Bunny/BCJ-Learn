"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { faker } from "@faker-js/faker";
import { managers } from "@/data/users";
import { modules } from "@/data/modules";
import { attempts } from "@/data/attempts";

// ─── Attendance store ──────────────────────────────────────────────────
// Demo model:
//   When a Manager logs in on training day and hits "Confirm I'm here",
//   their id lands in checkedIn[moduleSlug]. The Teacher's roster + counts
//   update live. No session codes, no separate sessions — login + one tap.

interface AttendanceState {
  // map of moduleSlug → set of checked-in manager ids
  checkedIn: Record<string, string[]>;
  // when each manager checked in (for "X minutes ago" display)
  checkedInAt: Record<string, string>; // key = `${moduleSlug}:${managerId}` → ISO

  // Per-module "current delivery starts at" — defaults to module's scheduledDate.
  // Attempts before this date count as previous deliveries (history); after = current.
  deliveryStartDate: Record<string, string>;
  // History of past delivery start dates per module (oldest first, current excluded).
  // When admin schedules a new delivery, the current start is pushed onto this list.
  // Combined with the original module scheduledDate, this gives us full delivery history.
  deliveryHistory: Record<string, string[]>;
  // Per-manager reset timestamp (overrides module-level for that manager only).
  // Useful when a single manager retakes the module separately from the cohort.
  managerResetAt: Record<string, string>; // key = `${moduleSlug}:${managerId}` → ISO

  // Per-module invitee list for the CURRENT delivery.
  // - Empty/undefined for the first delivery → defaults to "all managers"
  //   (per scope §5.3: 5-module program is assigned to every manager).
  // - Auto-computed when teacher schedules a re-delivery: only managers who
  //   haven't passed AND new hires who haven't taken get re-invited.
  invitees: Record<string, string[]>;

  // ─── Session lifecycle ──────────────────────────────────────────────
  // Per-module timestamps tracking the live seminar state. The teacher's
  // presenter mode flips these via "Start session" / "End session". The
  // quiz unlocks AFTER sessionEndedAt is set (matches scope §5.1: "On-site
  // quiz... after the live presentation").
  sessionStartedAt: Record<string, string>;  // moduleSlug → ISO when teacher started
  sessionEndedAt: Record<string, string>;    // moduleSlug → ISO when teacher ended (quiz opens)

  checkIn: (moduleSlug: string, managerId: string) => void;
  checkOut: (moduleSlug: string, managerId: string) => void;
  isCheckedIn: (moduleSlug: string, managerId: string) => boolean;
  getCheckedInIds: (moduleSlug: string) => string[];
  getCheckedInAt: (moduleSlug: string, managerId: string) => string | undefined;
  resetForModule: (moduleSlug: string) => void;

  // ─── Re-delivery / reset ─────────────────────────────────────────────
  /** Schedule a new delivery: clears check-ins, sets new date, AUTO-COMPUTES invitee list. */
  scheduleNewDelivery: (moduleSlug: string, newDeliveryDate?: string) => void;
  /** Returns the invitee list for the current delivery (defaults to all managers if not yet overridden). */
  getInviteesForCurrent: (moduleSlug: string) => string[];
  /** True if the manager is currently invited to this module's next delivery. */
  isInvited: (moduleSlug: string, managerId: string) => boolean;

  // ─── Session lifecycle controls (used by the presenter) ──────────────
  /** Teacher hits "Start session" → marks the seminar as live. Clears any prior end. */
  startSession: (moduleSlug: string) => void;
  /** Teacher hits "End session — open quiz" → marks the seminar as ended; quiz unlocks for checked-in managers. */
  endSession: (moduleSlug: string) => void;
  /** True if a session is currently live (started, not yet ended) for this module. */
  isSessionLive: (moduleSlug: string) => boolean;
  /** True if the seminar has ended (quiz can be taken by checked-in invitees). */
  hasSessionEnded: (moduleSlug: string) => boolean;
  /** Reset one specific manager (e.g., new hire) so they can re-take the module fresh. */
  resetManager: (moduleSlug: string, managerId: string) => void;
  /** Effective "current delivery start" date for a module (falls back to module scheduledDate). */
  getDeliveryStart: (moduleSlug: string, fallback: string) => string;
  /** Per-manager effective reset date (max of module + per-manager). */
  getEffectiveResetDate: (moduleSlug: string, managerId: string, fallback: string) => string;
}

/**
 * Auto-compute invitees for a re-delivery.
 *
 * Rule (in scope per §4.1.7 Notifications + §5.3 Admin assignment):
 *   Re-invite any manager who:
 *     • has NOT passed this module in any past delivery (failed before, missed before, or never tried), OR
 *     • is a new hire (joined after the module's original scheduledDate)
 *
 * This means:
 *   - New hires automatically land on the next delivery's roster.
 *   - Failed-before managers automatically come back for the retake-by-redelivery.
 *   - Managers who already passed are NOT re-invited (no need — they passed once).
 *     If BCJ wants annual refreshers, that's a separate trigger.
 */
function computeAutoInvitees(moduleSlug: string): string[] {
  const mod = modules.find((m) => m.slug === moduleSlug);
  const moduleOriginalDate = mod ? new Date(mod.scheduledDate).getTime() : 0;

  // Anyone who has passed this module in any delivery (across all time)
  const passedManagerIds = new Set(
    attempts
      .filter((a) => a.moduleSlug === moduleSlug && a.status === "passed")
      .map((a) => a.managerId),
  );

  // Eligible = (everyone except those who already passed)
  // Note: "new hires" naturally fall into this set because they have no attempts and no pass.
  return managers
    .filter((m) => !passedManagerIds.has(m.id))
    .map((m) => m.id);
}

// Pre-seed: simulate that ~half the cohort has already checked in,
// so Teacher's roster has data to show out-of-the-box in the demo.
faker.seed(20260512);
function seedCheckedIn() {
  const out: Record<string, string[]> = {};
  const at: Record<string, string> = {};
  for (const mod of modules) {
    // Roughly: published modules → most checked in, draft → few/none
    const ratio = mod.status === "published" ? 0.55 : mod.status === "draft" ? 0.05 : 0;
    const sample = managers.filter(() => faker.datatype.boolean(ratio));
    out[mod.slug] = sample.map((m) => m.id);
    for (const m of sample) {
      at[`${mod.slug}:${m.id}`] = faker.date.recent({ days: 1 }).toISOString();
    }
  }
  return { checkedIn: out, checkedInAt: at };
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      ...seedCheckedIn(),
      deliveryStartDate: {},
      deliveryHistory: {},
      managerResetAt: {},
      invitees: {},
      sessionStartedAt: {},
      sessionEndedAt: {},

      checkIn: (moduleSlug, managerId) =>
        set((state) => {
          const list = state.checkedIn[moduleSlug] ?? [];
          if (list.includes(managerId)) return state;
          return {
            checkedIn: { ...state.checkedIn, [moduleSlug]: [...list, managerId] },
            checkedInAt: { ...state.checkedInAt, [`${moduleSlug}:${managerId}`]: new Date().toISOString() },
          };
        }),

      checkOut: (moduleSlug, managerId) =>
        set((state) => ({
          checkedIn: {
            ...state.checkedIn,
            [moduleSlug]: (state.checkedIn[moduleSlug] ?? []).filter((id) => id !== managerId),
          },
        })),

      isCheckedIn: (moduleSlug, managerId) =>
        (get().checkedIn[moduleSlug] ?? []).includes(managerId),

      getCheckedInIds: (moduleSlug) => get().checkedIn[moduleSlug] ?? [],

      getCheckedInAt: (moduleSlug, managerId) =>
        get().checkedInAt[`${moduleSlug}:${managerId}`],

      resetForModule: (moduleSlug) =>
        set((state) => ({
          checkedIn: { ...state.checkedIn, [moduleSlug]: [] },
        })),

      scheduleNewDelivery: (moduleSlug, newDeliveryDate) =>
        set((state) => {
          const date = newDeliveryDate ?? new Date().toISOString();
          // Push the current delivery start onto the history list, so old deliveries remain queryable.
          const previousStart = state.deliveryStartDate[moduleSlug];
          const history = [...(state.deliveryHistory[moduleSlug] ?? [])];
          if (previousStart) history.push(previousStart);
          // Clear check-ins + per-manager resets for this module
          const cleanedManagerResets: Record<string, string> = {};
          for (const [k, v] of Object.entries(state.managerResetAt)) {
            if (!k.startsWith(`${moduleSlug}:`)) cleanedManagerResets[k] = v;
          }
          // Auto-compute invitees for the new delivery — only those who need it
          const newInvitees = computeAutoInvitees(moduleSlug);
          return {
            checkedIn: { ...state.checkedIn, [moduleSlug]: [] },
            deliveryStartDate: { ...state.deliveryStartDate, [moduleSlug]: date },
            deliveryHistory: { ...state.deliveryHistory, [moduleSlug]: history },
            managerResetAt: cleanedManagerResets,
            invitees: { ...state.invitees, [moduleSlug]: newInvitees },
          };
        }),

      resetManager: (moduleSlug, managerId) =>
        set((state) => ({
          checkedIn: {
            ...state.checkedIn,
            [moduleSlug]: (state.checkedIn[moduleSlug] ?? []).filter((id) => id !== managerId),
          },
          managerResetAt: {
            ...state.managerResetAt,
            [`${moduleSlug}:${managerId}`]: new Date().toISOString(),
          },
        })),

      getDeliveryStart: (moduleSlug, fallback) =>
        get().deliveryStartDate[moduleSlug] ?? fallback,

      getEffectiveResetDate: (moduleSlug, managerId, fallback) => {
        const moduleDate = get().deliveryStartDate[moduleSlug] ?? fallback;
        const personalDate = get().managerResetAt[`${moduleSlug}:${managerId}`];
        if (!personalDate) return moduleDate;
        return new Date(personalDate) > new Date(moduleDate) ? personalDate : moduleDate;
      },

      getInviteesForCurrent: (moduleSlug) => {
        const explicit = get().invitees[moduleSlug];
        // Default = all managers (per scope §5.3: 5-module program assigned to everyone).
        return explicit && explicit.length > 0 ? explicit : managers.map((m) => m.id);
      },

      isInvited: (moduleSlug, managerId) => {
        const explicit = get().invitees[moduleSlug];
        if (!explicit) return true; // default: everyone is invited until first re-delivery
        return explicit.includes(managerId);
      },

      startSession: (moduleSlug) =>
        set((state) => ({
          sessionStartedAt: { ...state.sessionStartedAt, [moduleSlug]: new Date().toISOString() },
          // Clear any stale "ended" flag from a prior session
          sessionEndedAt: Object.fromEntries(
            Object.entries(state.sessionEndedAt).filter(([k]) => k !== moduleSlug),
          ),
        })),

      endSession: (moduleSlug) =>
        set((state) => ({
          sessionEndedAt: { ...state.sessionEndedAt, [moduleSlug]: new Date().toISOString() },
        })),

      isSessionLive: (moduleSlug) => {
        const s = get();
        return !!s.sessionStartedAt[moduleSlug] && !s.sessionEndedAt[moduleSlug];
      },

      hasSessionEnded: (moduleSlug) => !!get().sessionEndedAt[moduleSlug],
    }),
    {
      name: "bcj-learn:attendance",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
      partialize: (state) => ({
        checkedIn: state.checkedIn,
        checkedInAt: state.checkedInAt,
        deliveryStartDate: state.deliveryStartDate,
        deliveryHistory: state.deliveryHistory,
        managerResetAt: state.managerResetAt,
        invitees: state.invitees,
        sessionStartedAt: state.sessionStartedAt,
        sessionEndedAt: state.sessionEndedAt,
      }),
    },
  ),
);
