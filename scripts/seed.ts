/**
 * BCJ Learn — seed script
 *
 * Wipes the dev/staging Supabase project and re-populates it from the
 * existing mock data in src/data/*.ts:
 *   • 3 admins, 6 teachers, 60 managers (auth.users + profiles)
 *   • 5 modules with lessons, lesson_contents, multi-teacher ownership
 *   • ~400 questions + ~1600 options across all modules
 *   • ~200 attempts with realistic pass/fail distribution
 *   • ~75 activity log entries
 *
 * Run with:   npm run seed
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { admins, teachers, managers } from "../src/data/users";
import { modules } from "../src/data/modules";
import { questions as allQuestions } from "../src/data/questions";
import { attempts as allAttempts } from "../src/data/attempts";
import { activity as allActivity } from "../src/data/activity";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = "BcjLearnDemo2026!";

// Map of mock id (e.g. "m-1", "t-nancy", "a-nancy") → real auth.users uuid.
const idMap = new Map<string, string>();
// Cache emails we've already created, so a second mock id sharing an email
// (e.g. Nancy who is both a-nancy admin and t-nancy teacher) maps to the same auth user.
const emailToUuid = new Map<string, string>();

async function getOrCreateAuthUser(
  email: string,
  name: string,
  role: "admin" | "teacher" | "manager",
): Promise<string | null> {
  const cached = emailToUuid.get(email);
  if (cached) return cached;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (data?.user) {
    emailToUuid.set(email, data.user.id);
    return data.user.id;
  }

  // Race / leftover: email already in auth.users — find it.
  if (error?.message?.toLowerCase().includes("already")) {
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => u.email === email);
    if (existing) {
      emailToUuid.set(email, existing.id);
      return existing.id;
    }
  }

  console.error(`   ✗ ${role} ${email}:`, error?.message);
  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function logStep(label: string) {
  console.log(`\n${label}`);
}

async function wipeAll() {
  logStep("🧹  Wiping existing data…");

  // Tables — order respects FK dependencies (children first).
  const tables = [
    "acknowledgements",
    "activity",
    "notifications",
    "attempt_answers",
    "attempts",
    "attendance",
    "module_invitees",
    "module_deliveries",
    "question_options",
    "questions",
    "lesson_contents",
    "lessons",
    "module_owners",
    "resources",
    "modules",
  ];

  for (const t of tables) {
    // Delete all rows. We can't TRUNCATE via the JS client; use a wildcard delete.
    const { error } = await sb.from(t).delete().not("created_at", "is", null);
    if (error && !error.message.includes("does not exist")) {
      console.error(`   ✗ delete from ${t}:`, error.message);
    }
  }

  // Delete every auth user (cascades to profiles via FK).
  const { data: existing } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing?.users?.length) {
    for (const u of existing.users) {
      const { error } = await sb.auth.admin.deleteUser(u.id);
      if (error) console.error(`   ✗ delete user ${u.email}:`, error.message);
    }
    console.log(`   • removed ${existing.users.length} existing auth users`);
  }

  console.log("   ✓ wipe complete");
}

async function createUsers() {
  logStep("👥  Creating users (admins, teachers, managers)…");

  // Admins first — Nancy/Isabel who appear in both admins and teachers tables will end up
  // with role='admin' in profiles, which gives them more access than 'teacher' would.
  let adminCount = 0;
  for (const a of admins) {
    const id = await getOrCreateAuthUser(a.email, a.name, "admin");
    if (id) {
      idMap.set(a.id, id);
      adminCount++;
    }
  }
  console.log(`   ✓ ${adminCount} admins`);

  let teacherCount = 0;
  for (const t of teachers) {
    const id = await getOrCreateAuthUser(t.email, t.name, "teacher");
    if (id) {
      idMap.set(t.id, id);
      teacherCount++;
    }
  }
  console.log(`   ✓ ${teacherCount} teachers`);

  let managerCount = 0;
  for (const m of managers) {
    const id = await getOrCreateAuthUser(m.email, m.name, "manager");
    if (id) {
      idMap.set(m.id, id);
      managerCount++;
    }
  }
  console.log(`   ✓ ${managerCount} managers`);
}

async function updateProfileFields() {
  logStep("📝  Filling in role-specific profile fields…");

  // Admins
  for (const a of admins) {
    const id = idMap.get(a.id);
    if (!id) continue;
    await sb.from("profiles").update({
      avatar_color: a.avatarColor,
      title: a.title,
      joined_at: a.joinedAt,
      last_active_at: a.lastActiveAt,
    }).eq("id", id);
  }

  // Teachers
  for (const t of teachers) {
    const id = idMap.get(t.id);
    if (!id) continue;
    await sb.from("profiles").update({
      avatar_color: t.avatarColor,
      bio: t.bio,
      joined_at: t.joinedAt,
      last_active_at: t.lastActiveAt,
    }).eq("id", id);
  }

  // Managers
  for (const m of managers) {
    const id = idMap.get(m.id);
    if (!id) continue;
    await sb.from("profiles").update({
      avatar_color: m.avatarColor,
      cohort: m.cohort,
      status: m.status,
      joined_at: m.joinedAt,
      last_active_at: m.lastActiveAt,
    }).eq("id", id);
  }

  console.log("   ✓ profile fields updated");
}

async function insertModules() {
  logStep("📚  Inserting modules + lessons + contents…");

  const moduleRows = modules.map((m) => ({
    slug: m.slug,
    number: m.number,
    title: m.title,
    description: m.description,
    scheduled_month: m.scheduledMonth,
    scheduled_date: m.scheduledDate,
    status: m.status,
    pass_threshold: m.passThreshold,
    question_count: m.questionCount,
    time_limit_minutes: m.timeLimitMinutes,
    questions_approved: m.questionsApproved,
    questions_total: m.questionsTotal,
    flashcards: m.flashcards ?? [],
  }));

  const { error: modErr } = await sb.from("modules").insert(moduleRows);
  if (modErr) console.error("   ✗ modules:", modErr.message);
  else console.log(`   ✓ ${moduleRows.length} modules`);

  // Module owners
  const ownerRows: { module_slug: string; teacher_id: string; is_primary: boolean }[] = [];
  for (const m of modules) {
    for (let i = 0; i < m.ownerTeacherIds.length; i++) {
      const realId = idMap.get(m.ownerTeacherIds[i]);
      if (!realId) continue;
      ownerRows.push({
        module_slug: m.slug,
        teacher_id: realId,
        is_primary: i === 0,
      });
    }
  }
  const { error: ownErr } = await sb.from("module_owners").insert(ownerRows);
  if (ownErr) console.error("   ✗ module_owners:", ownErr.message);
  else console.log(`   ✓ ${ownerRows.length} module owners`);

  // Lessons + lesson_contents (sequential per module to get lesson ids back)
  let lessonCount = 0;
  let contentCount = 0;
  for (const m of modules) {
    for (const lesson of m.lessons) {
      const { data: lessonRow, error: lessonErr } = await sb
        .from("lessons")
        .insert({
          module_slug: m.slug,
          order: lesson.order,
          title: lesson.title,
          description: lesson.description,
          duration_minutes: lesson.durationMinutes,
        })
        .select("id")
        .single();

      if (lessonErr || !lessonRow) {
        console.error(`   ✗ lesson ${m.slug}/${lesson.order}:`, lessonErr?.message);
        continue;
      }
      lessonCount++;

      const contentRows = lesson.contents.map((c, i) => ({
        lesson_id: lessonRow.id as string,
        type: c.type,
        title: c.title,
        duration_minutes: c.durationMinutes ?? null,
        video_url: c.videoUrl ?? null,
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

      if (contentRows.length > 0) {
        const { error: cErr } = await sb.from("lesson_contents").insert(contentRows);
        if (cErr) console.error(`   ✗ lesson_contents ${m.slug}/${lesson.order}:`, cErr.message);
        else contentCount += contentRows.length;
      }
    }
  }
  console.log(`   ✓ ${lessonCount} lessons, ${contentCount} content items`);
}

// Map of mock question id (e.g. "q-operations-leadership-1") → real questions.id (uuid)
const qIdMap = new Map<string, string>();

async function insertQuestions() {
  logStep("❓  Inserting questions + options…");

  // Insert in chunks (Supabase rejects very large arrays).
  const qChunks = chunk(allQuestions, 100);
  let inserted = 0;

  for (const c of qChunks) {
    const rows = c.map((q) => ({
      module_slug: q.moduleSlug,
      pool: q.pool,
      status: q.status,
      text: q.text,
      explanation: q.explanation ?? null,
      generated_by_ai: q.generatedByAI,
      approved_at: q.approvedAt ?? null,
      approved_by: q.approvedBy ? idMap.get(q.approvedBy) ?? null : null,
      hits: q.hits,
      miss_rate: q.missRate,
    }));

    const { data, error } = await sb.from("questions").insert(rows).select("id");
    if (error) {
      console.error("   ✗ questions chunk:", error.message);
      continue;
    }
    if (data) {
      for (let i = 0; i < data.length; i++) {
        qIdMap.set(c[i].id, data[i].id as string);
      }
      inserted += data.length;
    }
  }
  console.log(`   ✓ ${inserted} questions`);

  // Options — flatten all and bulk-insert in chunks.
  const optRows: { question_id: string; text: string; correct: boolean; order: number }[] = [];
  for (const q of allQuestions) {
    const realQid = qIdMap.get(q.id);
    if (!realQid) continue;
    for (let i = 0; i < q.options.length; i++) {
      const o = q.options[i];
      optRows.push({
        question_id: realQid,
        text: o.text,
        correct: o.correct,
        order: i,
      });
    }
  }

  const optChunks = chunk(optRows, 200);
  let optInserted = 0;
  for (const c of optChunks) {
    const { error } = await sb.from("question_options").insert(c);
    if (error) console.error("   ✗ options chunk:", error.message);
    else optInserted += c.length;
  }
  console.log(`   ✓ ${optInserted} options`);
}

async function insertAttempts() {
  logStep("📝  Inserting attempts…");

  const rows = allAttempts
    .map((a) => {
      const mgrId = idMap.get(a.managerId);
      if (!mgrId) return null;
      return {
        manager_id: mgrId,
        module_slug: a.moduleSlug,
        pool: a.pool,
        status: a.status,
        started_at: a.startedAt,
        submitted_at: a.submittedAt ?? null,
        score_pct: a.scorePct,
        correct_count: a.correctCount,
        total_count: a.totalCount,
        duration_sec: a.durationSec ?? null,
      };
    })
    .filter(Boolean);

  const attChunks = chunk(rows as object[], 100);
  let inserted = 0;
  for (const c of attChunks) {
    const { error } = await sb.from("attempts").insert(c as object[]);
    if (error) console.error("   ✗ attempts chunk:", error.message);
    else inserted += c.length;
  }
  console.log(`   ✓ ${inserted} attempts`);
}

async function insertActivity() {
  logStep("📋  Inserting activity log…");

  const rows = allActivity.map((e) => ({
    kind: e.kind,
    actor_id: idMap.get(e.actorId) ?? null,
    target_id: e.targetId ? idMap.get(e.targetId) ?? null : null,
    message: e.message,
    occurred_at: e.occurredAt,
  }));

  const actChunks = chunk(rows, 100);
  let inserted = 0;
  for (const c of actChunks) {
    const { error } = await sb.from("activity").insert(c);
    if (error) console.error("   ✗ activity chunk:", error.message);
    else inserted += c.length;
  }
  console.log(`   ✓ ${inserted} activity entries`);
}

async function main() {
  console.log("🚀  BCJ Learn — seeding Supabase");
  console.log(`    Project: ${SUPABASE_URL}`);
  console.log(`    Password for all seed users: ${SEED_PASSWORD}\n`);

  const t0 = Date.now();

  await wipeAll();
  await createUsers();
  await updateProfileFields();
  await insertModules();
  await insertQuestions();
  await insertAttempts();
  await insertActivity();

  const seconds = Math.round((Date.now() - t0) / 1000);
  console.log(`\n✅  Done in ${seconds}s`);
  console.log(`    ${idMap.size} users, ${modules.length} modules, ${allQuestions.length} questions, ${allAttempts.length} attempts, ${allActivity.length} activity entries`);
  console.log(`\n    Sign in with any seeded email (e.g. nancy@bcj.com) and password ${SEED_PASSWORD}`);
}

main().catch((err) => {
  console.error("\n💥  Seed failed:", err);
  process.exit(1);
});
