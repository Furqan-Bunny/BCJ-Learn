// Branding + reminder settings — singleton-row tables introduced in migration 0004.

import { dbClient } from "@/lib/supabase/db-client";

export interface BrandingSettings {
  name: string;
  primaryColor: string;
  accentColor: string;
  emailFrom: string;
  logoPath: string | null;
  updatedAt: string;
}

export interface ReminderRules {
  autoReminders: boolean;
  overdueDays: number;
  updatedAt: string;
}

interface BrandingRow {
  id: string;
  name: string;
  primary_color: string;
  accent_color: string;
  email_from: string;
  logo_path: string | null;
  updated_at: string;
}

interface ReminderRow {
  id: string;
  auto_reminders: boolean;
  overdue_days: number;
  updated_at: string;
}

const DEFAULT_BRANDING: BrandingSettings = {
  name: "BCJ Learn",
  primaryColor: "#041D39",
  accentColor: "#12D7CD",
  emailFrom: "noreply@bcj.com",
  logoPath: null,
  updatedAt: new Date().toISOString(),
};

const DEFAULT_REMINDERS: ReminderRules = {
  autoReminders: true,
  overdueDays: 3,
  updatedAt: new Date().toISOString(),
};

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const sb = await dbClient();
  const { data } = await sb.from("branding_settings").select("*").eq("id", "global").maybeSingle();
  if (!data) return DEFAULT_BRANDING;
  const r = data as BrandingRow;
  return {
    name: r.name,
    primaryColor: r.primary_color,
    accentColor: r.accent_color,
    emailFrom: r.email_from,
    logoPath: r.logo_path,
    updatedAt: r.updated_at,
  };
}

export async function getReminderRules(): Promise<ReminderRules> {
  const sb = await dbClient();
  const { data } = await sb.from("reminder_rules").select("*").eq("id", "global").maybeSingle();
  if (!data) return DEFAULT_REMINDERS;
  const r = data as ReminderRow;
  return {
    autoReminders: r.auto_reminders,
    overdueDays: r.overdue_days,
    updatedAt: r.updated_at,
  };
}
