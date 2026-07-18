import {
  Bookmark,
  Ellipsis,
  Heart,
  MessageCircle,
  Repeat2,
  Share,
} from 'lucide-react';

import type { DummyPost } from './dummy-posts';

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n}`;
}

export function PostCard({ post }: { post: DummyPost }) {
  return (
    <article className="border-border hover:bg-accent/30 border-b px-4 py-3 transition-colors">
      {post.repostedBy && (
        <div className="text-muted-foreground mb-1 flex items-center gap-2 pl-10 text-sm">
          <Repeat2 className="size-4" />
          Reposted by {post.repostedBy}
        </div>
      )}

      <div className="flex gap-3">
        <img
          src={post.author.avatar}
          alt={post.author.name}
          className="size-10 shrink-0 rounded-full object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 text-sm">
            <span className="truncate font-bold">{post.author.name}</span>
            <span className="text-muted-foreground truncate">
              @{post.author.handle}
            </span>
            <span className="text-muted-foreground">· {post.createdAt}</span>
          </div>

          <p className="mt-0.5 text-[15px] leading-normal whitespace-pre-wrap">
            {post.text}
          </p>

          {post.image && (
            <img
              src={post.image}
              alt=""
              className="border-border mt-3 max-h-[420px] w-full rounded-xl border object-cover"
            />
          )}

          <div className="text-muted-foreground mt-3 flex items-center justify-between pr-8 text-sm">
            <button className="hover:text-foreground flex items-center gap-1.5 transition-colors">
              <MessageCircle className="size-4" />
              {formatCount(post.replies)}
            </button>
            <button className="flex items-center gap-1.5 transition-colors hover:text-green-500">
              <Repeat2 className="size-4" />
              {formatCount(post.reposts)}
            </button>
            <button className="flex items-center gap-1.5 transition-colors hover:text-red-500">
              <Heart className="size-4" />
              {formatCount(post.likes)}
            </button>
            <button className="hover:text-foreground transition-colors">
              <Bookmark className="size-4" />
            </button>
            <button className="hover:text-foreground transition-colors">
              <Share className="size-4" />
            </button>
            <button className="hover:text-foreground transition-colors">
              <Ellipsis className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
