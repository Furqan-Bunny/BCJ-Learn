"use client";

import * as React from "react";
import { Bell, Search, Command as CmdIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleSwitcher } from "./role-switcher";
import { UserSwitcher } from "./user-switcher";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

export function Topbar() {
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
        <button
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "group flex items-center gap-2 px-3 h-9 w-full max-w-md rounded-md border bg-card text-sm",
            "text-muted-foreground hover:bg-accent hover:border-primary/40 transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          aria-label="Open command palette"
        >
          <Search className="size-4 transition-transform group-hover:scale-110 group-hover:text-primary" />
          <span className="flex-1 text-left">Search employees, modules, actions…</span>
          <kbd className="ml-auto inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] transition-colors group-hover:border-primary/40">
            <CmdIcon className="size-3" /> K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <UserSwitcher />
          <RoleSwitcher />
          <Button variant="ghost" size="icon" className="size-9 relative group" aria-label="Notifications">
            <Bell className="size-4 transition-transform group-hover:rotate-12" />
            <span className="absolute top-2 right-2 inline-flex size-1.5">
              <span className="absolute inset-0 rounded-full bg-[var(--gold)] opacity-70 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[var(--gold)]" />
            </span>
          </Button>
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
