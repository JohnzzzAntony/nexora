"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { safeInternalUrl } from "@/components/shell/api";
import { NotificationRow } from "@/components/shell/notification-item";
import { useLatestNotifications, useMarkRead, useUnreadCount, type NotificationItem } from "@/components/shell/use-notifications";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { data: count = 0 } = useUnreadCount();
  const latest = useLatestNotifications(open);
  const markRead = useMarkRead();

  const openItem = async (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate({ ids: [item.id] });
    const href = safeInternalUrl(item.url);
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={count ? `Notifications, ${count} unread` : "Notifications"}>
          <Bell />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground ring-background absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ring-2">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            variant="ghost"
            size="xs"
            disabled={count === 0 || markRead.isPending}
            onClick={() => markRead.mutate({ all: true })}
          >
            {markRead.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
            Mark all read
          </Button>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {latest.isPending ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : latest.isError ? (
            <ErrorState size="sm" description="Notifications could not be loaded." onRetry={() => latest.refetch()} retrying={latest.isFetching} />
          ) : latest.data.length === 0 ? (
            <EmptyState size="sm" icon={BellOff} title="You're all caught up" description="New activity on your work will appear here." />
          ) : (
            <div className="divide-y">
              {latest.data.map(item => (
                <NotificationRow key={item.id} item={item} compact onOpen={openItem} onMarkRead={i => markRead.mutate({ ids: [i.id] })} />
              ))}
            </div>
          )}
        </div>
        <div className="border-t p-1">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="hover:bg-accent text-muted-foreground hover:text-foreground block rounded-md px-2 py-1.5 text-center text-[13px] font-medium"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
