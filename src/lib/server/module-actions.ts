"use server";

// Module-level server actions: create, publish, re-deliver, schedule sessions,
// reset a manager's progress in a single module.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { pushInAppNotification } from "@/lib/notifications/push";
import { getModule, listModuleContentVersions } from "@/lib/db/modules";
import { sendEmail } from "@/lib/emails/send";
import { ensurePresentableContent } from "@/lib/server/present-content";
import { fmtDate } from "@/lib/format";
import type { ContentType, Lesson, LessonContent, ModuleStatus, Role, CheckinState } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

// "June 2026" from a "YYYY-MM-DD" date string (for modules.scheduled_month).
function monthLabel(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface Guard {
  ok: true;
  userId: string;
  userName: string;
  role: Role;
}
type GuardResult = Guard | { ok: false; error: string };

async function requireAdmin(): Promise<GuardResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data } = await sb.from("profiles").select("role, name").eq("id", user.id).single();
  const p = data as { role?: Role; name?: string } | null;
  if (!p || p.role !== "admin") return { ok: false, error: "Admin access required" };
  return { ok: true, userId: user.id, userName: p.name ?? "", role: p.role };
}

async function requireAdminOrModuleOwner(moduleSlug: string): Promise<GuardResult> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: profileRow } = await sb.from("profiles").select("role, name").eq("id", user.id).single();
  const p = profileRow as { role?: Role; name?: string } | null;
  if (!p) return { ok: false, error: "Profile not found" };
  if (p.role === "admin") return { ok: true, userId: user.id, userName: p.name ?? "", role: "admin" };
  if (p.role !== "teacher") return { ok: false, error: "Admin or teacher role required" };
  const { data: owner } = await sb
    .from("module_owners")
    .select("teacher_id")
    .eq("module_slug", moduleSlug)
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (!owner) return { ok: false, error: "You don't own this module" };
  return { ok: true, userId: user.id, userName: p.name ?? "", role: "teacher" };
}

// ─── createModule ──────────────────────────────────────────────────────

export interface CreateModuleInput {
  slug: string;
  number: number;
  title: string;
  description: string;
  scheduledMonth: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  timezone: string | null;
  status: ModuleStatus;
  passThreshold: number;
  questionCount: number;
  timeLimitMinutes: number | null;
  ownerTeacherIds: string[];
  lessons: Lesson[];
}

export async function createModule(input: CreateModuleInput): Promise<{ ok: boolean; error?: string; slug?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true, slug: input.slug };

  const admin = createAdminClient();

  const { error: modErr } = await admin.from("modules").insert({
    slug: input.slug,
    number: input.number,
    title: input.title,
    description: input.description,
    scheduled_month: input.scheduledMonth,
    scheduled_date: input.scheduledDate,
    scheduled_time: input.scheduledTime,
    timezone: input.timezone,
    status: input.status,
    pass_threshold: input.passThreshold,
    question_count: input.questionCount,
    time_limit_minutes: input.timeLimitMinutes,
  });
  if (modErr) return { ok: false, error: modErr.message };

  if (input.ownerTeacherIds.length > 0) {
    const ownerRows = input.ownerTeacherIds.map((tid, i) => ({
      module_slug: input.slug,
      teacher_id: tid,
      is_primary: i === 0,
    }));
    const { error: ownerErr } = await admin.from("module_owners").insert(ownerRows);
    if (ownerErr) return { ok: false, error: ownerErr.message };
  }

  // Lessons + contents
  for (const lesson of input.lessons) {
    const { data: lessonRow, error: lErr } = await admin
      .from("lessons")
      .insert({
        module_slug: input.slug,
        order: lesson.order,
        title: lesson.title,
        description: lesson.description,
        duration_minutes: lesson.durationMinutes,
      })
      .select("id")
      .single();
    if (lErr || !lessonRow) {
      await admin.from("modules").delete().eq("slug", input.slug); // rollback
      return { ok: false, error: lErr?.message ?? "Failed to insert lesson" };
    }
    const lessonId = (lessonRow as { id: string }).id;

    if (lesson.contents.length > 0) {
      const contentRows = lesson.contents.map((c: LessonContent, i: number) => ({
        lesson_id: lessonId,
        type: c.type as ContentType,
        title: c.title,
        duration_minutes: c.durationMinutes ?? null,
        video_url: c.videoUrl ?? null,
        storage_path: c.storagePath ?? null,
        external_url: c.externalUrl ?? null,
        metadata: {
          videoThumbnail: c.videoThumbnail,
          documentPages: c.documentPages,
          slides: c.slides,
          fileName: c.fileName,
          fileSize: c.fileSize,
          presentationHidden: c.presentationHidden ?? false,
          previewHidden: c.previewHidden ?? false,
        },
        order: i,
      }));
      const { error: cErr } = await admin.from("lesson_contents").insert(contentRows);
      if (cErr) {
        await admin.from("modules").delete().eq("slug", input.slug);
        return { ok: false, error: cErr.message };
      }
    }
  }

  // Create the first delivery + auto-invite ONLY when a seminar date is set.
  // An undated draft must NOT create a phantom "open delivery" with the whole
  // company invited (that polluted every roster/count before the seminar was
  // even scheduled). scheduleSeminar owns delivery + invitee creation otherwise.
  if (input.scheduledDate) {
    const { data: deliveryRow } = await admin
      .from("module_deliveries")
      .insert({
        module_slug: input.slug,
        delivery_index: 1,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        timezone: input.timezone,
      })
      .select("id")
      .single();
    if (deliveryRow) {
      const deliveryId = (deliveryRow as { id: string }).id;
      const { data: managers } = await admin
        .from("profiles")
        .select("id")
        .eq("role", "manager")
        .not("status", "in", "(inactive,pending)");
      if (managers && managers.length > 0) {
        const inviteeRows = (managers as { id: string }[]).map((m) => ({
          delivery_id: deliveryId,
          manager_id: m.id,
        }));
        await admin.from("module_invitees").insert(inviteeRows);
      }
    }
  }

  await admin.from("activity").insert({
    kind: "module_published",
    actor_id: guard.userId,
    message: `${guard.userName} created module M${input.number}: ${input.title}`,
  });

  revalidatePath("/admin/modules");
  revalidatePath("/teacher/modules");
  return { ok: true, slug: input.slug };
}

// ─── content versioning helpers ────────────────────────────────────────

// Snapshot a module's current lessons+contents tree before it's overwritten,
// so it can be reviewed and restored. Module-level (not per-row) because saving
// deletes + re-inserts every lesson/content with new IDs. Best-effort.
async function snapshotModuleContent(
  admin: ReturnType<typeof createAdminClient>,
  moduleSlug: string,
  changeReason: string,
  userId: string | null,
): Promise<void> {
  try {
    const mod = await getModule(moduleSlug);
    if (!mod || mod.lessons.length === 0) return;
    const { data: maxRow } = await admin
      .from("module_content_versions")
      .select("version_number")
      .eq("module_slug", moduleSlug)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((maxRow as { version_number?: number } | null)?.version_number ?? 0) + 1;
    await admin.from("module_content_versions").insert({
      module_slug: moduleSlug,
      version_number: nextVersion,
      snapshot: mod.lessons,
      change_reason: changeReason,
      changed_by: userId,
    });
  } catch {
    // Non-fatal: versioning is additive; never block the save/restore.
  }
}

// Replace all lessons + lesson_contents for a module (delete + re-insert in
// order). Shared by updateModuleLessons and restoreModuleContentVersion.
async function replaceLessons(
  admin: ReturnType<typeof createAdminClient>,
  moduleSlug: string,
  lessons: Lesson[],
): Promise<{ ok: boolean; error?: string }> {
  await admin.from("lessons").delete().eq("module_slug", moduleSlug);

  for (const lesson of lessons) {
    const { data: lessonRow, error: lErr } = await admin
      .from("lessons")
      .insert({
        module_slug: moduleSlug,
        order: lesson.order,
        title: lesson.title,
        description: lesson.description,
        duration_minutes: lesson.durationMinutes,
      })
      .select("id")
      .single();
    if (lErr || !lessonRow) return { ok: false, error: lErr?.message ?? "Failed to insert lesson" };
    const lessonId = (lessonRow as { id: string }).id;

    if (lesson.contents.length > 0) {
      const contentRows = lesson.contents.map((c, i) => ({
        lesson_id: lessonId,
        type: c.type as ContentType,
        title: c.title,
        duration_minutes: c.durationMinutes ?? null,
        video_url: c.videoUrl ?? null,
        storage_path: c.storagePath ?? null,
        external_url: c.externalUrl ?? null,
        metadata: {
          videoThumbnail: c.videoThumbnail,
          documentPages: c.documentPages,
          slides: c.slides,
          fileName: c.fileName,
          fileSize: c.fileSize,
          presentationHidden: c.presentationHidden ?? false,
          previewHidden: c.previewHidden ?? false,
        },
        order: i,
      }));
      const { error: cErr } = await admin.from("lesson_contents").insert(contentRows);
      if (cErr) return { ok: false, error: cErr.message };
    }
  }
  return { ok: true };
}

// ─── updateModuleLessons ───────────────────────────────────────────────
// Replaces all lessons + lesson_contents for a module, snapshotting the prior
// version first. lesson_contents cascade on lesson delete.

export async function updateModuleLessons(
  moduleSlug: string,
  lessons: Lesson[],
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();

  // Preserve the current content as a version before overwriting.
  await snapshotModuleContent(admin, moduleSlug, "edited", guard.userId);

  const res = await replaceLessons(admin, moduleSlug, lessons);
  if (!res.ok) return res;

  // Bump the content version so AI questions generated against the previous
  // content get tagged "older content" in the question bank.
  const { data: mv } = await admin.from("modules").select("content_version").eq("slug", moduleSlug).single();
  const nextVersion = ((mv as { content_version?: number } | null)?.content_version ?? 1) + 1;
  await admin.from("modules").update({ content_version: nextVersion }).eq("slug", moduleSlug);

  // Pre-warm extraction for any newly-added documents/slides (best-effort) so
  // they're presentable instantly on seminar day. Already-cached items are
  // skipped by the hasReal* guards.
  await ensurePresentableContent(moduleSlug).catch(() => {});

  revalidatePath(`/teacher/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}/content`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/manager/modules/${moduleSlug}`);
  return { ok: true };
}

// ─── content version history: list + restore ───────────────────────────

export async function getModuleContentVersions(moduleSlug: string) {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  const versions = await listModuleContentVersions(moduleSlug);
  return { ok: true as const, versions };
}

export async function restoreModuleContentVersion(
  moduleSlug: string,
  versionNumber: number,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: verRow } = await admin
    .from("module_content_versions")
    .select("snapshot")
    .eq("module_slug", moduleSlug)
    .eq("version_number", versionNumber)
    .maybeSingle();
  if (!verRow) return { ok: false, error: "Version not found" };
  const lessons = ((verRow as { snapshot?: Lesson[] }).snapshot ?? []) as Lesson[];

  // Snapshot the current state before reverting, so a restore is reversible.
  await snapshotModuleContent(admin, moduleSlug, "restored", guard.userId);

  const res = await replaceLessons(admin, moduleSlug, lessons);
  if (!res.ok) return res;

  // A restore is a content change too — bump the version so the question bank can
  // flag questions authored against the pre-restore content as "older content".
  // (Keeps content_version = 1 + number of content_version snapshots in sync.)
  const { data: mv } = await admin.from("modules").select("content_version").eq("slug", moduleSlug).single();
  const nextVersion = ((mv as { content_version?: number } | null)?.content_version ?? 1) + 1;
  await admin.from("modules").update({ content_version: nextVersion }).eq("slug", moduleSlug);

  // Pre-warm extraction for any newly-added documents/slides (best-effort) so
  // they're presentable instantly on seminar day. Already-cached items are
  // skipped by the hasReal* guards.
  await ensurePresentableContent(moduleSlug).catch(() => {});

  revalidatePath(`/teacher/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}/content`);
  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/manager/modules/${moduleSlug}`);
  return { ok: true };
}

// ─── publishModule ──────────────────────────────────────────────────────

export async function publishModule(slug: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin.from("modules").update({ status: "published" }).eq("slug", slug);
  if (error) return { ok: false, error: error.message };

  await admin.from("activity").insert({
    kind: "module_published",
    actor_id: guard.userId,
    message: `${guard.userName} published module ${slug}`,
  });

  // Pre-warm document/slide extraction now (best-effort) so the seminar-day
  // presenter loads instantly instead of paying extraction on first present.
  await ensurePresentableContent(slug).catch(() => {});

  revalidatePath(`/admin/modules/${slug}`);
  revalidatePath(`/teacher/modules/${slug}`);
  return { ok: true };
}

// ─── unpublishModule (back to draft) ────────────────────────────────────

export async function unpublishModule(slug: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin.from("modules").update({ status: "draft" }).eq("slug", slug);
  if (error) return { ok: false, error: error.message };

  await admin.from("activity").insert({
    kind: "module_published",
    actor_id: guard.userId,
    message: `${guard.userName} set module ${slug} back to draft`,
  });

  revalidatePath(`/admin/modules/${slug}`);
  revalidatePath(`/teacher/modules/${slug}`);
  return { ok: true };
}

// NOTE: the old `scheduleRedelivery` wrapper + its `schedule_redelivery` RPC are
// retired — the live "schedule a new delivery" path is scheduleSeminar() below
// (used by the ScheduleRedelivery UI component). The RPC remains dormant in the DB.

// ─── editable seminar roster: add / remove an invitee ──────────────────

async function currentDeliveryId(
  admin: ReturnType<typeof createAdminClient>,
  slug: string,
): Promise<string | null> {
  const { data } = await admin
    .from("module_deliveries")
    .select("id")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export async function addInvitee(moduleSlug: string, managerId: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const deliveryId = await currentDeliveryId(admin, moduleSlug);
  if (!deliveryId) return { ok: false, error: "No active seminar — schedule one first." };

  const { error } = await admin
    .from("module_invitees")
    .upsert(
      { delivery_id: deliveryId, manager_id: managerId, status: "invited" },
      { onConflict: "delivery_id,manager_id" },
    );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}`);
  return { ok: true };
}

export async function removeInvitee(moduleSlug: string, managerId: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const deliveryId = await currentDeliveryId(admin, moduleSlug);
  if (!deliveryId) return { ok: false, error: "No active seminar." };

  await admin.from("module_invitees").delete().eq("delivery_id", deliveryId).eq("manager_id", managerId);
  await admin.from("attendance").delete().eq("delivery_id", deliveryId).eq("manager_id", managerId);

  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}`);
  return { ok: true };
}

// ─── schedule a seminar: preview the due list, then invite + email ─────

// Active employees who haven't passed this module in the last 12 months
// (new hires + past fails + recert-due). Mirrors the schedule_redelivery SQL.
export async function getDueEmployees(moduleSlug: string) {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: managers }, { data: passes }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, email, cohort")
      .eq("role", "manager")
      .not("status", "in", "(inactive,pending)")
      .order("name"),
    admin
      .from("attempts")
      .select("manager_id")
      .eq("module_slug", moduleSlug)
      .eq("status", "passed")
      .gt("started_at", cutoff),
  ]);

  const passedRecently = new Set(((passes ?? []) as { manager_id: string }[]).map((a) => a.manager_id));
  const employees = ((managers ?? []) as { id: string; name: string; email: string; cohort: string | null }[])
    .filter((m) => !passedRecently.has(m.id))
    .map((m) => ({ id: m.id, name: m.name, email: m.email, cohort: m.cohort }));

  return { ok: true as const, employees };
}

// Like getDueEmployees but returns EVERY active employee with a `due` flag (due =
// hasn't passed in the last 12 months). The Schedule-seminar dialog pre-selects
// the due ones but lets the lead search and add anyone else too.
export async function listSeminarCandidates(moduleSlug: string) {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false as const, error: guard.error };

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: managers }, { data: passes }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, email, cohort")
      .eq("role", "manager")
      .not("status", "in", "(inactive,pending)")
      .order("name"),
    admin
      .from("attempts")
      .select("manager_id")
      .eq("module_slug", moduleSlug)
      .eq("status", "passed")
      .gt("started_at", cutoff),
  ]);

  const passedRecently = new Set(((passes ?? []) as { manager_id: string }[]).map((a) => a.manager_id));
  const employees = ((managers ?? []) as { id: string; name: string; email: string; cohort: string | null }[])
    .map((m) => ({ id: m.id, name: m.name, email: m.email, cohort: m.cohort, due: !passedRecently.has(m.id) }));

  return { ok: true as const, employees };
}

// Ends the current open delivery, creates a new one on `date`, invites exactly
// `managerIds`, and emails each of them that the seminar is scheduled.
export async function scheduleSeminar(moduleSlug: string, date: string, managerIds: string[], time?: string | null, timezone?: string | null) {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (DEMO_MODE) return { ok: true as const, invited: managerIds.length, emailed: 0 };

  const admin = createAdminClient();

  await admin
    .from("module_deliveries")
    .update({ ended_at: new Date().toISOString() })
    .eq("module_slug", moduleSlug)
    .is("ended_at", null);

  const { data: maxRow } = await admin
    .from("module_deliveries")
    .select("delivery_index")
    .eq("module_slug", moduleSlug)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextIndex = ((maxRow as { delivery_index?: number } | null)?.delivery_index ?? 0) + 1;

  const { data: deliveryRow, error: dErr } = await admin
    .from("module_deliveries")
    .insert({ module_slug: moduleSlug, delivery_index: nextIndex, scheduled_date: date, scheduled_time: time ?? null, timezone: timezone ?? null })
    .select("id")
    .single();
  if (dErr || !deliveryRow) return { ok: false as const, error: dErr?.message ?? "Could not create the seminar" };
  const deliveryId = (deliveryRow as { id: string }).id;

  if (managerIds.length > 0) {
    await admin.from("module_invitees").insert(
      managerIds.map((id) => ({ delivery_id: deliveryId, manager_id: id, status: "invited" })),
    );
  }

  // Keep the module row in sync so every display reflects the current seminar.
  await admin.from("modules").update({
    scheduled_date: date,
    scheduled_month: monthLabel(date),
    scheduled_time: time ?? null,
    ...(timezone !== undefined ? { timezone: timezone ?? null } : {}),
  }).eq("slug", moduleSlug);

  // Emails are NOT sent here — the client calls notifySeminar() in batches so it
  // can show live progress. We just return the recipient list.
  const mod = await getModule(moduleSlug);
  const moduleTitle = mod?.title ?? moduleSlug;

  let recipients: { id: string; name: string; email: string }[] = [];
  if (managerIds.length > 0) {
    const { data: people } = await admin.from("profiles").select("id, name, email").in("id", managerIds);
    recipients = (people ?? []) as { id: string; name: string; email: string }[];
  }

  await admin.from("activity").insert({
    kind: "delivery_rescheduled",
    actor_id: guard.userId,
    message: `${guard.userName} scheduled a seminar for ${moduleTitle} on ${fmtDate(date)} (${managerIds.length} invited)`,
  });

  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}`);
  return { ok: true as const, invited: managerIds.length, recipients };
}

// Send the seminar email (scheduled or rescheduled) to a batch of recipients,
// in parallel. The client calls this per chunk to drive a progress indicator.
export async function notifySeminar(
  moduleSlug: string,
  mode: "scheduled" | "rescheduled",
  recipientIds: string[],
) {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false as const, error: guard.error, sent: 0 };
  if (DEMO_MODE || recipientIds.length === 0) return { ok: true as const, sent: 0 };

  const admin = createAdminClient();
  const mod = await getModule(moduleSlug);
  const moduleTitle = mod?.title ?? moduleSlug;
  const link = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/login`;
  const templateKey = mode === "rescheduled" ? "seminar_rescheduled" : "seminar_scheduled";

  const { data: del } = await admin
    .from("module_deliveries")
    .select("scheduled_date")
    .eq("module_slug", moduleSlug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sd = (del as { scheduled_date?: string } | null)?.scheduled_date;
  const seminarDate = sd ? fmtDate(sd) : "soon";

  const { data: people } = await admin.from("profiles").select("id, name, email").in("id", recipientIds);
  const list = (people ?? []) as { id: string; name: string; email: string }[];

  const results = await Promise.all(
    list.map((p) =>
      sendEmail({
        to: p.email,
        templateKey,
        recipientUserId: p.id,
        href: "/manager/dashboard",
        variables: { name: p.name ?? "there", module_title: moduleTitle, seminar_date: seminarDate, link },
      })
        .then((r) => r.ok)
        .catch(() => false),
    ),
  );
  return { ok: true as const, sent: results.filter(Boolean).length };
}

// Move the CURRENT (active) seminar to a new date — same delivery, same
// attendees — and email everyone already invited about the new date.
export async function rescheduleSeminar(moduleSlug: string, newDate: string, newTime?: string | null, timezone?: string | null) {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false as const, error: guard.error };
  if (DEMO_MODE) return { ok: true as const, emailed: 0 };

  const admin = createAdminClient();
  const deliveryId = await currentDeliveryId(admin, moduleSlug);
  if (!deliveryId) return { ok: false as const, error: "No active seminar to reschedule — schedule one first." };

  await admin.from("module_deliveries")
    .update({
      scheduled_date: newDate,
      ...(newTime !== undefined ? { scheduled_time: newTime } : {}),
      ...(timezone !== undefined ? { timezone: timezone ?? null } : {}),
      // Reset check-in so the rescheduled seminar mints a fresh code on open
      // (a stale code from a prior run is never silently reused).
      checkin_code: null,
      checkin_opened_at: null,
    })
    .eq("id", deliveryId);

  // Sync the module row so the header/cards/schedule actually show the new date.
  await admin.from("modules").update({
    scheduled_date: newDate,
    scheduled_month: monthLabel(newDate),
    ...(newTime !== undefined ? { scheduled_time: newTime } : {}),
    ...(timezone !== undefined ? { timezone: timezone ?? null } : {}),
  }).eq("slug", moduleSlug);

  const mod = await getModule(moduleSlug);
  const moduleTitle = mod?.title ?? moduleSlug;

  const { data: invitees } = await admin
    .from("module_invitees")
    .select("manager_id")
    .eq("delivery_id", deliveryId);
  const ids = ((invitees ?? []) as { manager_id: string }[]).map((r) => r.manager_id);

  // Emails sent separately via notifySeminar() so the client can show progress.
  let recipients: { id: string; name: string; email: string }[] = [];
  if (ids.length > 0) {
    const { data: people } = await admin.from("profiles").select("id, name, email").in("id", ids);
    recipients = (people ?? []) as { id: string; name: string; email: string }[];
  }

  await admin.from("activity").insert({
    kind: "delivery_rescheduled",
    actor_id: guard.userId,
    message: `${guard.userName} rescheduled the ${moduleTitle} seminar to ${fmtDate(newDate)} (${ids.length} notified)`,
  });

  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}`);
  return { ok: true as const, recipients };
}

// ─── startSession / endSession ─────────────────────────────────────────

export async function startSession(slug: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "No open delivery for this module" };

  const { error } = await admin
    .from("module_deliveries")
    .update({ session_started_at: new Date().toISOString() })
    .eq("id", (delivery as { id: string }).id);
  if (error) return { ok: false, error: error.message };

  await admin.from("activity").insert({
    kind: "session_started",
    actor_id: guard.userId,
    message: `${guard.userName} started the session for ${slug}`,
  });

  revalidatePath(`/teacher/modules/${slug}`);
  revalidatePath(`/admin/modules/${slug}`);
  return { ok: true };
}

export async function endSession(slug: string): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "No open delivery for this module" };

  const { error } = await admin
    .from("module_deliveries")
    .update({ session_ended_at: new Date().toISOString() })
    .eq("id", (delivery as { id: string }).id);
  if (error) return { ok: false, error: error.message };

  await admin.from("activity").insert({
    kind: "session_ended",
    actor_id: guard.userId,
    message: `${guard.userName} ended the session for ${slug}`,
  });

  revalidatePath(`/teacher/modules/${slug}/results`);
  return { ok: true };
}

// ─── Check-in lobby (phase 1 of the presenter) ─────────────────────────
//
// The trainer opens check-in from the presenter lobby. That mints a short code
// (shown on the projector) which employees must enter to check in — so only
// people physically in the room can. The trainer can only open check-in once
// the scheduled start time has arrived (enforced on their device); employees
// simply cannot check in until checkin_opened_at is set and the session hasn't
// started yet.

function makeCheckinCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
}

export async function openCheckIn(slug: string): Promise<{ ok: boolean; error?: string; code?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true, code: "1234" };

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id, checkin_code, checkin_opened_at, session_started_at")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "No open delivery — schedule a seminar first." };
  const d = delivery as { id: string; checkin_code: string | null; checkin_opened_at: string | null };

  // Reuse the existing code if check-in is already open.
  const code = d.checkin_code ?? makeCheckinCode();
  const { error } = await admin
    .from("module_deliveries")
    .update({ checkin_opened_at: d.checkin_opened_at ?? new Date().toISOString(), checkin_code: code })
    .eq("id", d.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/teacher/modules/${slug}/present`);
  return { ok: true, code };
}

// Force a brand-new check-in code for the current delivery. Unlike openCheckIn
// (which reuses an existing code so re-opening the lobby UI doesn't churn it),
// this always mints a fresh 4-digit code — for when the trainer wants a new
// wave of check-ins or the room never got a code. Keeps check-in open.
export async function regenerateCheckinCode(slug: string): Promise<{ ok: boolean; error?: string; code?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (DEMO_MODE) return { ok: true, code: "1234" };

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id, checkin_opened_at")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ok: false, error: "No open delivery — schedule a seminar first." };
  const d = delivery as { id: string; checkin_opened_at: string | null };

  const code = makeCheckinCode();
  const { error } = await admin
    .from("module_deliveries")
    .update({ checkin_code: code, checkin_opened_at: d.checkin_opened_at ?? new Date().toISOString() })
    .eq("id", d.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/teacher/modules/${slug}/present`);
  return { ok: true, code };
}

// Live lobby state for the presenter — polled while in the check-in phase.
export async function getCheckinState(slug: string): Promise<CheckinState> {
  const empty: CheckinState = { ok: false, open: false, code: null, scheduledDate: null, scheduledTime: null, sessionStarted: false, sessionEnded: false, invited: 0, checkedIn: [] };
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ...empty, error: guard.error };

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("module_deliveries")
    .select("id, checkin_opened_at, checkin_code, scheduled_date, scheduled_time, session_started_at, session_ended_at")
    .eq("module_slug", slug)
    .is("ended_at", null)
    .order("delivery_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!delivery) return { ...empty, ok: true };
  const d = delivery as {
    id: string; checkin_opened_at: string | null; checkin_code: string | null;
    scheduled_date: string | null; scheduled_time: string | null;
    session_started_at: string | null; session_ended_at: string | null;
  };

  const [{ count: invited }, { data: att }] = await Promise.all([
    admin.from("module_invitees").select("id", { count: "exact", head: true }).eq("delivery_id", d.id),
    admin.from("attendance").select("manager_id, checked_in_at").eq("delivery_id", d.id),
  ]);

  const rows = (att ?? []) as { manager_id: string; checked_in_at: string }[];
  let checkedIn: { id: string; name: string; at: string }[] = [];
  if (rows.length > 0) {
    const { data: people } = await admin.from("profiles").select("id, name").in("id", rows.map((r) => r.manager_id));
    const nameById = new Map(((people ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
    checkedIn = rows
      .map((r) => ({ id: r.manager_id, name: nameById.get(r.manager_id) ?? "Manager", at: r.checked_in_at }))
      .sort((a, b) => +new Date(a.at) - +new Date(b.at));
  }

  return {
    ok: true,
    open: !!d.checkin_opened_at,
    code: d.checkin_code,
    scheduledDate: d.scheduled_date,
    scheduledTime: d.scheduled_time,
    sessionStarted: !!d.session_started_at,
    sessionEnded: !!d.session_ended_at,
    invited: invited ?? 0,
    checkedIn,
  };
}

// ─── resetManagerForModule ─────────────────────────────────────────────

export async function resetManagerForModule(
  managerId: string,
  moduleSlug: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();

  // The target must actually be on this module (an invitee of a delivery, or
  // someone who has attempted it) — so a caller can't reset / notify an
  // arbitrary user by passing any id.
  const { data: delRows } = await admin.from("module_deliveries").select("id").eq("module_slug", moduleSlug);
  const deliveryIds = ((delRows ?? []) as { id: string }[]).map((d) => d.id);
  const [{ data: attempt }, { data: invitee }] = await Promise.all([
    admin.from("attempts").select("id").eq("manager_id", managerId).eq("module_slug", moduleSlug).limit(1).maybeSingle(),
    deliveryIds.length
      ? admin.from("module_invitees").select("manager_id").eq("manager_id", managerId).in("delivery_id", deliveryIds).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!attempt && !invitee) {
    return { ok: false, error: "That person isn't on this module's roster." };
  }

  const { error } = await admin.from("module_member_resets").insert({
    module_slug: moduleSlug,
    manager_id: managerId,
    reset_by: guard.userId,
    reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Truly unlock: clear an at-risk flag and remove stale non-terminal attempts so
  // they can't resurrect. The strike count is cutoff-scoped (the reset_at just
  // inserted moves the cutoff), so prior failures stop counting and the manager
  // gets a fresh set of attempts.
  await admin.from("profiles").update({ status: "active" })
    .eq("id", managerId).eq("role", "manager").eq("status", "at-risk");
  await admin.from("attempts").delete()
    .eq("manager_id", managerId).eq("module_slug", moduleSlug)
    .in("status", ["scheduled", "in-progress"]);

  await admin.from("activity").insert({
    kind: "retake_scheduled",
    actor_id: guard.userId,
    target_id: managerId,
    message: `${guard.userName} reset progress on ${moduleSlug}`,
  });

  // Look up the module title for a friendlier subject line.
  const { data: mod } = await admin
    .from("modules")
    .select("title")
    .eq("slug", moduleSlug)
    .maybeSingle();
  const moduleTitle = (mod as { title?: string } | null)?.title ?? moduleSlug;

  await pushInAppNotification({
    recipientId: managerId,
    kind: "reminder",
    subject: `Retake scheduled — ${moduleTitle}`,
    preview: reason
      ? `Your progress on ${moduleTitle} has been reset so you can retake the quiz. Reason: ${reason}`
      : `Your progress on ${moduleTitle} has been reset so you can retake the quiz.`,
    href: `/manager/modules/${moduleSlug}`,
  });

  revalidatePath(`/admin/modules/${moduleSlug}`);
  revalidatePath(`/teacher/modules/${moduleSlug}`);
  revalidatePath(`/admin/managers/${managerId}`);
  return { ok: true };
}

// Active users who can be added to a module's seminar roster. Goes through the
// service-role client behind an admin/owner guard, so the "Add employee" picker
// still lists the full directory even after teacher profile reads were scoped to
// their own modules (migration 0048). Any role can be assigned (per 0043).
export async function getAddableEmployees(
  moduleSlug: string,
): Promise<{ id: string; name: string; email: string; markets: string[] }[]> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return [];
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("id, name, email, cohort, markets, status").order("name");
  return ((data ?? []) as {
    id: string; name: string; email: string | null;
    cohort: string | null; markets: string[] | null; status: string | null;
  }[])
    .filter((p) => p.status !== "inactive" && p.status !== "pending")
    .map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email ?? "",
      markets: p.markets && p.markets.length > 0 ? p.markets : p.cohort ? [p.cohort] : [],
    }));
}

// ─── updateModuleMetadata (admin) ──────────────────────────────────────
// Edit a module's details after creation. Content/lessons are edited
// separately via updateModuleLessons.

export interface UpdateModuleMetadataInput {
  number?: number;
  title?: string;
  description?: string;
  scheduledMonth?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  timezone?: string | null;
  passThreshold?: number;
  questionCount?: number;
  timeLimitMinutes?: number | null;
}

export async function updateModuleMetadata(
  slug: string,
  patch: UpdateModuleMetadataInput,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (patch.title !== undefined && !patch.title.trim()) {
    return { ok: false, error: "Title can't be empty" };
  }
  if (patch.passThreshold !== undefined && !(patch.passThreshold > 0 && patch.passThreshold <= 1)) {
    return { ok: false, error: "Pass threshold must be between 0 and 1 (e.g. 0.85)" };
  }
  if (patch.questionCount !== undefined && patch.questionCount < 1) {
    return { ok: false, error: "Question count must be at least 1" };
  }
  if (patch.number !== undefined && patch.number < 1) {
    return { ok: false, error: "Module number must be at least 1" };
  }

  if (DEMO_MODE) return { ok: true };

  const update: Record<string, unknown> = {};
  if (patch.number !== undefined) update.number = patch.number;
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.scheduledMonth !== undefined) update.scheduled_month = patch.scheduledMonth;
  if (patch.scheduledDate !== undefined) update.scheduled_date = patch.scheduledDate;
  if (patch.scheduledTime !== undefined) update.scheduled_time = patch.scheduledTime;
  if (patch.timezone !== undefined) update.timezone = patch.timezone;
  if (patch.passThreshold !== undefined) update.pass_threshold = patch.passThreshold;
  if (patch.questionCount !== undefined) update.question_count = patch.questionCount;
  if (patch.timeLimitMinutes !== undefined) update.time_limit_minutes = patch.timeLimitMinutes;
  if (Object.keys(update).length === 0) return { ok: true };

  const admin = createAdminClient();
  const { error } = await admin.from("modules").update(update).eq("slug", slug);
  if (error) {
    // The unique constraint on modules.number gives a clearer message.
    if (error.message.toLowerCase().includes("unique") || error.code === "23505") {
      return { ok: false, error: "That module number is already in use" };
    }
    return { ok: false, error: error.message };
  }

  await admin.from("activity").insert({
    kind: "module_published",
    actor_id: guard.userId,
    target_id: null,
    message: `${guard.userName} updated module ${patch.title?.trim() ?? slug}`,
  });

  revalidatePath("/admin/modules");
  revalidatePath(`/admin/modules/${slug}`);
  revalidatePath(`/teacher/modules/${slug}`);
  revalidatePath("/teacher/modules");
  return { ok: true };
}

// ─── updateModuleOwners (admin) ────────────────────────────────────────
// Replace a module's owning Department Lead(s). At least one is required;
// `primaryId` (if among the list) becomes the primary owner.

export async function updateModuleOwners(
  slug: string,
  teacherIds: string[],
  primaryId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const ids = Array.from(new Set(teacherIds.filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "Assign at least one Department Lead" };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();

  // Validate every id is actually a teacher.
  const { data: profs } = await admin.from("profiles").select("id, role").in("id", ids);
  const teacherSet = new Set(
    ((profs ?? []) as { id: string; role: string }[]).filter((p) => p.role === "teacher").map((p) => p.id),
  );
  if (teacherSet.size !== ids.length) {
    return { ok: false, error: "Every owner must be a Department Lead" };
  }

  const primary = primaryId && ids.includes(primaryId) ? primaryId : ids[0];

  await admin.from("module_owners").delete().eq("module_slug", slug);
  const rows = ids.map((tid) => ({ module_slug: slug, teacher_id: tid, is_primary: tid === primary }));
  const { error } = await admin.from("module_owners").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/modules");
  revalidatePath(`/admin/modules/${slug}`);
  revalidatePath("/admin/teachers");
  revalidatePath("/teacher/modules");
  return { ok: true };
}

// ─── deleteModule (admin) ──────────────────────────────────────────────
// Hard delete. Only allowed when the module has NO attempts (otherwise it
// would destroy results history — unpublish/draft instead). Requires the
// caller to echo the module title to guard against accidents. Cascades to
// lessons, questions, deliveries, invitees, attendance, etc. via FK ON DELETE
// CASCADE.

export async function deleteModule(
  slug: string,
  confirmTitle: string,
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdmin();
  if (!guard.ok) return { ok: false, error: guard.error };

  const admin = createAdminClient();

  const { data: mod } = await admin.from("modules").select("title").eq("slug", slug).maybeSingle();
  const title = (mod as { title?: string } | null)?.title;
  if (!title) return { ok: false, error: "Module not found" };
  if (confirmTitle.trim() !== title.trim()) {
    return { ok: false, error: "Type the module's exact title to confirm deletion" };
  }

  const { count: attemptCount } = await admin
    .from("attempts")
    .select("*", { count: "exact", head: true })
    .eq("module_slug", slug);
  if ((attemptCount ?? 0) > 0) {
    return { ok: false, error: "This module has quiz attempts — unpublish it (set to draft) instead of deleting; history is kept." };
  }

  if (DEMO_MODE) return { ok: true };

  const { error } = await admin.from("modules").delete().eq("slug", slug);
  if (error) return { ok: false, error: error.message };

  await admin.from("activity").insert({
    kind: "module_published",
    actor_id: guard.userId,
    target_id: null,
    message: `${guard.userName} permanently deleted module ${title}`,
  });

  revalidatePath("/admin/modules");
  revalidatePath("/teacher/modules");
  return { ok: true };
}
