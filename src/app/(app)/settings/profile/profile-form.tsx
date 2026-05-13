"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Camera, ShieldCheck, GraduationCap, BookOpen, LogOut, Save, KeyRound, Phone, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { createClient } from "@/lib/supabase/client";
import { uploadAvatar } from "@/lib/supabase/storage";
import { updateProfile, changePassword, signOutEverywhere } from "./actions";
import { toast } from "sonner";
import type { Role } from "@/types";
import { fmtDate, fmtRelative } from "@/lib/format";

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  manager: GraduationCap,
  teacher: BookOpen,
  admin: ShieldCheck,
};

const ROLE_LABEL: Record<Role, string> = {
  manager: "Employee",
  teacher: "Department Lead",
  admin: "Admin",
};

export interface ProfileFormProps {
  initial: {
    id: string;
    name: string;
    email: string;
    role: Role;
    cohort: string | null;
    avatarColor: string;
    avatarUrl: string | null;
    bio: string | null;
    title: string | null;
    joinedAt: string;
    lastActiveAt: string;
    phone: string | null;
    notificationPrefs: {
      quizResults: boolean;
      trainingReminders: boolean;
      atRiskAlerts: boolean;
    };
  };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Identity
  const [name, setName] = React.useState(initial.name);
  const [bio, setBio] = React.useState(initial.bio ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(initial.avatarUrl);
  const [uploading, setUploading] = React.useState(false);
  const [savingIdentity, setSavingIdentity] = React.useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changingPassword, setChangingPassword] = React.useState(false);

  // Contact (phone)
  const [phone, setPhone] = React.useState(initial.phone ?? "");
  const [savingPhone, setSavingPhone] = React.useState(false);
  const phoneChanged = phone !== (initial.phone ?? "");

  // Notification preferences
  const [quizResults, setQuizResults] = React.useState(initial.notificationPrefs.quizResults);
  const [trainingReminders, setTrainingReminders] = React.useState(initial.notificationPrefs.trainingReminders);
  const [atRiskAlerts, setAtRiskAlerts] = React.useState(initial.notificationPrefs.atRiskAlerts);
  const [savingPrefs, setSavingPrefs] = React.useState(false);
  const prefsChanged =
    quizResults !== initial.notificationPrefs.quizResults ||
    trainingReminders !== initial.notificationPrefs.trainingReminders ||
    atRiskAlerts !== initial.notificationPrefs.atRiskAlerts;

  // Danger
  const [signingOutEverywhere, setSigningOutEverywhere] = React.useState(false);

  const RoleIcon = ROLE_ICON[initial.role];

  const identityChanged = name !== initial.name || bio !== (initial.bio ?? "");

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadAvatar(initial.id, file);
      const sb = createClient();
      await sb.from("profiles").update({ avatar_url: url }).eq("id", initial.id);
      setAvatarUrl(url);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSaveIdentity() {
    setSavingIdentity(true);
    const result = await updateProfile({
      name,
      bio: initial.role === "teacher" ? bio : undefined,
    });
    setSavingIdentity(false);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to save");
      return;
    }
    toast.success("Profile saved");
    router.refresh();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    setChangingPassword(true);
    const result = await changePassword({ currentPassword, newPassword });
    setChangingPassword(false);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to change password");
      return;
    }
    toast.success("Password changed");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function handleSavePhone() {
    setSavingPhone(true);
    const result = await updateProfile({ phone: phone.trim() === "" ? null : phone });
    setSavingPhone(false);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to save phone");
      return;
    }
    toast.success("Phone saved");
    router.refresh();
  }

  async function handleSavePrefs() {
    setSavingPrefs(true);
    const result = await updateProfile({
      notificationPrefs: { quizResults, trainingReminders, atRiskAlerts },
    });
    setSavingPrefs(false);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to save preferences");
      return;
    }
    toast.success("Notification preferences saved");
    router.refresh();
  }

  async function handleSignOutEverywhere() {
    if (!confirm("Sign out of all devices? You'll need to sign in again on each one.")) return;
    setSigningOutEverywhere(true);
    const result = await signOutEverywhere();
    setSigningOutEverywhere(false);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to sign out");
      return;
    }
    toast.success("Signed out everywhere");
    router.push("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Hidden file input for avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Your name, photo, and role across BCJ Learn.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={name || initial.email}
              avatarUrl={avatarUrl}
              avatarColor={initial.avatarColor}
              size="lg"
              className="size-16"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="size-3.5 mr-1.5" />
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add a photo"}
            </Button>
            {avatarUrl && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const sb = createClient();
                  await sb.from("profiles").update({ avatar_url: null }).eq("id", initial.id);
                  setAvatarUrl(null);
                  toast.success("Photo removed");
                  router.refresh();
                }}
              >
                Remove
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="prof-name">Full name</Label>
            <Input
              id="prof-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label>Work email</Label>
            <Input value={initial.email} disabled className="h-10 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              Email is your sign-in identity. Contact your admin to change it.
            </p>
          </div>

          {initial.role === "teacher" && (
            <div className="space-y-2">
              <Label htmlFor="prof-bio">Short bio</Label>
              <Textarea
                id="prof-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A sentence about your area of focus."
                rows={3}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Shown to Employees on modules you own.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="inline-flex items-center gap-2 text-xs">
              <RoleIcon className="size-3.5 text-primary" />
              <span className="font-medium">{ROLE_LABEL[initial.role]}</span>
              {initial.cohort && (
                <Badge variant="secondary" className="text-[10px]">{initial.cohort}</Badge>
              )}
            </div>
            <Button
              onClick={handleSaveIdentity}
              disabled={!identityChanged || savingIdentity}
              size="sm"
            >
              <Save className="size-3.5 mr-1.5" />
              {savingIdentity ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contact — phone number */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4" /> Contact
          </CardTitle>
          <CardDescription>How BCJ Learn can reach you outside email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="prof-phone">Phone number</Label>
            <Input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (415) 555-2671"
              autoComplete="tel"
              className="h-10"
            />
            <p className="text-[11px] text-muted-foreground">
              Optional. Used for emergency contact and future SMS reminders. We don&rsquo;t share it.
            </p>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSavePhone} disabled={!phoneChanged || savingPhone} size="sm">
              <Save className="size-3.5 mr-1.5" />
              {savingPhone ? "Saving…" : "Save phone"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4" /> Notification preferences
          </CardTitle>
          <CardDescription>Pick which BCJ Learn emails land in your inbox.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PrefToggle
            id="pref-quiz-results"
            checked={quizResults}
            onChange={setQuizResults}
            label="Quiz result emails"
            description="Get an email when you pass or are scheduled for a retake."
          />
          <PrefToggle
            id="pref-training-reminders"
            checked={trainingReminders}
            onChange={setTrainingReminders}
            label="Training reminders"
            description="Reminder emails for modules you haven't completed."
          />
          {initial.role === "admin" && (
            <PrefToggle
              id="pref-at-risk-alerts"
              checked={atRiskAlerts}
              onChange={setAtRiskAlerts}
              label="At-risk alerts"
              description="Get an alert when an employee is flagged at-risk."
            />
          )}

          <p className="text-[11px] text-muted-foreground border-t pt-3">
            Account-critical emails (invitations, password resets) are always sent.
          </p>

          <div className="flex justify-end">
            <Button onClick={handleSavePrefs} disabled={!prefsChanged || savingPrefs} size="sm">
              <Save className="size-3.5 mr-1.5" />
              {savingPrefs ? "Saving…" : "Save preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account context (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Information your admin can see about your account.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Joined</div>
            <div className="font-medium">{fmtDate(initial.joinedAt)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last active</div>
            <div className="font-medium">{fmtRelative(initial.lastActiveAt)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" /> Change password
          </CardTitle>
          <CardDescription>Use a fresh password — at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="curr-pw">Current password</Label>
              <Input
                id="curr-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="h-10"
                required
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-10"
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="conf-pw">Confirm new password</Label>
                <Input
                  id="conf-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-10"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
              >
                {changingPassword ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-rose-500/30">
        <CardHeader>
          <CardTitle className="text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <LogOut className="size-4" /> Danger zone
          </CardTitle>
          <CardDescription>
            Sign out of every device where you&rsquo;re currently logged in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="text-rose-600 border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            onClick={handleSignOutEverywhere}
            disabled={signingOutEverywhere}
          >
            {signingOutEverywhere ? "Signing out…" : "Sign out everywhere"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PrefToggle({
  id,
  checked,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Label htmlFor={id} className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
