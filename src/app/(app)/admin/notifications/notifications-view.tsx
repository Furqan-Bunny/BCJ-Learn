"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Mail, Bell, Send, Sparkles, Loader2, Info, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { fmtRelative } from "@/lib/format";
import { toast } from "sonner";
import { updateEmailTemplate } from "@/lib/server/email-template-actions";
import { sendTestEmail } from "@/lib/server/reminder-actions";
import { EmailPreviewDialog } from "@/components/admin/email-preview-dialog";
import { updateReminderRules } from "@/lib/server/settings-actions";
import type { NotificationItem } from "@/types";
import type { ReminderRules } from "@/lib/db/settings";
import type { TemplateKey } from "@/lib/emails/send";
import type { EmailTemplateRow } from "@/lib/db/email-templates";

// Friendly tab names for known template keys; unknown keys fall back to a
// title-cased version of the key.
const TEMPLATE_LABELS: Record<string, string> = {
  invite: "Invitation",
  password_reset: "Password reset",
  welcome: "Welcome",
  quiz_passed: "Quiz passed",
  quiz_failed: "Quiz failed (retake)",
  overdue_reminder: "Overdue reminder",
  at_risk_alert: "At-risk alert",
  login_code: "Sign-in code",
  seminar_scheduled: "Seminar scheduled",
  seminar_rescheduled: "Seminar rescheduled",
};

function labelFor(key: string): string {
  return TEMPLATE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface NotificationsViewProps {
  recent: NotificationItem[];
  initialRules: ReminderRules;
  profilesById: Record<string, { id: string; name: string; avatarColor: string }>;
  templates: EmailTemplateRow[];
}

export function NotificationsView({ recent, initialRules, profilesById, templates }: NotificationsViewProps) {
  const router = useRouter();
  const [activeTpl, setActiveTpl] = React.useState<string>(templates[0]?.key ?? "");
  const [autoReminders, setAutoReminders] = React.useState(initialRules.autoReminders);
  const [overdueDays, setOverdueDays] = React.useState(initialRules.overdueDays);
  const [saving, setSaving] = React.useState(false);
  const [savingRules, setSavingRules] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const tpl = templates.find((t) => t.key === activeTpl) ?? templates[0];
  const [subject, setSubject] = React.useState(tpl?.subject ?? "");
  const [body, setBody] = React.useState(tpl?.bodyMarkdown ?? "");
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  // Insert a {{variable}} into the body at the cursor — so non-technical admins
  // never have to type the braces themselves.
  function insertVariable(v: string) {
    const token = `{{${v}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  React.useEffect(() => {
    setSubject(tpl?.subject ?? "");
    setBody(tpl?.bodyMarkdown ?? "");
  }, [tpl]);

  async function handleSaveTemplate(label: string) {
    setSaving(true);
    const result = await updateEmailTemplate({
      key: activeTpl,
      subject,
      bodyMarkdown: body,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save");
      return;
    }
    toast.success(`${label} template saved`);
    router.refresh();
  }

  async function handleSendTest() {
    setTesting(true);
    const result = await sendTestEmail(activeTpl as TemplateKey);
    setTesting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send test");
      return;
    }
    toast.success(`Test email sent to ${result.to}`);
  }

  async function handleSaveRules() {
    setSavingRules(true);
    const result = await updateReminderRules({ autoReminders, overdueDays });
    setSavingRules(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save");
      return;
    }
    toast.success("Reminder rules saved");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Communications"
        title="Notifications & email templates"
        description="Edit what BCJ Learn sends, when, and to whom. Variables in {{double curlies}} are filled at send time."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="size-4" /> Email templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 flex gap-2.5">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">How dynamic text works</p>
                  <p>
                    Anything inside double braces — like{" "}
                    <code className="font-mono bg-muted px-1 rounded">{"{{name}}"}</code> — is automatically
                    replaced with each person&rsquo;s real info when the email is sent. Just write your message
                    normally and <span className="font-medium text-foreground">click a variable below</span> to
                    drop it in — you never have to type the braces yourself.
                  </p>
                  <p className="italic">
                    {'Example: "Hi {{name}}, your {{module_title}} seminar is on {{seminar_date}}." → "Hi Alex, your Safety Basics seminar is on Mon, Jun 15."'}
                  </p>
                </div>
              </div>
              {templates.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No email templates found. Apply the database migrations to seed them.
                </div>
              ) : (
              <div className="grid sm:grid-cols-[210px_1fr] gap-5">
                {/* Template picker — one per row, clearly spaced */}
                <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible sm:border-r sm:pr-3 pb-1 sm:pb-0">
                  <div className="hidden sm:block text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-1">
                    Choose an email
                  </div>
                  {templates.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTpl(t.key)}
                      className={cn(
                        "text-left text-sm rounded-md px-3 py-2 whitespace-nowrap shrink-0 transition-colors",
                        activeTpl === t.key
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {labelFor(t.key)}
                    </button>
                  ))}
                </div>

                {/* Editor for the selected template */}
                {tpl && (
                  <div className="space-y-4 min-w-0">
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Body</Label>
                      <Textarea
                        ref={bodyRef}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 pt-1 items-center">
                        <span>Click to insert:</span>
                        {tpl.variables.length === 0 ? (
                          <span className="italic">no variables for this email</span>
                        ) : (
                          tpl.variables.map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => insertVariable(v)}
                              title={`Insert {{${v}}}`}
                              className="inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] hover:bg-accent hover:border-primary/40 transition-colors"
                            >
                              <Plus className="size-2.5" />{`{{${v}}}`}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button onClick={() => handleSaveTemplate(labelFor(tpl.key))} disabled={saving}>
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                      <EmailPreviewDialog subject={subject} bodyMarkdown={body} />
                      <Button variant="outline" onClick={handleSendTest} disabled={testing}>
                        {testing ? (
                          <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Sending…</>
                        ) : (
                          <><Send className="size-3.5 mr-1.5" /> Send test to me</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--ai)]" /> Automatic reminder rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="auto" className="font-medium">Auto-remind overdue managers</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send a friendly reminder if a manager has not completed an assigned module after the threshold.
                  </p>
                </div>
                <Switch id="auto" checked={autoReminders} onCheckedChange={setAutoReminders} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="font-medium">Threshold (days overdue)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Currently set to {overdueDays} days.</p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={overdueDays}
                  onChange={(e) => setOverdueDays(Number(e.target.value))}
                  className="w-24"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveRules} disabled={savingRules}>
                  {savingRules ? "Saving…" : "Save reminder rules"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="size-4" /> Recent sends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="text-xs text-muted-foreground italic py-4 text-center">
                  No emails sent yet.
                </div>
              ) : (
                <ul className="divide-y">
                  {recent.slice(0, 10).map((n) => {
                    const p = profilesById[n.recipientId];
                    return (
                      <li key={n.id} className="py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] capitalize">{n.kind}</Badge>
                          <span className="text-xs text-muted-foreground">{fmtRelative(n.sentAt)}</span>
                        </div>
                        <div className="font-medium text-sm mt-1.5 line-clamp-1">{n.subject}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">to {p?.name ?? "—"}</div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
