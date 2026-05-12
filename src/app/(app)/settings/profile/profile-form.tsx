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
import { Camera, ShieldCheck, GraduationCap, BookOpen, LogOut, Save, KeyRound } from "lucide-react";
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
