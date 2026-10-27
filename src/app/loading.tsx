import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="데이터를 불러오는 중" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="bg-card grid gap-6 rounded-xl border p-6 md:grid-cols-2">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="aspect-[2/1] w-full max-w-[360px] rounded-t-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-16 w-28" />
        </div>
        <div className="flex flex-col justify-center gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
      <Skeleton className="mt-8 h-6 w-64" />
      <Skeleton className="h-[440px] w-full rounded-xl" />
      <Skeleton className="mt-8 h-6 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
