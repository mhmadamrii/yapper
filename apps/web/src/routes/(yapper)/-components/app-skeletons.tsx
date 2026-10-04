import { Skeleton } from '@yapper/ui/components/skeleton';
import { For } from '@/components/control-flow';

// Mirrors `CommunityRow`: cover, name/description/members, join button.
export function CommunityListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      <For each={Array.from({ length: count }, (_, i) => i)}>
        {(i) => (
          <div
            key={i}
            className="border-border flex items-center gap-3 border-b px-4 py-3"
          >
            <Skeleton className="size-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16 shrink-0 rounded-full" />
          </div>
        )}
      </For>
    </div>
  );
}

export function FeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <For each={Array.from({ length: count }, (_, i) => i)}>
        {(i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
