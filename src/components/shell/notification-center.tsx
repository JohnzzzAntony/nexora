"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BellOff, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeInternalUrl } from "@/components/shell/api";
import { NotificationRow } from "@/components/shell/notification-item";
import { useMarkRead, useNotificationList, useUnreadCount, type NotificationItem } from "@/components/shell/use-notifications";

export function NotificationCenter() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const list = useNotificationList(filter);
  const { data: unread = 0 } = useUnreadCount();
  const markRead = useMarkRead();
  const items = list.data?.pages.flatMap(p => p.items) ?? [];

  const open = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate({ ids: [item.id] });
    const href = safeInternalUrl(item.url);
    if (href) router.push(href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={v => setFilter(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unread > 0 && (
                <span className="bg-primary/10 text-primary rounded px-1.5 text-[11px] font-semibold tabular-nums">{unread > 99 ? "99+" : unread}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" disabled={unread === 0 || markRead.isPending} onClick={() => markRead.mutate({ all: true })}>
          {markRead.isPending ? <Loader2 className="animate-spin" /> : <CheckCheck />}
          Mark all as read
        </Button>
      </div>

      {list.isPending ? (
        <div className="bg-card divide-y rounded-lg border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <ErrorState description="Notifications could not be loaded." onRetry={() => list.refetch()} retrying={list.isFetching} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
          description={
            filter === "unread"
              ? "You're all caught up."
              : "When someone assigns you work, mentions you or updates something you follow, it will show up here."
          }
        />
      ) : (
        <>
          <div className="bg-card divide-y overflow-hidden rounded-lg border shadow-xs">
            {items.map(item => (
              <NotificationRow key={item.id} item={item} onOpen={open} onMarkRead={i => markRead.mutate({ ids: [i.id] })} />
            ))}
          </div>
          {list.hasNextPage && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage && <Loader2 className="animate-spin" />}
                Load more
              </Button>
            </div>
          )}
          {list.isFetchNextPageError && <p className="text-destructive text-center text-sm">Could not load more notifications.</p>}
        </>
      )}
    </div>
  );
}
