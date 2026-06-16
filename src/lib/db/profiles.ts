// Profiles — DB queries that mirror src/data/users.ts shapes so callers
// can swap import paths without changing types downstream.

import { dbClient } from "@/lib/supabase/db-client";
import type { Admin, Manager, Teacher, Role, Cohort, ManagerStatus } from "@/types";

// Explicit column list (never `select("*")`) so we never read `invite_token`
// over the RLS client — that column is revoked from authenticated reads (it's a
// secret only the service-role invite flow needs). See migration 0047.
const PROFILE_COLS =
  "id, name, email, role, cohort, markets, avatar_color, avatar_url, status, bio, title, joined_at, last_active_at, phone, invite_sent_at, invite_expires_at";

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  cohort: Cohort | null;
  markets: string[] | null;
  avatar_color: string;
  avatar_url: string | null;
  status: ManagerStatus | null;
  bio: string | null;
  title: string | null;
  joined_at: string;
  last_active_at: string;
  phone: string | null;
  invite_sent_at: string | null;
  invite_expires_at: string | null;
}

function toManager(r: ProfileRow): Manager {
  // A profile's markets come from the new `markets` array; fall back to the
  // legacy single `cohort` column so rows that haven't been migrated yet still
  // work.
  const markets =
    r.markets && r.markets.length > 0
      ? r.markets
      : r.cohort
        ? [r.cohort]
        : [];
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
    avatarUrl: r.avatar_url,
    role: "manager",
    cohort: (markets[0] ?? "Atlanta") as Cohort,
    markets,
    joinedAt: r.joined_at,
    lastActiveAt: r.last_active_at,
    phone: r.phone,
    status: (r.status ?? "active") as ManagerStatus,
    inviteSentAt: r.invite_sent_at ?? null,
    inviteExpiresAt: r.invite_expires_at ?? null,
    modulesCompleted: 0,   // derived elsewhere from attempts
    averageScore: 0,        // derived elsewhere from attempts
    failedAttempts: 0,      // derived elsewhere from attempts
    flaggedReasons: [],     // derived elsewhere
  };
}

function toTeacher(r: ProfileRow): Teacher {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
    avatarUrl: r.avatar_url,
    role: "teacher",
    bio: r.bio ?? "",
    joinedAt: r.joined_at,
    lastActiveAt: r.last_active_at,
    phone: r.phone,
    ownedModuleSlugs: [], // derived from module_owners; filled by joined queries
  };
}

function toAdmin(r: ProfileRow): Admin {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
    avatarUrl: r.avatar_url,
    role: "admin",
    title: r.title ?? "",
    joinedAt: r.joined_at,
    lastActiveAt: r.last_active_at,
    phone: r.phone,
  };
}

export async function listManagers(): Promise<Manager[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select(PROFILE_COLS).eq("role", "manager").order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toManager(r as ProfileRow));
}

// All users who can be assigned to a module's seminar/quiz — managers, plus
// Department Leads (teachers) and Admins (per Nancy's Jun-16 request that any
// user be able to be assigned and take a quiz). Returned in the Manager shape so
// the existing roster name-lookup + "Add employee" picker work unchanged; only
// id/name/avatar/markets/status are read by those callers. Teachers/admins have
// no manager_status, so toManager defaults them to "active" (they stay addable).
export async function listAssignableUsers(): Promise<Manager[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select(PROFILE_COLS).order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toManager(r as ProfileRow));
}

export async function listTeachers(): Promise<Teacher[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select(PROFILE_COLS).eq("role", "teacher").order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toTeacher(r as ProfileRow));
}

export async function listAdmins(): Promise<Admin[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select(PROFILE_COLS).eq("role", "admin").order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toAdmin(r as ProfileRow));
}

export async function getProfile(id: string): Promise<Manager | Teacher | Admin | null> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select(PROFILE_COLS).eq("id", id).single();
  if (!data) return null;
  const r = data as ProfileRow;
  if (r.role === "manager") return toManager(r);
  if (r.role === "teacher") return toTeacher(r);
  return toAdmin(r);
}

export async function listAllProfiles(): Promise<(Manager | Teacher | Admin)[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select(PROFILE_COLS);
  return (data ?? []).map((row) => {
    const r = row as ProfileRow;
    if (r.role === "manager") return toManager(r);
    if (r.role === "teacher") return toTeacher(r);
    return toAdmin(r);
  });
}
