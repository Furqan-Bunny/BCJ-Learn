"use client";

// Personal notifications bell — sits in the topbar. Shows an unread count,
// opens a popover with the user's recent notifications, subscribes to Supabase
// Realtime for live inserts, marks rows read on click, and deep-links via the
// row's `href` column when present.

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Trophy,
  AlertTriangle,
  Sparkles,
  Mail,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/server/notification-actions";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { NotificationItem, NotificationKind } from "@/types";

interface NotificationsBellProps {
  userId: string;
  initialItems: NotificationItem[];
  initialUnreadCount: number;
}

interface RawNotificationRow {
  id: string;
  kind: NotificationKind;
  recipient_id: string;
  subject: string;
  preview: string;
  body: string | null;
  sent_at: string;
  opened: boolean;
  href: string | null;
}

function rowToItem(r: RawNotificationRow): NotificationItem {
  return {
    id: r.id,
    kind: r.kind,
    recipientId: r.recipient_id,
    subject: r.subject,
    preview: r.preview,
    body: r.body,
    sentAt: r.sent_at,
    opened: r.opened,
    href: r.href,
  };
}

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

export function NotificationsBell({
  userId,
  initialItems,
  initialUnreadCount,
}: NotificationsBellProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [items, setItems] = React.useState<NotificationItem[]>(initialItems);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [open, setOpen] = React.useState(false);

  // Realtime subscription — append new rows, bump count.
  React.useEffect(() => {
    if (!userId) return;
    const sb = createClient();
    const channel = sb
      .channel(`notifications-bell:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as RawNotificationRow;
          setItems((prev) => [rowToItem(row), ...prev].slice(0, 20));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [userId]);

  async function handleClickItem(item: NotificationItem) {
    setOpen(false);
    if (!item.opened) {
      // Optimistic UI
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, opened: true } : i)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      void markNotificationRead(item.id);
    }
    if (item.href) router.push(item.href);
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0) return;
    // Optimistic UI
    setItems((prev) => prev.map((i) => ({ ...i, opened: true })));
    setUnreadCount(0);
    await markAllNotificationsRead();
    router.refresh();
  }

  const badgeText = unreadCount > 9 ? "9+" : String(unreadCount);
  const showBadge = unreadCount > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 relative group"
          aria-label={`Notifications${showBadge ? ` — ${unreadCount} unread` : ""}`}
        >
          <Bell className="size-4 transition-transform group-hover:rotate-12" />
          {showBadge && (
            <motion.span
              key={badgeText}
              initial={reduced ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center tabular-nums shadow-sm ring-2 ring-background"
            >
              {badgeText}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[380px] p-0 max-h-[480px] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="size-3.5 mr-1" /> Mark all read
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-muted-foreground">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Sparkles className="size-5" />
              </div>
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs mt-1">New notifications will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y">
              <AnimatePresence initial={false}>
                {items.slice(0, 10).map((item) => {
                  const Icon = KIND_ICON[item.kind];
                  return (
                    <motion.li
                      key={item.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                    >
                      <button
                        type="button"
                        onClick={() => handleClickItem(item)}
                        className={cn(
                          "w-full text-left px-4 py-3 flex gap-3 hover:bg-accent/60 transition-colors",
                          !item.opened && "bg-primary/[0.04]",
                        )}
                      >
                        <div
                          className={cn(
                            "size-8 rounded-md flex items-center justify-center shrink-0",
                            KIND_TONE[item.kind],
                          )}
                        >
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "text-sm leading-snug line-clamp-1",
                                item.opened ? "text-foreground/90" : "font-semibold",
                              )}
                            >
                              {item.subject}
                            </p>
                            {!item.opened && (
                              <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.preview}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
                            {fmtRelative(item.sentAt)}
                          </p>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <div className="border-t px-2 py-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => setOpen(false)}
          >
            <Link href="/notifications">
              View all <ArrowRight className="size-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
