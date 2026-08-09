import { Input } from '@yapper/ui/components/input';
import { Compass, ListFilter, Plus, Search, TrendingUp } from 'lucide-react';
import { trendingTopics } from './dummy-posts';
import { useSession } from '@/hooks/use-session';

export function SidebarRight() {
  const { data: session } = useSession();

  return (
    <aside className="sticky top-0 hidden h-svh w-80 flex-col gap-5 px-6 py-6 lg:flex">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input placeholder="Search" className="rounded-full pl-9" />
      </div>

      {session && (
        <div className="flex flex-col items-start gap-1">
          <button className="hover:bg-accent flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
            <Compass className="text-primary size-4" />
            Discover
          </button>
          <button className="bg-primary text-primary-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium">
            <ListFilter className="size-4" />
            Following
          </button>
          <button className="hover:bg-accent text-muted-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors">
            <Plus className="size-4" />
            More feeds
          </button>
        </div>
      )}

      <div className="border-border rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4" />
          Trending
        </div>
        <ol className="flex flex-col gap-2">
          {trendingTopics.map((topic, i) => (
            <li key={topic} className="flex gap-3 text-sm">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="font-medium">{topic}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 text-sm">
        {session && (
          <>
            <a href="#" className="hover:underline">
              Feedback
            </a>
            <span>·</span>
          </>
        )}
        <a href="#" className="hover:underline">
          Privacy
        </a>
        <span>·</span>
        <a href="#" className="hover:underline">
          Terms
        </a>
        <span>·</span>
        <a href="#" className="hover:underline">
          Help
        </a>
      </div>
    </aside>
  );
}
