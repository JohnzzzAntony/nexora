import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="bg-card overflow-hidden rounded-lg border">
        <div className="bg-muted/40 border-b px-4 py-3">
          <Skeleton className="h-3 w-1/3" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-24 sm:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
