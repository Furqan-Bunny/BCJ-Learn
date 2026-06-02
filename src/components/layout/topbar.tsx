"use client";

import * as React from "react";
import { Search, Command as CmdIcon } from "lucide-react";
import { RoleSwitcher } from "./role-switcher";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import { NotificationsBell } from "./notifications-bell";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/types";

interface TopbarProps {
  userId: string | null;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

export function Topbar({ userId, initialNotifications, initialUnreadCount }: TopbarProps) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3 px-4 md:px-6 h-14">
        <MobileNav />
        <button
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "group flex items-center gap-2 px-3 h-9 w-full max-w-md min-w-0 rounded-md border bg-card text-sm",
            "text-muted-foreground hover:bg-accent hover:border-primary/40 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          aria-label="Open command palette"
        >
          <Search className="size-4 shrink-0 transition-transform group-hover:scale-110 group-hover:text-primary" />
          <span className="flex-1 min-w-0 text-left truncate">
            <span className="sm:hidden">Search…</span>
            <span className="hidden sm:inline">Search employees, modules, actions…</span>
          </span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] transition-colors group-hover:border-primary/40">
            <CmdIcon className="size-3" /> K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <RoleSwitcher />
          {userId && (
            <NotificationsBell
              userId={userId}
              initialItems={initialNotifications}
              initialUnreadCount={initialUnreadCount}
            />
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
