// Domain types for BCJ Learn

export type Role = "manager" | "teacher" | "admin";

export type Cohort = "Atlanta" | "Nashville" | "Charlotte";
export type ManagerStatus = "pending" | "active" | "at-risk" | "inactive" | "completed";
export type ModuleStatus = "draft" | "published" | "archived";
export type AttemptStatus = "passed" | "failed" | "in-progress" | "scheduled";
export type QuestionStatus = "pending" | "approved" | "rejected" | "edited";
export type QuestionPool = "first-attempt" | "retake";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string; // hex, derived from name
  avatarUrl?: string | null; // uploaded profile photo, if any
  role: Role;
  /** @deprecated Kept for back-compat — use `markets` instead. */
  cohort?: Cohort;
  /** A person can belong to one or more markets (BCJ's new term for cohort). */
  markets?: string[];
  joinedAt: string; // ISO
  lastActiveAt: string; // ISO
  phone?: string | null;
}

export interface Manager extends User {
  role: "manager";
  /** @deprecated Use `markets` (multi) instead. Still populated with the first
   *  market for legacy callers. */
  cohort: Cohort;
  markets: string[];
  status: ManagerStatus;
  modulesCompleted: number;
  averageScore: number;
  failedAttempts: number;
  flaggedReasons: string[];
  // Invite lifecycle (set when status is "pending"; null once accepted/seeded).
  inviteSentAt?: string | null;
  inviteExpiresAt?: string | null;
}

export interface Teacher extends User {
  role: "teacher";
  ownedModuleSlugs: string[];
  bio: string;
}

export interface Admin extends User {
  role: "admin";
  title: string;
}

export type ContentType = "video" | "document" | "slides" | "link";

export interface LessonContent {
  id: string;
  type: ContentType;
  title: string;
  durationMinutes?: number;
  // Video
  videoUrl?: string;
  videoThumbnail?: string;
  // Document (markdown-ish pages)
  documentPages?: string[];
  // Slides
  slides?: { title: string; bullets: string[] }[];
  // External link
  externalUrl?: string;
  // Common metadata
  fileName?: string;
  fileSize?: string;
  // Storage key in the `module-content` Supabase bucket — used to generate
  // signed URLs at read time for private file types.
  storagePath?: string;
  // When true, this item is hidden from the live presenter playlist (still
  // available to employees as optional pre-study material).
  presentationHidden?: boolean;
}

export interface Lesson {
  id: string;
  moduleSlug: string;
  order: number; // 1-based
  title: string;
  description: string;
  durationMinutes: number;
  contents: LessonContent[];
}

// Kept for back-compat / fallback only — new code should use lessons.
export interface ModuleContent {
  manualPages?: string[];
  slides?: { title: string; bullets: string[] }[];
  videos?: { title: string; durationSec: number; thumbnail: string }[];
  flashcards: { front: string; back: string }[];
}

export interface CheckinState {
  ok: boolean;
  error?: string;
  open: boolean;
  code: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  sessionStarted: boolean;
  sessionEnded: boolean;
  invited: number;
  checkedIn: { id: string; name: string; at: string }[];
}

export interface ModuleDef {
  slug: string;
  number: number; // 1-5
  title: string;
  description: string;
  scheduledMonth: string;
  scheduledDate: string;
  /** Seminar start time, "HH:MM" (24h). Empty if not set. */
  scheduledTime: string;
  /** When this module was created (ISO). */
  createdAt?: string;
  /** One or more Teachers who own this module. The first is the "primary" owner. */
  ownerTeacherIds: string[];
  status: ModuleStatus;
  passThreshold: number;
  questionCount: number;
  timeLimitMinutes: number | null;
  questionsApproved: number;
  questionsTotal: number;
  // The seminar plan: ordered lessons. Total module duration = sum of lesson durations.
  lessons: Lesson[];
  // Optional flashcards live at the module level (study aid; not part of seminar flow).
  flashcards?: { front: string; back: string }[];
}

export interface Question {
  id: string;
  moduleSlug: string;
  pool: QuestionPool;
  status: QuestionStatus;
  text: string;
  options: { id: string; text: string; correct: boolean }[];
  explanation?: string;
  generatedByAI: boolean;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string; // teacher id
  approvedByName?: string; // resolved display name of the approver
  hits: number; // how many times asked
  missRate: number; // 0-1
}

export interface Attempt {
  id: string;
  managerId: string;
  moduleSlug: string;
  pool: QuestionPool;
  status: AttemptStatus;
  startedAt: string;
  submittedAt?: string;
  scorePct: number; // 0-100
  correctCount: number;
  totalCount: number;
  durationSec?: number;
  /** The delivery (seminar run) this attempt belongs to, if any. */
  deliveryId?: string | null;
  answers: { questionId: string; selectedOptionId: string; correct: boolean }[];
}

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
  | "session_ended"
  | "user_login"
  | "resource_updated";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  actorId: string;
  targetId?: string;
  message: string;
  occurredAt: string;
}

export type NotificationKind = "invitation" | "reminder" | "result" | "alert";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  recipientId: string;
  subject: string;
  preview: string;
  sentAt: string;
  opened: boolean;
  href?: string | null;
  body?: string | null;
}
