import { Skeleton } from '@yapper/ui/components/skeleton';
import { For } from '@/components/control-flow';

export function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <For each={Array.from({ length: 4 }, (_, i) => i)}>
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
