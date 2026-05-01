"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Mail, Bell, Send, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { notifications } from "@/data/activity";
import { managers } from "@/data/users";
import { fmtRelative } from "@/lib/format";
import { toast } from "sonner";

const TEMPLATES = [
  { id: "invitation", label: "Invitation", subject: "Welcome to BCJ Learn", body: "Hi {{name}},\n\nYour Module {{number}} training is scheduled for {{date}}. Click the link to log in and start studying:\n\n{{login_url}}\n\nSee you there.\n— Nancy" },
  { id: "reminder",   label: "Reminder",   subject: "Module {{number}} quiz is tomorrow", body: "Hi {{name}},\n\nA quick reminder — your in-person training session is tomorrow ({{date}}). The quiz will run on-site right after the presentation.\n\nLog in here if you'd like to review beforehand:\n{{login_url}}" },
  { id: "result",     label: "Result",     subject: "Your Module {{number}} result", body: "Hi {{name}},\n\nThanks for completing the Module {{number}} quiz. {{result_message}}\n\n— BCJ Learn" },
  { id: "alert",      label: "Alert",      subject: "Heads up: {{name}} flagged at-risk", body: "{{name}} ({{cohort}}) has been flagged. Reasons: {{reasons}}.\n\nReview their profile here: {{profile_url}}" },
  { id: "redelivery", label: "Re-delivery", subject: "Module {{number}} is being delivered again on {{delivery_date}}", body: "Hi {{name}},\n\nGood news — Module {{number}} ({{module_title}}) is being delivered again on {{delivery_date}}. You're invited because you {{reason}}.\n\nSign in on training day and tap \"I'm here\" to check in:\n{{check_in_url}}\n\nSee you in the room.\n— BCJ Learn" },
  { id: "checkin",    label: "Check-in confirmation", subject: "You're checked in for Module {{number}}", body: "Hi {{name}},\n\nGot it — you're checked in for today's Module {{number}} ({{module_title}}) session.\n\nSit back, listen to your trainer. The quiz will unlock on your device the moment they end the session.\n\n— BCJ Learn" },
  { id: "pretraining", label: "Pre-training reminder", subject: "Module {{number}} starts in 24 hours", body: "Hi {{name}},\n\nA gentle nudge — Module {{number}} ({{module_title}}) starts tomorrow at {{date}}. If you'd like to skim the materials first, they're optional but available here:\n\n{{materials_url}}\n\nSee you there.\n— BCJ Learn" },
];

export default function AdminNotifications() {
  const [activeTpl, setActiveTpl] = React.useState(TEMPLATES[0].id);
  const [autoReminders, setAutoReminders] = React.useState(true);
  const [overdueDays, setOverdueDays] = React.useState(3);

  const tpl = TEMPLATES.find((t) => t.id === activeTpl)!;
  const [subject, setSubject] = React.useState(tpl.subject);
  const [body, setBody] = React.useState(tpl.body);

  React.useEffect(() => {
    setSubject(tpl.subject);
    setBody(tpl.body);
  }, [tpl]);

  return (
    <>
      <PageHeader
        eyebrow="Communications"
        title="Notifications & email templates"
        description="Edit what BCJ Learn sends, when, and to whom. Variables in {{double curlies}} are filled at send time."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Templates editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="size-4" /> Email templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTpl} onValueChange={setActiveTpl}>
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
                        {["{{name}}", "{{number}}", "{{module_title}}", "{{date}}", "{{delivery_date}}", "{{login_url}}", "{{check_in_url}}", "{{materials_url}}", "{{result_message}}", "{{cohort}}", "{{reasons}}", "{{reason}}", "{{profile_url}}"].map((v) => (
                          <Badge key={v} variant="outline" className="font-mono text-[10px]">{v}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => toast.success(`${t.label} template saved`)}>Save changes</Button>
                      <Button variant="outline" onClick={() => toast(`Test email sent to nancy@bcj.com`)}>
                        <Send className="size-3.5 mr-1.5" /> Send test
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Auto-rules */}
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
            </CardContent>
          </Card>
        </div>

        {/* Recent sends */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="size-4" /> Recent sends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {notifications.slice(0, 10).map((n) => {
                  const m = managers.find((x) => x.id === n.recipientId);
                  return (
                    <li key={n.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{n.kind}</Badge>
                        <span className="text-xs text-muted-foreground">{fmtRelative(n.sentAt)}</span>
                      </div>
                      <div className="font-medium text-sm mt-1.5 line-clamp-1">{n.subject}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">to {m?.name ?? "—"}</div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
