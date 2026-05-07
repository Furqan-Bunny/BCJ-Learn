"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Sparkles, GraduationCap, BookOpen, ShieldCheck } from "lucide-react";
import { useRoleStore } from "@/store/role-store";
import { managers, teachers, admins } from "@/data/users";
import { attempts } from "@/data/attempts";
import { initials } from "@/lib/format";
import type { Role } from "@/types";

interface SampleUser {
  id: string;
  name: string;
  role: Role;
  hint: string;
  cohort?: string;
}

// Curated sample users that exercise different states in the demo
const SAMPLE_USERS: SampleUser[] = [
  // Managers in different states (computed below from real data)
  // Teachers
  { id: "t-nancy", name: "Nancy Park", role: "teacher", hint: "Owns Module 1 — Operations & Leadership" },
  { id: "t-summer", name: "Summer Reid", role: "teacher", hint: "Owns Module 2 — Quality Control" },
  { id: "t-victoria", name: "Victoria Liu", role: "teacher", hint: "Owns Module 3 — Finance" },
  { id: "t-isabel", name: "Isabel Reyes", role: "teacher", hint: "Owns Module 4 — HR" },
  { id: "t-mark", name: "Mark Donaldson", role: "teacher", hint: "Owns Module 5 — BD" },
  // Admins
  { id: "a-nancy", name: "Nancy Park", role: "admin", hint: "Director of Operations" },
  { id: "a-isabel", name: "Isabel Reyes", role: "admin", hint: "VP Operations" },
  { id: "a-majed", name: "Majed Hassan", role: "admin", hint: "Founder & CEO" },
];

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  manager: GraduationCap,
  teacher: BookOpen,
  admin: ShieldCheck,
};

export function UserSwitcher() {
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const userId = useRoleStore((s) => s.authedUserId);
  const setRole = useRoleStore((s) => s.setRole);
  const setAuthedUserId = useRoleStore((s) => s.setAuthedUserId);

  // Compute interesting manager samples on the fly
  const managerSamples: SampleUser[] = React.useMemo(() => {
    const passedM1 = managers.find((m) => attempts.some((a) => a.managerId === m.id && a.moduleSlug === "operations-leadership" && a.status === "passed"));
    const failedM1 = managers.find((m) => {
      const myAttempts = attempts.filter((a) => a.managerId === m.id && a.moduleSlug === "operations-leadership");
      return myAttempts.length > 0 && !myAttempts.some((a) => a.status === "passed");
    });
    const atRisk = managers.find((m) => m.status === "at-risk");
    const noAttempts = managers.find((m) => !attempts.some((a) => a.managerId === m.id));
    const out: SampleUser[] = [];
    if (passedM1) out.push({ id: passedM1.id, name: passedM1.name, role: "manager", hint: "Already passed Module 1", cohort: passedM1.cohort });
    if (failedM1 && failedM1.id !== passedM1?.id) out.push({ id: failedM1.id, name: failedM1.name, role: "manager", hint: "Failed Module 1 — needs retake", cohort: failedM1.cohort });
    if (atRisk && !out.find((s) => s.id === atRisk.id)) out.push({ id: atRisk.id, name: atRisk.name, role: "manager", hint: "Auto-flagged as at-risk", cohort: atRisk.cohort });
    if (noAttempts && !out.find((s) => s.id === noAttempts.id)) out.push({ id: noAttempts.id, name: noAttempts.name, role: "manager", hint: "Hasn't taken any quiz yet", cohort: noAttempts.cohort });
    return out;
  }, []);

  const all = [...managerSamples, ...SAMPLE_USERS];
  const currentUser = all.find((u) => u.id === userId);

  function pickUser(u: SampleUser) {
    if (u.role !== role) {
      setRole(u.role);
    }
    setAuthedUserId(u.id);
    // Navigate to the role's home so they see immediate effect
    const dest = u.role === "manager" ? "/manager/dashboard" : u.role === "teacher" ? "/teacher/dashboard" : "/admin/dashboard";
    router.push(dest);
  }

  const colorFor = (name: string) => {
    const m = [...managers, ...teachers, ...admins].find((u) => u.name === name || u.id === currentUser?.id);
    return m?.avatarColor ?? "#1F3A5F";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-9 px-2 text-xs">
          <Avatar className="size-6">
            <AvatarFallback
              style={{ background: colorFor(currentUser?.name ?? ""), color: "white" }}
              className="text-[9px] font-semibold"
            >
              {initials(currentUser?.name ?? "—")}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline truncate max-w-[100px]">{currentUser?.name ?? "Demo user"}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
          <Sparkles className="size-3 text-[var(--ai)]" /> Demo: switch user
        </DropdownMenuLabel>
        <div className="px-2 pb-1 text-[10px] text-muted-foreground">
          Curated sample users that exercise different platform states.
        </div>
        <DropdownMenuSeparator />

        {managerSamples.length > 0 && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Employees
            </DropdownMenuLabel>
            {managerSamples.map((u) => {
              const Icon = ROLE_ICON[u.role];
              const isCurrent = u.id === userId;
              return (
                <DropdownMenuItem key={u.id} onClick={() => pickUser(u)} className="flex items-start gap-2 py-2">
                  <Icon className="size-3.5 mt-1 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium flex items-center gap-1.5">
                      {u.name}
                      {isCurrent && <Badge variant="secondary" className="text-[9px]">Current</Badge>}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{u.hint}{u.cohort ? ` · ${u.cohort}` : ""}</div>
                  </div>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Department Leads
        </DropdownMenuLabel>
        {SAMPLE_USERS.filter((u) => u.role === "teacher").map((u) => {
          const Icon = ROLE_ICON[u.role];
          const isCurrent = u.id === userId;
          return (
            <DropdownMenuItem key={u.id} onClick={() => pickUser(u)} className="flex items-start gap-2 py-2">
              <Icon className="size-3.5 mt-1 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  {u.name}
                  {isCurrent && <Badge variant="secondary" className="text-[9px]">Current</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{u.hint}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Admins
        </DropdownMenuLabel>
        {SAMPLE_USERS.filter((u) => u.role === "admin").map((u) => {
          const Icon = ROLE_ICON[u.role];
          const isCurrent = u.id === userId;
          return (
            <DropdownMenuItem key={u.id} onClick={() => pickUser(u)} className="flex items-start gap-2 py-2">
              <Icon className="size-3.5 mt-1 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium flex items-center gap-1.5">
                  {u.name}
                  {isCurrent && <Badge variant="secondary" className="text-[9px]">Current</Badge>}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">{u.hint}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
