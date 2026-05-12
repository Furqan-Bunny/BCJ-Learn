"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  LayoutDashboard,
  Users,
  AlertTriangle,
  FileText,
  Settings,
  Bell,
  Sparkles,
  PlayCircle,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRoleStore } from "@/store/role-store";
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/types";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QuickJumpItem {
  modules: { slug: string; number: number; title: string }[];
  managers: { id: string; name: string; cohort: string | null }[];
}

const EMPTY: QuickJumpItem = { modules: [], managers: [] };

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const role = useRoleStore((s) => s.role);
  const setRole = useRoleStore((s) => s.setRole);
  const { setTheme } = useTheme();
  const [data, setData] = React.useState<QuickJumpItem>(EMPTY);

  // Lazy-fetch modules + managers from Supabase when the palette opens.
  React.useEffect(() => {
    if (!open) return;
    if (data.modules.length > 0 || data.managers.length > 0) return; // already loaded
    let cancelled = false;
    const sb = createClient();
    void Promise.all([
      sb.from("modules").select("slug, number, title").order("number"),
      sb.from("profiles").select("id, name, cohort").eq("role", "manager").order("name").limit(50),
    ]).then(([modRes, mgrRes]) => {
      if (cancelled) return;
      setData({
        modules: ((modRes.data ?? []) as { slug: string; number: number; title: string }[]),
        managers: ((mgrRes.data ?? []) as { id: string; name: string; cohort: string | null }[]),
      });
    });
    return () => { cancelled = true; };
  }, [open, data.modules.length, data.managers.length]);

  function go(href: string) {
    router.push(href);
    onOpenChange(false);
  }

  function pickRole(r: Role) {
    const dest = r === "manager" ? "/manager/dashboard" : r === "teacher" ? "/teacher/dashboard" : "/admin/dashboard";
    setRole(r);
    router.push(dest);
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette">
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          {role === "admin" && (
            <>
              <CommandItem onSelect={() => go("/admin/dashboard")}>
                <LayoutDashboard className="mr-2 size-4" /> Admin Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/managers")}>
                <Users className="mr-2 size-4" /> Employees
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/at-risk")}>
                <AlertTriangle className="mr-2 size-4" /> At-risk list
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/reports")}>
                <FileText className="mr-2 size-4" /> Reports
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/notifications")}>
                <Bell className="mr-2 size-4" /> Notifications
              </CommandItem>
              <CommandItem onSelect={() => go("/admin/settings/branding")}>
                <Settings className="mr-2 size-4" /> Settings
              </CommandItem>
            </>
          )}
          {role === "teacher" && (
            <>
              <CommandItem onSelect={() => go("/teacher/dashboard")}>
                <LayoutDashboard className="mr-2 size-4" /> Department Lead Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/teacher/modules")}>
                <BookOpen className="mr-2 size-4" /> My Modules
              </CommandItem>
            </>
          )}
          {role === "manager" && (
            <>
              <CommandItem onSelect={() => go("/manager/dashboard")}>
                <LayoutDashboard className="mr-2 size-4" /> My Dashboard
              </CommandItem>
              <CommandItem onSelect={() => go("/manager/modules")}>
                <BookOpen className="mr-2 size-4" /> Modules
              </CommandItem>
              <CommandItem onSelect={() => go("/manager/progress")}>
                <PlayCircle className="mr-2 size-4" /> My Progress
              </CommandItem>
            </>
          )}
        </CommandGroup>

        {data.modules.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Modules">
              {data.modules.map((m) => (
                <CommandItem
                  key={m.slug}
                  onSelect={() => {
                    const base =
                      role === "manager" ? "/manager/modules/" : role === "teacher" ? "/teacher/modules/" : "/admin/modules/";
                    go(base + m.slug);
                  }}
                >
                  <Sparkles className="mr-2 size-4 text-[var(--gold)]" />
                  <span className="font-mono text-xs text-muted-foreground mr-2">M{m.number}</span>
                  {m.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {role === "admin" && data.managers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Find an employee">
              {data.managers.slice(0, 8).map((m) => (
                <CommandItem key={m.id} onSelect={() => go(`/admin/managers/${m.id}`)}>
                  <Users className="mr-2 size-4" /> {m.name}
                  <span className="ml-auto text-xs text-muted-foreground">{m.cohort ?? ""}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Switch role">
          <CommandItem onSelect={() => pickRole("manager")}>
            <GraduationCap className="mr-2 size-4" /> View as Employee
          </CommandItem>
          <CommandItem onSelect={() => pickRole("teacher")}>
            <BookOpen className="mr-2 size-4" /> View as Department Lead
          </CommandItem>
          <CommandItem onSelect={() => pickRole("admin")}>
            <ShieldCheck className="mr-2 size-4" /> View as Admin
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => setTheme("light")}><Sun className="mr-2 size-4" /> Light</CommandItem>
          <CommandItem onSelect={() => setTheme("dark")}><Moon className="mr-2 size-4" /> Dark</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
