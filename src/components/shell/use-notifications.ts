"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "@/components/shell/api";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: ["notifications", "unread-count"] as const,
  latest: ["notifications", "latest"] as const,
  list: (filter: "all" | "unread") => ["notifications", "list", filter] as const,
};

/** Unread count, polled every 30s and on window focus (realtime fallback). */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: async ({ signal }) => (await apiFetch<{ count: number }>("/api/v1/notifications/unread-count", { signal })).data.count,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

export function useLatestNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.latest,
    queryFn: async ({ signal }) => (await apiFetch<NotificationItem[]>("/api/v1/notifications?limit=10", { signal })).data,
    enabled,
    staleTime: 5_000,
  });
}

export function useNotificationList(filter: "all" | "unread") {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "20" });
      if (filter === "unread") params.set("unread", "1");
      if (pageParam) params.set("cursor", pageParam);
      const res = await apiFetch<NotificationItem[]>(`/api/v1/notifications?${params}`, { signal });
      return { items: res.data, nextCursor: (res.meta?.nextCursor as string | null | undefined) ?? null };
    },
    getNextPageParam: last => last.nextCursor,
    refetchOnWindowFocus: true,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ids: string[] } | { all: true }) =>
      (await apiFetch<{ updated: number }>("/api/v1/notifications/read", { method: "POST", json: input })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
    onError: (e: Error) => toast.error(e.message || "Could not update notifications"),
  });
}
