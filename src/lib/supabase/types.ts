// Database types — minimal hand-written version.
// REGENERATE with:
//   npx supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/types.ts
// once the Supabase project is provisioned and the initial migration is applied.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "manager" | "teacher" | "admin";
export type Cohort = "Atlanta" | "Nashville" | "Charlotte";
export type ManagerStatus = "active" | "at-risk" | "inactive" | "completed";
export type ModuleStatus = "draft" | "published" | "archived";
export type AttemptStatus = "passed" | "failed" | "in-progress" | "scheduled";
export type QuestionStatus = "pending" | "approved" | "rejected" | "edited";
export type QuestionPool = "first-attempt" | "retake";
export type ContentType = "video" | "document" | "slides" | "link";
export type NotificationKind = "invitation" | "reminder" | "result" | "alert";
export type InviteeStatus = "invited" | "opted-out";
export type AckContentType = "sop" | "module_update" | "resource";
export type ActivityKind =
  | "quiz_passed"
  | "quiz_failed"
  | "retake_scheduled"
  | "module_published"
  | "module_assigned"
  | "user_added"
  | "user_deactivated"
  | "reminder_sent"
  | "report_exported"
  | "questions_approved"
  | "manager_flagged"
  | "delivery_rescheduled"
  | "manager_checked_in"
  | "session_started"
  | "session_ended";

// Until full types are generated from the live schema, use a permissive Database type
// so server/client/middleware compile. Swap this for the generated file later via:
//   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
//
// `any` here means table queries return `any` for now; we lose some type-safety
// but keep the codebase compiling. Re-generate after Phase 4 starts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
