import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { initials, fmtDate, fmtRelative, fmtPct, fmtDuration } from "@/lib/format";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ListChecks,
  Bell,
  Settings,
  PencilLine,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Activity,
} from "lucide-react";
import type { Role, Attempt, ModuleDef, ActivityEvent, NotificationItem } from "@/types";

interface MyProfileViewProps {
  me: {
    id: string;
    name: string;
    email: string;
    role: Role;
    cohort: string | null;
    avatarColor: string;
    avatarUrl: string | null;
    status: "active" | "at-risk" | "inactive" | "completed" | null;
    joinedAt: string | null;
    lastActiveAt: string | null;
  };
  phone: string | null;
  bio: string | null;
  title: string | null;
  role: Role;
  modules: ModuleDef[];
  ownedModules: ModuleDef[];
  attempts: Attempt[];
  activity: ActivityEvent[];
  recentNotifications: NotificationItem[];
  stats: { modulesCompleted: number; averageScore: number; failedAttempts: number };
}

const ROLE_LABEL: Record<Role, string> = {
  manager: "Employee",
  teacher: "Department Lead",
  admin: "Administrator",
};

const ROLE_TONE: Record<Role, string> = {
  manager: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  teacher: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  admin: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function MyProfileView({
  me,
  phone,
  bio,
  title,
  role,
  modules,
  ownedModules,
  attempts,
  activity,
  recentNotifications,
  stats,
}: MyProfileViewProps) {
  return (
    <>
      <PageHeader
        eyebrow="My profile"
        title={me.name}
        description={`${ROLE_LABEL[role]}${me.cohort ? ` · ${me.cohort} cohort` : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/notifications">
                <Bell className="size-4 mr-1.5" /> Notifications
              </Link>
            </Button>
            <Button asChild>
              <Link href="/settings/profile">
                <PencilLine className="size-4 mr-1.5" /> Edit profile
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* ─── Sidebar ─────────────────────────────────────── */}
        <aside className="space-y-4">
          {/* Avatar / identity card */}
          <Card>
            <CardContent className="p-5 text-center">
              <Avatar className="size-24 mx-auto border-2 border-primary/20">
                <AvatarImage src={me.avatarUrl ?? undefined} alt={me.name} className="object-cover" />
                <AvatarFallback
                  style={{ background: me.avatarColor, color: "white" }}
                  className="text-3xl font-bold"
                >
                  {initials(me.name)}
                </AvatarFallback>
              </Avatar>
              <div className="font-semibold text-lg mt-3">{me.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{me.email}</div>
              <div className="mt-3 flex justify-center gap-1.5 flex-wrap">
                <Badge variant="secondary" className={`${ROLE_TONE[role]} font-medium`}>
                  {ROLE_LABEL[role]}
                </Badge>
                {role === "manager" && me.status && <StatusBadge variant={me.status} />}
              </div>
            </CardContent>
          </Card>

          {/* Contact card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <Field icon={Mail} label="Email" value={me.email} />
              <Field icon={Phone} label="Phone" value={phone ?? "—"} />
              {me.cohort && <Field icon={MapPin} label="Cohort" value={me.cohort} />}
              {title && <Field icon={ShieldCheck} label="Title" value={title} />}
            </CardContent>
          </Card>

          {/* Role-specific quick stats */}
          {role === "manager" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <Field icon={Trophy} label="Modules passed" value={`${stats.modulesCompleted} of ${modules.length}`} />
                <Field
                  icon={CheckCircle2}
                  label="Average score"
                  value={stats.averageScore ? fmtPct(stats.averageScore) : "—"}
                />
                {stats.failedAttempts > 0 && (
                  <Field
                    icon={AlertTriangle}
                    label="Failed attempts"
                    value={String(stats.failedAttempts)}
                    highlight="warning"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {role === "teacher" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ownership
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <Field icon={BookOpen} label="Modules owned" value={String(ownedModules.length)} />
                <Field
                  icon={ListChecks}
                  label="Questions approved"
                  value={`${ownedModules.reduce((s, m) => s + m.questionsApproved, 0)} / ${ownedModules.reduce((s, m) => s + m.questionsTotal, 0)}`}
                />
              </CardContent>
            </Card>
          )}

          {/* Quick links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
                Quick links
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 -mt-1">
              <QuickLink href="/settings/profile" icon={Settings} label="Settings" />
              <QuickLink href="/notifications" icon={Bell} label="Notifications" />
              {role === "manager" && (
                <QuickLink href="/manager/progress" icon={Activity} label="My progress" />
              )}
              {role === "teacher" && (
                <QuickLink href="/teacher/dashboard" icon={Activity} label="Teacher dashboard" />
              )}
              {role === "admin" && (
                <QuickLink href="/admin/dashboard" icon={Activity} label="Admin dashboard" />
              )}
            </CardContent>
          </Card>
        </aside>

        {/* ─── Main column ─────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          {/* About */}
          {(bio || title) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-foreground/90">
                {title && (
                  <div className="mb-2 font-medium text-foreground">{title}</div>
                )}
                {bio ?? "No bio yet — head to settings to add one."}
              </CardContent>
            </Card>
          )}

          {/* ─── Manager: module timeline + attempts ─────── */}
          {role === "manager" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="size-4" /> Module progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {modules.map((mod) => {
                      const att = attempts.filter((a) => a.moduleSlug === mod.slug && (a.status === "passed" || a.status === "failed"));
                      const passed = att.some((a) => a.status === "passed");
                      const failed = att.some((a) => a.status === "failed") && !passed;
                      return (
                        <li key={mod.slug} className="px-5 py-4 flex items-center gap-4">
                          <div
                            className={`size-10 rounded-md flex items-center justify-center shrink-0 ${
                              passed
                                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : failed
                                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {passed ? (
                              <CheckCircle2 className="size-5" />
                            ) : failed ? (
                              <AlertTriangle className="size-5" />
                            ) : (
                              <Calendar className="size-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">M{mod.number}</span>
                              <span className="font-medium">{mod.title}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {att.length === 0
                                ? mod.scheduledDate
                                  ? `Scheduled ${fmtDate(mod.scheduledDate)}`
                                  : "Not scheduled yet"
                                : `${att.length} attempt${att.length === 1 ? "" : "s"}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {att.slice(0, 2).map((a) => (
                              <Badge key={a.id} variant="outline" className="font-mono text-xs">
                                {a.pool === "retake" ? "RT" : "FA"}: {fmtPct(a.scorePct)}
                              </Badge>
                            ))}
                            {passed && <StatusBadge variant="passed" />}
                            {failed && <StatusBadge variant="failed" />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              {attempts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Attempt history</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="border-y bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="text-left px-5 py-2.5 font-medium">Module</th>
                          <th className="text-left px-5 py-2.5 font-medium">Date</th>
                          <th className="text-left px-5 py-2.5 font-medium">Pool</th>
                          <th className="text-left px-5 py-2.5 font-medium">Score</th>
                          <th className="text-left px-5 py-2.5 font-medium">Time</th>
                          <th className="text-left px-5 py-2.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attempts.slice(0, 10).map((a) => {
                          const mod = modules.find((m) => m.slug === a.moduleSlug);
                          return (
                            <tr key={a.id} className="hover:bg-accent/40">
                              <td className="px-5 py-3 font-medium">{mod?.title ?? a.moduleSlug}</td>
                              <td className="px-5 py-3 text-muted-foreground">{fmtRelative(a.startedAt)}</td>
                              <td className="px-5 py-3"><StatusBadge variant={a.pool} /></td>
                              <td className="px-5 py-3 font-mono tabular-nums">{fmtPct(a.scorePct)}</td>
                              <td className="px-5 py-3 text-muted-foreground tabular-nums">{fmtDuration(a.durationSec)}</td>
                              <td className="px-5 py-3">
                                <StatusBadge variant={a.status as "passed" | "failed"} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* ─── Teacher: owned modules ──────────────────── */}
          {role === "teacher" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="size-4" /> Modules I own
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ownedModules.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No modules assigned yet.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {ownedModules.map((m) => (
                      <li key={m.slug}>
                        <Link
                          href={`/teacher/modules/${m.slug}/questions`}
                          className="flex items-center gap-3 px-5 py-4 hover:bg-accent/40 transition-colors"
                        >
                          <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center font-mono text-sm font-semibold shrink-0">
                            M{m.number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{m.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {m.questionsApproved}/{m.questionsTotal} questions approved · {m.scheduledMonth}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{
                                  width: m.questionsTotal
                                    ? `${(m.questionsApproved / m.questionsTotal) * 100}%`
                                    : "0%",
                                }}
                              />
                            </div>
                            <ArrowRight className="size-4 text-muted-foreground" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Admin: recent admin actions ─────────────── */}
          {role === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="size-4" /> Recent admin actions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activity.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No actions logged yet.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {activity.slice(0, 10).map((a) => (
                      <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                        <div className="size-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                          <Activity className="size-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm">{a.message}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{fmtRelative(a.occurredAt)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* ─── Recent activity (everyone) ──────────────── */}
          {role !== "admin" && activity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="size-4" /> Recent activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {activity.slice(0, 8).map((a) => (
                    <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                      <div className="size-7 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{a.message}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{fmtRelative(a.occurredAt)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ─── Recent notifications (everyone) ─────────── */}
          {recentNotifications.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="size-4" /> Recent notifications
                </CardTitle>
                <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                  <Link href="/notifications">
                    View all <ArrowRight className="size-3.5 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {recentNotifications.map((n) => (
                    <li key={n.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm ${n.opened ? "text-foreground/90" : "font-semibold"}`}>
                              {n.subject}
                            </span>
                            <Badge variant="outline" className="text-[10px] capitalize font-mono">
                              {n.kind}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {n.preview}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtRelative(n.sentAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ─── Account meta ────────────────────────────── */}
          <Card>
            <CardContent className="p-5 grid grid-cols-2 gap-4 text-sm">
              <Field icon={Calendar} label="Member since" value={fmtDate(me.joinedAt)} />
              <Field icon={Clock} label="Last active" value={fmtRelative(me.lastActiveAt)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: "warning";
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-8 rounded-md flex items-center justify-center shrink-0 ${
          highlight === "warning"
            ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm hover:bg-accent transition-colors"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" />
    </Link>
  );
}
