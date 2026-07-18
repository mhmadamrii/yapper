import { useState } from 'react';
import { Bird, Hash, ImageIcon } from 'lucide-react';

import { dummyPosts } from './dummy-posts';
import { PostCard } from './post-card';
import { authClient } from '@/lib/auth-client';

export function Feed() {
  const { data: session } = authClient.useSession();

  const tabs = session ? ['Discover', 'Following'] : ['Discover', 'Feeds ✨'];
  const [activeTab, setActiveTab] = useState(0);

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        {session && (
          <div className="relative flex items-center justify-center py-3">
            <Bird className="text-primary size-7" />
            <Hash className="text-muted-foreground absolute right-4 size-5" />
          </div>
        )}
        <nav className="flex">
          {tabs.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className="hover:bg-accent/50 flex-1 py-3 text-sm font-semibold transition-colors"
            >
              <span
                className={
                  activeTab === i
                    ? 'border-primary border-b-2 pb-3'
                    : 'text-muted-foreground'
                }
              >
                {tab}
              </span>
            </button>
          ))}
        </nav>
      </header>

      {session && (
        <div className="border-border flex items-center gap-3 border-b px-4 py-3">
          <img
            src={session.user.image ?? '/prabowo.jpg'}
            alt={session.user.name}
            className="size-10 rounded-full object-cover"
          />
          <span className="text-muted-foreground flex-1 text-lg">
            What's up?
          </span>
          <ImageIcon className="text-muted-foreground size-5" />
        </div>
      )}

      <div>
        {dummyPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </main>
  );
}
