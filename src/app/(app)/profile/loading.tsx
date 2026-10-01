import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6" aria-busy="true" aria-label="Loading profile">
      <div className="space-y-2 pb-5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-[28rem] max-w-full" />
      <div className="space-y-4 rounded-xl border p-6">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    </div>
  );
}
