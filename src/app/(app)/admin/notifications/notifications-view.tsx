"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Bell, Send, Sparkles, Loader2 } from "lucide-react";
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

// Keys match the email_templates rows seeded in migration 0003.
const TEMPLATES: { id: TemplateKey; label: string; subject: string; body: string }[] = [
  { id: "invite",            label: "Invitation",            subject: "Welcome to BCJ Learn", body: "# Hi {{name}},\n\nYou've been invited to join BCJ Learn — our internal training and quiz platform.\n\n[Set up your account]({{invite_link}})\n\nThis link expires in 7 days.\n\n— The BCJ team" },
  { id: "password_reset",    label: "Password reset",        subject: "Reset your BCJ Learn password", body: "# Hi {{name}},\n\nYou requested a password reset. Click the link below to set a new password:\n\n[Reset password]({{reset_link}})\n\nIf you didn't request this, ignore this email. The link expires in 1 hour." },
  { id: "welcome",           label: "Welcome",               subject: "You're all set on BCJ Learn", body: "# Welcome, {{name}}!\n\nYour account is ready. Your first training module is scheduled for {{first_module_date}}.\n\n[Open BCJ Learn]({{app_url}})" },
  { id: "quiz_passed",       label: "Quiz passed",           subject: "You passed {{module_title}} 🎉", body: "# Great work, {{name}}!\n\nYou scored **{{score}}%** on the {{module_title}} quiz — well above the 85% pass threshold.\n\nThe next module unlocks on {{next_module_date}}.\n\n[View your progress]({{progress_link}})" },
  { id: "quiz_failed",       label: "Quiz failed (retake)",  subject: "Retake scheduled for {{module_title}}", body: "# Hi {{name}},\n\nYou scored **{{score}}%** on the {{module_title}} quiz. Don't worry — a retake is automatically scheduled using an easier question set.\n\nYou can take it any time.\n\n[Take the retake]({{retake_link}})" },
  { id: "overdue_reminder",  label: "Overdue reminder",      subject: "Reminder: {{module_title}} quiz is overdue", body: "# Hi {{name}},\n\nYou haven't completed the **{{module_title}}** quiz yet. Please complete it by {{due_date}}.\n\n[Take the quiz]({{quiz_link}})" },
  { id: "at_risk_alert",     label: "At-risk alert (admin)", subject: "BCJ Learn — {{employee_name}} flagged at-risk", body: "# Hi {{admin_name}},\n\n{{employee_name}} ({{cohort}}) has been flagged as at-risk. Reason: {{reason}}.\n\n[Review their profile]({{profile_link}})" },
];

export interface NotificationsViewProps {
  recent: NotificationItem[];
  initialRules: ReminderRules;
  profilesById: Record<string, { id: string; name: string; avatarColor: string }>;
}

export function NotificationsView({ recent, initialRules, profilesById }: NotificationsViewProps) {
  const router = useRouter();
  const [activeTpl, setActiveTpl] = React.useState<TemplateKey>(TEMPLATES[0].id);
  const [autoReminders, setAutoReminders] = React.useState(initialRules.autoReminders);
  const [overdueDays, setOverdueDays] = React.useState(initialRules.overdueDays);
  const [saving, setSaving] = React.useState(false);
  const [savingRules, setSavingRules] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const tpl = TEMPLATES.find((t) => t.id === activeTpl)!;
  const [subject, setSubject] = React.useState(tpl.subject);
  const [body, setBody] = React.useState(tpl.body);

  React.useEffect(() => {
    setSubject(tpl.subject);
    setBody(tpl.body);
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
  }

  async function handleSendTest() {
    setTesting(true);
    const result = await sendTestEmail(activeTpl);
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
              <Tabs value={activeTpl} onValueChange={(v) => setActiveTpl(v as TemplateKey)}>
                <TabsList>
                  {TEMPLATES.map((t) => (
                    <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
                  ))}
                </TabsList>
                {TEMPLATES.map((t) => (
                  <TabsContent key={t.id} value={t.id} className="mt-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label>Subject</Label>
                      <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Body</Label>
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 pt-1">
                        <span>Variables:</span>
                        {["{{name}}", "{{module_title}}", "{{score}}", "{{due_date}}", "{{quiz_link}}", "{{invite_link}}", "{{reset_link}}", "{{progress_link}}", "{{retake_link}}", "{{app_url}}", "{{employee_name}}", "{{admin_name}}", "{{cohort}}", "{{reason}}", "{{profile_link}}", "{{first_module_date}}", "{{next_module_date}}"].map((v) => (
                          <Badge key={v} variant="outline" className="font-mono text-[10px]">{v}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => handleSaveTemplate(t.label)} disabled={saving}>
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
                  </TabsContent>
                ))}
              </Tabs>
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
                  <Label htmlFor="auto" className="font-medium">Auto-remind overdue employees</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Send a friendly reminder if an employee has not completed an assigned module after the threshold.
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
