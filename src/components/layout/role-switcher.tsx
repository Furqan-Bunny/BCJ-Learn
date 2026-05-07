"use client";

import * as React from "react";
import { GraduationCap, BookOpen, ShieldCheck, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/types";

const ROLE_META: Record<Role, { label: string; icon: typeof GraduationCap; description: string; route: string }> = {
  manager: {
    label: "Employee",
    icon: GraduationCap,
    description: "Trainee — take quizzes, track progress",
    route: "/manager/dashboard",
  },
  teacher: {
    label: "Department Lead",
    icon: BookOpen,
    description: "Module owner — approve questions, see results",
    route: "/teacher/dashboard",
  },
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    description: "BCJ leadership — full program oversight",
    route: "/admin/dashboard",
  },
};

export function RoleSwitcher() {
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const setRole = useRoleStore((s) => s.setRole);
  const Active = ROLE_META[role].icon;

  function pick(r: Role) {
    setRole(r);
    router.push(ROLE_META[r].route);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 px-3">
          <Active className="size-4" />
          <span className="font-medium">{ROLE_META[role].label}</span>
          <Badge variant="secondary" className="ml-1 text-[10px] uppercase tracking-wider">
            Demo
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Switch role
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(ROLE_META) as Role[]).map((r) => {
          const Icon = ROLE_META[r].icon;
          return (
            <DropdownMenuItem
              key={r}
              onClick={() => pick(r)}
              className="cursor-pointer items-start gap-3 py-3"
            >
              <Icon className="size-5 mt-0.5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{ROLE_META[r].label}</div>
                  {role === r && <Check className="size-4 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {ROLE_META[r].description}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
