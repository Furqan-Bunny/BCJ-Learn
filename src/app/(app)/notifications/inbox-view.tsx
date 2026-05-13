"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Trophy,
  AlertTriangle,
  Mail,
  Sparkles,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/server/notification-actions";
import type { NotificationItem, NotificationKind } from "@/types";

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ className?: string }>> = {
  invitation: Mail,
  reminder: Bell,
  result: Trophy,
  alert: AlertTriangle,
};

const KIND_TONE: Record<NotificationKind, string> = {
  invitation: "text-sky-500 bg-sky-500/10",
  reminder: "text-amber-500 bg-amber-500/10",
  result: "text-emerald-500 bg-emerald-500/10",
  alert: "text-rose-500 bg-rose-500/10",
};

const FILTERS: { id: "all" | "unread" | NotificationKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "result", label: "Results" },
  { id: "reminder", label: "Reminders" },
  { id: "alert", label: "Alerts" },
  { id: "invitation", label: "Invitations" },
];

interface NotificationsInboxViewProps {
  items: NotificationItem[];
  initialUnreadCount: number;
}

export function NotificationsInboxView({ items: initial, initialUnreadCount }: NotificationsInboxViewProps) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("all");

  const filtered = items.filter((i) => {
    if (filter === "all") return true;
    if (filter === "unread") return !i.opened;
    return i.kind === filter;
  });

  async function handleClickItem(item: NotificationItem) {
    if (!item.opened) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, opened: true } : i)));
      setUnreadCount((c) => Math.max(0, c - 1));
      void markNotificationRead(item.id);
    }
    if (item.href) router.push(item.href);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((i) => ({ ...i, opened: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Button
                key={f.id}
                variant={active ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {f.id === "unread" && unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] font-mono">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
          <CheckCheck className="size-4 mr-1.5" /> Mark all read
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center text-muted-foreground">
            <div className="size-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <Sparkles className="size-6" />
            </div>
            <p className="font-medium">No notifications here</p>
            <p className="text-sm mt-1">
              {filter === "unread"
                ? "You're all caught up."
                : "Anything sent to you will land here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleClickItem(item)}
                  className={cn(
                    "w-full text-left rounded-lg border bg-card hover:bg-accent/50 transition-colors px-4 py-3 flex gap-3",
                    !item.opened && "bg-primary/[0.04] border-primary/30",
                  )}
                >
                  <div
                    className={cn(
                      "size-10 rounded-md flex items-center justify-center shrink-0",
                      KIND_TONE[item.kind],
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          item.opened ? "text-foreground/90" : "font-semibold",
                        )}
                      >
                        {item.subject}
                      </p>
                      <Badge variant="outline" className="text-[10px] capitalize font-mono">
                        {item.kind}
                      </Badge>
                      {!item.opened && (
                        <span className="size-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {item.preview}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-1.5">
                      {fmtRelative(item.sentAt)}
                    </p>
                  </div>
                  {item.href && (
                    <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
