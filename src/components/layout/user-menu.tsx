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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  Settings,
  LogOut,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { useRoleStore } from "@/store/role-store";
import { allUsers } from "@/data/users";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import type { Role } from "@/types";

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

export function UserMenu() {
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const userId = useRoleStore((s) => s.authedUserId);
  const logout = useRoleStore((s) => s.logout);
  const user = allUsers.find((u) => u.id === userId) ?? allUsers[0];
  const RoleIcon = ROLE_ICON[role];

  function handleSignOut() {
    logout();
    toast.success("Signed out");
    // Small delay so the toast registers before redirect
    setTimeout(() => router.push("/login"), 200);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-primary/30 hover:ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label="Open user menu"
      >
        <Avatar className="size-9 border">
          <AvatarFallback
            style={{ background: user.avatarColor, color: "white" }}
            className="text-xs font-semibold"
          >
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {/* User identity card */}
        <div className="px-2 py-2 flex items-center gap-3">
          <Avatar className="size-10 border">
            <AvatarFallback
              style={{ background: user.avatarColor, color: "white" }}
              className="text-sm font-semibold"
            >
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{user.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary font-medium">
              <RoleIcon className="size-3" />
              {ROLE_LABEL[role]}
              <span className="ml-1 px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">Demo</span>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Account
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toast.info("Profile page (mocked)")}>
          <User className="mr-2 size-4" />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(role === "admin" ? "/admin/settings/branding" : "/admin/settings/branding")}>
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info("Help center (mocked)")}>
          <HelpCircle className="mr-2 size-4" />
          Help &amp; support
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Demo
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => toast(`This is a demo. ${user.name} is a sample user.`, { icon: <Sparkles className="size-4 text-[var(--ai)]" /> })}>
          <Sparkles className="mr-2 size-4 text-[var(--ai)]" />
          About this demo
        </DropdownMenuItem>

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
  );
}
