import { createFileRoute, useRouter } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { cn } from '@yapper/ui/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { For } from '@/components/control-flow';
import { seo } from '@/lib/seo';
import { interestTags } from '../-dummy-explore';
import { allInterests } from './-dummy-interests';

export const Route = createFileRoute('/(yapper)/search/interest/')({
  head: () => ({ meta: seo({ title: 'Interests' }) }),
  component: InterestsPage,
});

function InterestsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(interestTags));

  function toggle(interest: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(interest)) {
        next.delete(interest);
      } else {
        next.add(interest);
      }
      return next;
    });
  }

  return (
    <main className="border-border w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center gap-4 border-b px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="font-bold">Your interests</h1>
      </header>

      <p className="text-muted-foreground border-border border-b p-4 text-sm">
        Your selected interests help us serve you content you care about.
      </p>

      <div className="flex flex-wrap gap-3 p-4">
        <For each={allInterests}>
          {(interest) => (
            <button
              key={interest}
              onClick={() => toggle(interest)}
              className={cn(
                'rounded-full px-5 py-3 font-semibold transition-colors',
                selected.has(interest)
                  ? 'bg-foreground text-background'
                  : 'bg-accent text-foreground hover:bg-accent/70',
              )}
            >
              {interest}
            </button>
          )}
        </For>
      </div>
    </main>
  );
}
