import { faker } from "@faker-js/faker";
import type { ActivityEvent, ActivityKind, NotificationItem, NotificationKind } from "@/types";
import { managers, admins, teachers } from "./users";
import { modules } from "./modules";
import { attempts } from "./attempts";

faker.seed(20260504);

const events: ActivityEvent[] = [];
let id = 1;

// Drive activity from real attempts
for (const a of attempts.slice(-40)) {
  const m = managers.find((x) => x.id === a.managerId);
  const mod = modules.find((x) => x.slug === a.moduleSlug);
  if (!m || !mod) continue;
  if (a.status === "passed") {
    events.push({
      id: `e-${id++}`,
      kind: "quiz_passed",
      actorId: m.id,
      targetId: mod.slug,
      message: `${m.name} passed ${mod.title} (${a.scorePct}%).`,
      occurredAt: a.submittedAt!,
    });
  } else if (a.status === "failed") {
    events.push({
      id: `e-${id++}`,
      kind: "quiz_failed",
      actorId: m.id,
      targetId: mod.slug,
      message: `${m.name} did not reach 85% on ${mod.title}.`,
      occurredAt: a.submittedAt!,
    });
  }
}

// Add some admin/teacher events
const adminMessages: { kind: ActivityKind; tmpl: (name: string) => string }[] = [
  { kind: "user_added", tmpl: (n) => `${n} added a new Employee.` },
  { kind: "module_published", tmpl: (n) => `${n} published Module 2 — Quality Control & Safety.` },
  { kind: "reminder_sent", tmpl: (n) => `${n} sent a reminder to 12 overdue employees.` },
  { kind: "questions_approved", tmpl: (n) => `${n} approved 8 questions on Module 3.` },
  { kind: "report_exported", tmpl: (n) => `${n} exported the Cohort summary report.` },
  { kind: "manager_flagged", tmpl: () => `System flagged an employee: failed retake on Module 1.` },
  { kind: "delivery_rescheduled", tmpl: (n) => `${n} scheduled a re-delivery of Module 1 (16 invitees auto-queued).` },
  { kind: "session_started", tmpl: (n) => `${n} started the Module 1 live session.` },
  { kind: "session_ended", tmpl: (n) => `${n} ended the Module 1 session — quiz now open.` },
  { kind: "manager_checked_in", tmpl: () => `Salma Heller checked in to today's Module 1 session.` },
];

for (const t of [...admins, ...teachers]) {
  for (let k = 0; k < 3; k++) {
    const ev = faker.helpers.arrayElement(adminMessages);
    events.push({
      id: `e-${id++}`,
      kind: ev.kind,
      actorId: t.id,
      message: ev.tmpl(t.name),
      occurredAt: faker.date.recent({ days: 14 }).toISOString(),
    });
  }
}

events.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));

export const activity = events;
export const recentActivity = events.slice(0, 25);

// Notifications
const NOTIF_KINDS: { kind: NotificationKind; subject: string; preview: string }[] = [
  { kind: "invitation", subject: "Welcome to BCJ Learn", preview: "Your Module 1 training is scheduled for June 12, 2026." },
  { kind: "reminder", subject: "Module 1 quiz is tomorrow", preview: "Reminder — your in-person training session is on…" },
  { kind: "result", subject: "You passed Module 1", preview: "Congratulations! Your score was 92%." },
  { kind: "result", subject: "Retake scheduled — Module 1", preview: "Your Department Lead will follow up with the retake date." },
  { kind: "alert", subject: "At-risk: needs attention", preview: "A direct report has failed twice on Module 1." },
];

export const notifications: NotificationItem[] = managers.slice(0, 30).map((m, idx) => {
  const t = NOTIF_KINDS[idx % NOTIF_KINDS.length];
  return {
    id: `n-${idx + 1}`,
    kind: t.kind,
    recipientId: m.id,
    subject: t.subject,
    preview: t.preview,
    sentAt: faker.date.recent({ days: 10 }).toISOString(),
    opened: faker.datatype.boolean(0.6),
  };
});
