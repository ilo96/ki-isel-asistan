import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <Skeleton className="mb-5 h-6 w-32" />
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Ana sayfanın birebir iskeleti (plan: Ekran durumları > Loading). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy aria-label="Yükleniyor">
      <section className="space-y-4 pt-2">
        <Skeleton className="h-9 w-56" />
        <div className="flex gap-4 rounded-card border border-border/60 bg-surface p-5 dark:border-transparent">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="min-h-32 space-y-6 rounded-card border border-border/60 bg-surface p-5 dark:border-transparent"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-7">
          <ListSkeleton rows={5} />
        </div>
        <div className="lg:col-span-5">
          <ListSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
