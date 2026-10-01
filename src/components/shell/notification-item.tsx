"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/components/shell/use-notifications";

export function relativeTime(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function NotificationRow({
  item,
  onOpen,
  onMarkRead,
  compact,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
  onMarkRead: (item: NotificationItem) => void;
  compact?: boolean;
}) {
  const unread = !item.readAt;
  return (
    <div className={cn("group hover:bg-accent/60 relative flex items-start gap-3 transition-colors", compact ? "px-3 py-2.5" : "px-4 py-3")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")} aria-hidden />
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="focus-visible:ring-ring/40 min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-[3px]"
      >
        <span className={cn("block text-sm", unread ? "font-medium" : "text-foreground/80")}>
          {item.title}
          {unread && <span className="sr-only"> (unread)</span>}
        </span>
        {item.body && <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-[13px]">{item.body}</span>}
        <time dateTime={item.createdAt} className="text-muted-foreground mt-1 block text-xs">
          {relativeTime(item.createdAt)}
        </time>
      </button>
      {unread && (
        <button
          type="button"
          onClick={() => onMarkRead(item)}
          className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring/40 flex size-7 shrink-0 items-center justify-center rounded-md opacity-0 outline-none group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px]"
          aria-label={`Mark "${item.title}" as read`}
          title="Mark as read"
        >
          <Check className="size-4" />
        </button>
      )}
    </div>
  );
}
