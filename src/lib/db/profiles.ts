// Profiles — DB queries that mirror src/data/users.ts shapes so callers
// can swap import paths without changing types downstream.

import { dbClient } from "@/lib/supabase/db-client";
import type { Admin, Manager, Teacher, Role, Cohort, ManagerStatus } from "@/types";

interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  cohort: Cohort | null;
  avatar_color: string;
  avatar_url: string | null;
  status: ManagerStatus | null;
  bio: string | null;
  title: string | null;
  joined_at: string;
  last_active_at: string;
  phone: string | null;
}

function toManager(r: ProfileRow): Manager {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    avatarColor: r.avatar_color,
    role: "manager",
    cohort: (r.cohort ?? "Atlanta") as Cohort,
    joinedAt: r.joined_at,
    lastActiveAt: r.last_active_at,
    phone: r.phone,
    status: (r.status ?? "active") as ManagerStatus,
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
    role: "admin",
    title: r.title ?? "",
    joinedAt: r.joined_at,
    lastActiveAt: r.last_active_at,
    phone: r.phone,
  };
}

export async function listManagers(): Promise<Manager[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select("*").eq("role", "manager").order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toManager(r as ProfileRow));
}

export async function listTeachers(): Promise<Teacher[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select("*").eq("role", "teacher").order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toTeacher(r as ProfileRow));
}

export async function listAdmins(): Promise<Admin[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select("*").eq("role", "admin").order("joined_at", { ascending: false });
  return (data ?? []).map((r) => toAdmin(r as ProfileRow));
}

export async function getProfile(id: string): Promise<Manager | Teacher | Admin | null> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select("*").eq("id", id).single();
  if (!data) return null;
  const r = data as ProfileRow;
  if (r.role === "manager") return toManager(r);
  if (r.role === "teacher") return toTeacher(r);
  return toAdmin(r);
}

export async function listAllProfiles(): Promise<(Manager | Teacher | Admin)[]> {
  const sb = await dbClient();
  const { data } = await sb.from("profiles").select("*");
  return (data ?? []).map((row) => {
    const r = row as ProfileRow;
    if (r.role === "manager") return toManager(r);
    if (r.role === "teacher") return toTeacher(r);
    return toAdmin(r);
  });
}
