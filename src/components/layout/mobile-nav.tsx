"use client";

// Mobile navigation drawer. The desktop <Sidebar> is hidden below `md`, so on
// phones this hamburger (shown only below `md`) opens the same role-based nav
// in a left Sheet. Reuses NAV_BY_ROLE / ROLE_ICON / isActive from the sidebar.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRoleStore } from "@/store/role-store";
import { useCurrentUser } from "@/lib/supabase/use-user";
import { cn } from "@/lib/utils";
import { NAV_BY_ROLE, ROLE_ICON, isActive } from "./sidebar";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function MobileNav({ brandName = "BCJ Learn" }: { brandName?: string }) {
  // Real authenticated role drives the nav (not the persisted client store).
  const { user } = useCurrentUser();
  const storeRole = useRoleStore((s) => s.role);
  const role = !DEMO_MODE && user?.role ? user.role : storeRole;
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const nodes = NAV_BY_ROLE[role];
  const RoleIcon = ROLE_ICON[role];

  function rowClass(active: boolean) {
    return cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
      active
        ? "bg-primary/10 text-primary font-medium"
        : "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="md:hidden inline-flex items-center justify-center size-9 rounded-md border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
        >
          <Menu className="size-4" />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-72 p-0 gap-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Brand header */}
        <div className="flex items-center gap-2 border-b h-14 px-4 shrink-0">
          <div className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground shrink-0">
            <span className="text-[11px] font-bold tracking-tight">BCJ</span>
          </div>
          <span className="font-semibold tracking-tight truncate">{brandName}</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {nodes.map((node) => {
            if (node.kind === "link") {
              const Icon = node.icon;
              return (
                <Link
                  key={node.href}
                  href={node.href}
                  onClick={() => setOpen(false)}
                  className={rowClass(isActive(pathname, node.href))}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{node.label}</span>
                </Link>
              );
            }
            // Group: a small header + its children (all expanded on mobile).
            const GroupIcon = node.icon;
            return (
              <div key={node.label} className="pt-3 first:pt-0">
                <div className="flex items-center gap-2 px-3 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <GroupIcon className="size-3.5" /> {node.label}
                </div>
                {node.children.map((child) => {
                  const ChildIcon = child.icon;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setOpen(false)}
                      className={rowClass(isActive(pathname, child.href))}
                    >
                      <ChildIcon className="size-4 shrink-0" />
                      <span className="truncate">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer: role indicator */}
        <div className="border-t px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground shrink-0">
          <RoleIcon className="size-4 shrink-0" />
          <span className="truncate">
            Viewing as <strong className="text-foreground/90">{role}</strong>
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
