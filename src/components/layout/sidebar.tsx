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
  Award,
  HelpCircle,
  History,
  PlayCircle,
  ListChecks,
  Trophy,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  TrendingUp,
  Settings2,
  FolderTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoleStore } from "@/store/role-store";
import type { Role } from "@/types";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type IconType = React.ComponentType<{ className?: string }>;

interface NavLink {
  kind: "link";
  label: string;
  href: string;
  icon: IconType;
}

interface NavGroup {
  kind: "group";
  label: string;
  icon: IconType;
  children: NavLink[];
}

type NavNode = NavLink | NavGroup;

export const NAV_BY_ROLE: Record<Role, NavNode[]> = {
  manager: [
    { kind: "link", label: "Dashboard", href: "/manager/dashboard", icon: LayoutDashboard },
    { kind: "link", label: "Modules", href: "/manager/modules", icon: BookOpen },
    { kind: "link", label: "Resources", href: "/manager/resources", icon: FileText },
    { kind: "link", label: "My Progress", href: "/manager/progress", icon: PlayCircle },
    { kind: "link", label: "Help", href: "/help", icon: HelpCircle },
  ],

  teacher: [
    { kind: "link", label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard },
    { kind: "link", label: "My Modules", href: "/teacher/modules", icon: BookOpen },
    {
      kind: "group",
      label: "Reporting",
      icon: TrendingUp,
      children: [
        { kind: "link", label: "Test results", href: "/teacher/results", icon: Trophy },
        { kind: "link", label: "Question library", href: "/teacher/questions", icon: ListChecks },
      ],
    },
    { kind: "link", label: "My team", href: "/teacher/managers", icon: Users },
    { kind: "link", label: "Help", href: "/help", icon: HelpCircle },
  ],

  admin: [
    { kind: "link", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    {
      kind: "group",
      label: "People",
      icon: Users,
      children: [
        { kind: "link", label: "Employees", href: "/admin/managers", icon: Users },
        { kind: "link", label: "Department Leads", href: "/admin/teachers", icon: BookOpen },
        { kind: "link", label: "Admins", href: "/admin/admins", icon: ShieldCheck },
        { kind: "link", label: "At-risk", href: "/admin/at-risk", icon: AlertTriangle },
      ],
    },
    {
      kind: "group",
      label: "Content",
      icon: FolderTree,
      children: [
        { kind: "link", label: "Modules", href: "/admin/modules", icon: BookOpen },
        { kind: "link", label: "Resources", href: "/admin/resources", icon: FileText },
        { kind: "link", label: "Question library", href: "/admin/questions", icon: ListChecks },
      ],
    },
    {
      kind: "group",
      label: "Reporting",
      icon: TrendingUp,
      children: [
        { kind: "link", label: "Test results", href: "/admin/results", icon: Trophy },
        { kind: "link", label: "Reports", href: "/admin/reports", icon: FileText },
      ],
    },
    {
      kind: "group",
      label: "Operations",
      icon: Settings2,
      children: [
        { kind: "link", label: "Notifications", href: "/admin/notifications", icon: Bell },
        { kind: "link", label: "Audit log", href: "/admin/audit-log", icon: History },
        { kind: "link", label: "Settings", href: "/admin/settings/branding", icon: Settings },
        { kind: "link", label: "Certificate", href: "/admin/settings/certificate", icon: Award },
      ],
    },
    { kind: "link", label: "Help", href: "/help", icon: HelpCircle },
  ],
};

export const ROLE_ICON: Record<Role, IconType> = {
  manager: GraduationCap,
  teacher: BookOpen,
  admin: ShieldCheck,
};

const COLLAPSED_KEY = "bcj-sidebar-collapsed";
const OPEN_GROUPS_KEY = "bcj-sidebar-open-groups";

export function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/") return false;
  return pathname.startsWith(href);
}

interface SidebarProps {
  logoUrl?: string | null;
  brandName?: string;
}

export function Sidebar({ logoUrl, brandName = "BCJ Learn" }: SidebarProps) {
  const role = useRoleStore((s) => s.role);
  const pathname = usePathname();
  const reduced = !!useReducedMotion();
  const RoleIcon = ROLE_ICON[role];
  const nodes = NAV_BY_ROLE[role];

  const [collapsed, setCollapsed] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = React.useState(false);

  // Read persisted state on mount.
  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSED_KEY) === "1") setCollapsed(true);
      const raw = window.localStorage.getItem(OPEN_GROUPS_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setOpenGroups(new Set(parsed.filter((v): v is string => typeof v === "string")));
          setHydrated(true);
          return;
        }
      }
      // First visit — open any group containing the active route by default.
      const initial = new Set<string>();
      for (const n of nodes) {
        if (n.kind === "group" && n.children.some((c) => isActive(pathname, c.href))) {
          initial.add(n.label);
        }
      }
      setOpenGroups(initial);
    } catch {
      // ignore
    }
    setHydrated(true);
    // We only want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  function toggleGroup(label: string) {
    // If the sidebar is collapsed, expand it first then open the group.
    if (collapsed) {
      setCollapsed(false);
      try {
        window.localStorage.setItem(COLLAPSED_KEY, "0");
      } catch {
        // ignore
      }
    }
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        window.localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <motion.aside
      data-collapsed={collapsed ? "true" : "false"}
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={
        reduced || !hydrated
          ? { duration: 0 }
          : { type: "spring", stiffness: 320, damping: 32 }
      }
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 shrink-0 border-r bg-sidebar text-sidebar-foreground overflow-hidden",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b border-sidebar-border h-[57px] px-4",
          collapsed && "justify-center px-2",
        )}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={brandName}
            // White chip so a dark/navy logo stays visible on the dark sidebar.
            className={cn(
              "w-auto object-contain rounded-md bg-white p-1.5",
              collapsed ? "h-8 mx-auto" : "h-9",
            )}
          />
        ) : (
          <>
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground shrink-0">
              <span className="text-[11px] font-bold tracking-tight">BCJ</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-semibold tracking-tight truncate">{brandName}</span>
                <span className="text-[11px] text-muted-foreground -mt-0.5">Academy v1</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-0.5",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {nodes.map((node) => {
          if (node.kind === "link") {
            return (
              <LinkRow
                key={node.href}
                item={node}
                active={isActive(pathname, node.href)}
                collapsed={collapsed}
                reduced={reduced}
              />
            );
          }
          // Group
          const groupHasActive = node.children.some((c) => isActive(pathname, c.href));
          const isOpen = openGroups.has(node.label);
          return (
            <div key={node.label}>
              <GroupRow
                label={node.label}
                Icon={node.icon}
                open={isOpen}
                hasActive={groupHasActive}
                collapsed={collapsed}
                reduced={reduced}
                onClick={() => toggleGroup(node.label)}
              />
              <AnimatePresence initial={false}>
                {isOpen && !collapsed && (
                  <motion.ul
                    key="children"
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? undefined : { height: 0, opacity: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { height: { duration: 0.22, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: 0.18 } }
                    }
                    className="overflow-hidden mb-1"
                  >
                    <div className="relative pl-3 ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/70">
                      {node.children.map((child) => (
                        <LinkRow
                          key={child.href}
                          item={child}
                          active={isActive(pathname, child.href)}
                          collapsed={false}
                          reduced={reduced}
                          dense
                        />
                      ))}
                    </div>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Footer: role indicator + collapse toggle */}
      <div
        className={cn(
          "border-t border-sidebar-border",
          collapsed ? "px-2 py-3 flex flex-col items-center gap-2" : "px-3 py-3 flex items-center gap-2",
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-1 min-w-0 px-1">
            <RoleIcon className="size-4 shrink-0" />
            <span className="truncate">
              You&apos;re viewing as <strong className="text-foreground/90">{role}</strong>
            </span>
          </div>
        )}
        {collapsed && <RoleIcon className="size-4 text-muted-foreground" />}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded-md size-8 flex items-center justify-center text-muted-foreground",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>
    </motion.aside>
  );
}

/* ─── Row components ────────────────────────────────────── */

function LinkRow({
  item,
  active,
  collapsed,
  reduced,
  dense,
}: {
  item: NavLink;
  active: boolean;
  collapsed: boolean;
  reduced: boolean;
  dense?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={cn(
        "group relative flex items-center rounded-md text-sm transition-colors duration-200",
        collapsed
          ? "justify-center size-10 mx-auto"
          : dense
          ? "gap-2.5 px-2.5 py-1.5"
          : "gap-3 px-3 py-2",
        active
          ? "text-primary font-medium"
          : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {active && !reduced && (
        <motion.span
          layoutId="sidebar-active-pill"
          className="absolute inset-0 rounded-md bg-primary/10 -z-10"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      {active && !reduced && (
        <motion.span
          layoutId="sidebar-active-rail"
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      {active && reduced && (
        <>
          <span className="absolute inset-0 rounded-md bg-primary/10 -z-10" />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-primary" />
        </>
      )}
      <Icon
        className={cn(
          dense ? "size-3.5" : "size-4",
          "shrink-0 transition-transform",
          !active && "group-hover:scale-110",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

function GroupRow({
  label,
  Icon,
  open,
  hasActive,
  collapsed,
  reduced,
  onClick,
}: {
  label: string;
  Icon: IconType;
  open: boolean;
  hasActive: boolean;
  collapsed: boolean;
  reduced: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={label}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative w-full flex items-center rounded-md text-sm transition-colors duration-200",
        collapsed ? "justify-center size-10 mx-auto" : "gap-3 px-3 py-2",
        hasActive && !open
          ? "text-primary font-medium"
          : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      {hasActive && !open && (
        <span className="absolute inset-0 rounded-md bg-primary/10 -z-10" />
      )}
      <Icon
        className={cn(
          "size-4 shrink-0 transition-transform",
          !hasActive && "group-hover:scale-110",
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate flex-1 text-left">{label}</span>
          <motion.span
            animate={{ rotate: open ? 0 : -90 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
            className="text-muted-foreground/70"
          >
            <ChevronDown className="size-3.5" />
          </motion.span>
        </>
      )}
      {collapsed && hasActive && (
        <span className="absolute -right-0.5 top-1.5 size-1.5 rounded-full bg-primary" />
      )}
    </button>
  );
}
