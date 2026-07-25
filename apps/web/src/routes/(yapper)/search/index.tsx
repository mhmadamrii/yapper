import { createFileRoute, Link } from '@tanstack/react-router';
import { Input } from '@yapper/ui/components/input';
import { Flame, LayoutGrid, Search, X } from 'lucide-react';
import { useState } from 'react';

import { For, Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { seo } from '@/lib/seo';
import { interestTags, trendingExplore } from './-dummy-explore';

export const Route = createFileRoute('/(yapper)/search/')({
  head: () => ({ meta: seo({ title: 'Explore' }) }),
  component: ExplorePage,
});

function ExplorePage() {
  const [showInterests, setShowInterests] = useState(true);

  return (
    <main className="border-border w-full max-w-[640px] border-x">
      <div className="p-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input placeholder="Search" className="rounded-full pl-9" />
        </div>
      </div>

      <Show when={showInterests}>
        <div className="border-border border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold">
              <LayoutGrid className="text-primary size-5" />
              Your interests
            </div>
            <button
              aria-label="Dismiss"
              onClick={() => setShowInterests(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <For each={interestTags}>
              {(tag) => (
                <span
                  key={tag}
                  className="bg-accent rounded-full px-4 py-2 text-sm font-medium"
                >
                  {tag}
                </span>
              )}
            </For>
          </div>

          <p className="text-muted-foreground mt-3 text-sm">
            Your interests help us find what you like!
          </p>

          <Link
            to="/search/interest"
            className="bg-primary text-primary-foreground mt-4 block w-full rounded-full py-2.5 text-center font-semibold"
          >
            Edit interests
          </Link>
        </div>
      </Show>

      <For each={trendingExplore}>
        {(item, index) => (
          <div
            key={item.id}
            className="border-border flex items-center justify-between gap-4 border-b p-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground w-5 text-lg font-bold">
                {index + 1}.
              </span>
              <div>
                <p className="font-bold">{item.title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <For each={item.avatarNames}>
                      {(name) => (
                        <UserAvatar
                          key={name}
                          name={name}
                          className="ring-background size-6 ring-2"
                        />
                      )}
                    </For>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {item.category}
                  </span>
                </div>
              </div>
            </div>

            <Show
              when={item.badge.kind === 'hot'}
              fallback={
                <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-3 py-1.5 text-sm font-medium">
                  {item.badge.kind === 'time' ? item.badge.label : null}
                </span>
              }
            >
              <span className="bg-destructive/10 text-destructive flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium">
                <Flame className="size-4" />
                Hot
              </span>
            </Show>
          </div>
        )}
      </For>
    </main>
  );
}
