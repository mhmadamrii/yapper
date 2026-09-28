import { cn } from '@yapper/ui/lib/utils';
import { For } from '@/components/control-flow';

export interface InterestOption {
  slug: string;
  name: string;
}

export function InterestPillGrid({
  interests,
  selected,
  onToggle,
}: {
  interests: InterestOption[];
  selected: Set<string>;
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <For each={interests}>
        {(option) => (
          <button
            key={option.slug}
            onClick={() => onToggle(option.slug)}
            className={cn(
              'rounded-full px-5 py-3 font-semibold transition-colors',
              selected.has(option.slug)
                ? 'bg-foreground text-background'
                : 'bg-accent text-foreground hover:bg-accent/70',
            )}
          >
            {option.name}
          </button>
        )}
      </For>
    </div>
  );
}
