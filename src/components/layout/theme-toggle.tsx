"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Pre-typed wrapper around the View Transitions API. Falls back gracefully on
// browsers that don't support it (Safari < 18, older Firefox).
type StartViewTransition = (cb: () => void) => unknown;

function setThemeWithTransition(
  e: React.MouseEvent | undefined,
  setTheme: (t: string) => void,
  next: string,
) {
  if (typeof document === "undefined") {
    setTheme(next);
    return;
  }
  const docAny = document as Document & { startViewTransition?: StartViewTransition };
  if (typeof docAny.startViewTransition !== "function") {
    setTheme(next);
    return;
  }

  // Anchor the reveal circle to the click point.
  if (e) {
    const root = document.documentElement;
    root.style.setProperty("--click-x", `${e.clientX}px`);
    root.style.setProperty("--click-y", `${e.clientY}px`);
  }

  docAny.startViewTransition(() => {
    setTheme(next);
  });
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9" aria-label="Toggle theme">
          <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={(e) => setThemeWithTransition(e, setTheme, "light")}
          className="gap-2"
        >
          <Sun className="size-4" /> Light
          {theme === "light" && <span className="ml-auto text-xs text-muted-foreground">·</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => setThemeWithTransition(e, setTheme, "dark")}
          className="gap-2"
        >
          <Moon className="size-4" /> Dark
          {theme === "dark" && <span className="ml-auto text-xs text-muted-foreground">·</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => setThemeWithTransition(e, setTheme, "system")}
          className="gap-2"
        >
          <Monitor className="size-4" /> System
          {theme === "system" && <span className="ml-auto text-xs text-muted-foreground">·</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
