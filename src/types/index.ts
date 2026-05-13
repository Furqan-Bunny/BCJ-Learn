// Domain types for BCJ Learn

export type Role = "manager" | "teacher" | "admin";

export type Cohort = "Atlanta" | "Dallas" | "Phoenix";
export type ManagerStatus = "active" | "at-risk" | "inactive" | "completed";
export type ModuleStatus = "draft" | "published" | "archived";
export type AttemptStatus = "passed" | "failed" | "in-progress" | "scheduled";
export type QuestionStatus = "pending" | "approved" | "rejected" | "edited";
export type QuestionPool = "first-attempt" | "retake";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string; // hex, derived from name
  role: Role;
  cohort?: Cohort;
  joinedAt: string; // ISO
  lastActiveAt: string; // ISO
  phone?: string | null;
}

export interface Manager extends User {
  role: "manager";
  cohort: Cohort;
  status: ManagerStatus;
  modulesCompleted: number;
  averageScore: number;
  failedAttempts: number;
  flaggedReasons: string[];
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

export interface ModuleDef {
  slug: string;
  number: number; // 1-5
  title: string;
  description: string;
  scheduledMonth: string;
  scheduledDate: string;
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
  | "session_ended";

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
}
