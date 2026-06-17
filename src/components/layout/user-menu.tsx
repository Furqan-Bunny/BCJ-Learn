"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  User,
  Settings,
  LogOut,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Camera,
  Languages,
  Check,
} from "lucide-react";
import { useRoleStore } from "@/store/role-store";
import { useCurrentUser } from "@/lib/supabase/use-user";
import { createClient } from "@/lib/supabase/client";
import { setLocale } from "@/lib/server/locale-actions";
import { useLocale, useT } from "@/lib/i18n/provider";
import { SHOW_SPANISH } from "@/lib/i18n";
import { toast } from "sonner";
import type { Role } from "@/types";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  manager: GraduationCap,
  teacher: BookOpen,
  admin: ShieldCheck,
};

const ROLE_LABEL: Record<Role, string> = {
  manager: "Manager",
  teacher: "Department Lead",
  admin: "Admin",
};

export function UserMenu() {
  const router = useRouter();
  const logout = useRoleStore((s) => s.logout);
  const { user } = useCurrentUser();
  const locale = useLocale();
  const t = useT();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  async function chooseLocale(next: "en" | "es") {
    if (next === locale) return;
    const res = await setLocale(next);
    if (!res.ok) { toast.error(res.error ?? "Could not change language"); return; }
    toast.success(t("lang.saved"));
    router.refresh();
  }

  if (!user) return null;

  const RoleIcon = ROLE_ICON[user.role];

  async function handleSignOut() {
    if (!DEMO_MODE) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    logout();
    // Hard-navigate (not router.push) so the authenticated shell unloads
    // immediately — a soft push left the current page mounted for a moment,
    // during which the nav could flash a different role's chrome. A full
    // document load to /login tears down all client state cleanly.
    window.location.replace("/login");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (DEMO_MODE) {
      toast.info("Profile photo upload is disabled in demo mode");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Bust cache by appending the upload timestamp.
      const url = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);

      if (profErr) throw profErr;

      toast.success("Profile photo updated");
      // Update the avatar everywhere immediately (topbar, menu) without a reload,
      // then refresh server components too.
      window.dispatchEvent(new Event("bcj:user-refresh"));
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-primary/30 hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Open user menu"
        >
          <UserAvatar
            name={user.name}
            avatarUrl={user.avatarUrl}
            avatarColor={user.avatarColor}
            size="default"
            className="size-9"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* User identity card */}
          <div className="px-2 py-2 flex items-center gap-3">
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              avatarColor={user.avatarColor}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                <RoleIcon className="size-3" />
                {ROLE_LABEL[user.role]}
                {DEMO_MODE && (
                  <span className="ml-1 px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">Demo</span>
                )}
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />

          <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Account
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="mr-2 size-4" />
            {uploading ? "Uploading…" : "Change profile photo"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/my-profile")}>
            <User className="mr-2 size-4" />
            My profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
            <Settings className="mr-2 size-4" />
            {user.role === "manager" ? t("nav.settings") : "Settings"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/help")}>
            <HelpCircle className="mr-2 size-4" />
            {user.role === "manager" ? t("nav.help") : "Help & support"}
          </DropdownMenuItem>

          {/* Language switch — employees only (staff screens stay English). */}
          {user.role === "manager" && SHOW_SPANISH && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <span className="inline-flex items-center gap-1.5"><Languages className="size-3" /> {t("lang.label")}</span>
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => chooseLocale("en")}>
                <Check className={`mr-2 size-4 ${locale === "en" ? "opacity-100" : "opacity-0"}`} />
                {t("lang.english")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => chooseLocale("es")}>
                <Check className={`mr-2 size-4 ${locale === "es" ? "opacity-100" : "opacity-0"}`} />
                {t("lang.spanish")}
              </DropdownMenuItem>
            </>
          )}

          {DEMO_MODE && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Demo
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => toast(`This is a demo. ${user.name} is a sample user.`, { icon: <Sparkles className="size-4 text-[var(--ai)]" /> })}>
                <Sparkles className="mr-2 size-4 text-[var(--ai)]" />
                About this demo
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30"
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
