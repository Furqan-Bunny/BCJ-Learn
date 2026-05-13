"use server";

// Module-level server actions: create, publish, re-deliver, schedule sessions,
// reset a manager's progress in a single module.

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { pushInAppNotification } from "@/lib/notifications/push";
import type { ContentType, Lesson, LessonContent, ModuleStatus, Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

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

  // First delivery row — invite all managers automatically.
  const { data: deliveryRow } = await admin
    .from("module_deliveries")
    .insert({
      module_slug: input.slug,
      delivery_index: 1,
      scheduled_date: input.scheduledDate,
    })
    .select("id")
    .single();
  if (deliveryRow) {
    const deliveryId = (deliveryRow as { id: string }).id;
    const { data: managers } = await admin.from("profiles").select("id").eq("role", "manager");
    if (managers && managers.length > 0) {
      const inviteeRows = (managers as { id: string }[]).map((m) => ({
        delivery_id: deliveryId,
        manager_id: m.id,
      }));
      await admin.from("module_invitees").insert(inviteeRows);
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

// ─── updateModuleLessons ───────────────────────────────────────────────
// Replaces all lessons + lesson_contents for a module. Simpler than a
// per-lesson diff; lesson_contents cascade on lesson delete.

export async function updateModuleLessons(
  moduleSlug: string,
  lessons: Lesson[],
): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(moduleSlug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const admin = createAdminClient();

  // Delete existing lessons (cascades to contents).
  await admin.from("lessons").delete().eq("module_slug", moduleSlug);

  // Re-insert in order.
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
        },
        order: i,
      }));
      const { error: cErr } = await admin.from("lesson_contents").insert(contentRows);
      if (cErr) return { ok: false, error: cErr.message };
    }
  }

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

  revalidatePath(`/admin/modules/${slug}`);
  revalidatePath(`/teacher/modules/${slug}`);
  return { ok: true };
}

// ─── scheduleRedelivery (wraps RPC) ────────────────────────────────────

export async function scheduleRedelivery(slug: string, newDate: string | null): Promise<{ ok: boolean; error?: string }> {
  const guard = await requireAdminOrModuleOwner(slug);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (DEMO_MODE) return { ok: true };

  const sb = await createClient();
  const { error } = await sb.rpc("schedule_redelivery", {
    p_module_slug: slug,
    p_new_start_date: newDate,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/modules/${slug}`);
  revalidatePath(`/teacher/modules/${slug}`);
  return { ok: true };
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
  const { error } = await admin.from("module_member_resets").insert({
    module_slug: moduleSlug,
    manager_id: managerId,
    reset_by: guard.userId,
    reason: reason ?? null,
  });
  if (error) return { ok: false, error: error.message };

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
