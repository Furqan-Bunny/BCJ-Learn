"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Users,
  AlertTriangle,
  FileText,
  Bell,
  Settings,
  History,
  Sparkles,
  PlayCircle,
  ListChecks,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<Role, { section: string; items: NavItem[] }[]> = {
  manager: [
    {
      section: "Learn",
      items: [
        { label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
        { label: "Modules", href: "/manager/modules", icon: BookOpen },
        { label: "My Progress", href: "/manager/progress", icon: PlayCircle },
      ],
    },
  ],
  teacher: [
    {
      section: "Teach",
      items: [
        { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
        { label: "My Modules", href: "/teacher/modules", icon: BookOpen },
      ],
    },
    {
      section: "Reporting",
      items: [
        { label: "Test results", href: "/teacher/results", icon: Trophy },
        { label: "Question library", href: "/teacher/questions", icon: ListChecks },
      ],
    },
    {
      section: "People",
      items: [
        { label: "My trainees", href: "/teacher/managers", icon: Users },
      ],
    },
  ],
  admin: [
    {
      section: "Overview",
      items: [
        { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      section: "People",
      items: [
        { label: "Account Managers", href: "/admin/managers", icon: Users },
        { label: "Teachers", href: "/admin/teachers", icon: BookOpen },
        { label: "Admins", href: "/admin/admins", icon: ShieldCheck },
        { label: "At-risk", href: "/admin/at-risk", icon: AlertTriangle },
      ],
    },
    {
      section: "Content",
      items: [
        { label: "Modules", href: "/admin/modules", icon: BookOpen },
        { label: "Question library", href: "/admin/questions", icon: ListChecks },
      ],
    },
    {
      section: "Reporting",
      items: [
        { label: "Test results", href: "/admin/results", icon: Trophy },
        { label: "Reports", href: "/admin/reports", icon: FileText },
      ],
    },
    {
      section: "Operations",
      items: [
        { label: "Notifications", href: "/admin/notifications", icon: Bell },
        { label: "Audit log", href: "/admin/audit-log", icon: History },
        { label: "Settings", href: "/admin/settings/branding", icon: Settings },
      ],
    },
  ],
};

const ROLE_ICON: Record<Role, React.ComponentType<{ className?: string }>> = {
  manager: GraduationCap,
  teacher: BookOpen,
  admin: ShieldCheck,
};

export function Sidebar() {
  const role = useRoleStore((s) => s.role);
  const pathname = usePathname();
  const RoleIcon = ROLE_ICON[role];
  const sections = NAV_BY_ROLE[role];

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground",
      )}
    >
      <div className="flex items-center gap-2 px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold tracking-tight">BCJ Learn</span>
          <span className="text-[11px] text-muted-foreground -mt-0.5">Academy v1</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map((section) => (
          <div key={section.section}>
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.section}
            </div>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:translate-x-0.5",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn("size-4 transition-transform", !active && "group-hover:scale-110")} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RoleIcon className="size-4" />
          <span>You're viewing as <strong className="text-foreground/90">{role}</strong></span>
        </div>
      </div>
    </aside>
  );
}
