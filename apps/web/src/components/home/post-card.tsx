import { imageKitUrl } from '@/lib/imagekit';
import { formatCount, timeAgo } from '@/lib/utils';
import {
  Bookmark,
  Ellipsis,
  Heart,
  MessageCircle,
  Repeat2,
  Share,
} from 'lucide-react';

import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

export type PostListItem =
  inferRouterOutputs<AppRouter>['post']['list']['items'][number];

export function PostCard({ post }: { post: PostListItem }) {
  const handle = post.author.username ?? 'unknown';

  return (
    <article className="border-border hover:bg-accent/30 border-b px-4 py-3 transition-colors">
      <div className="flex gap-3">
        <img
          src={post.author.image ?? '/prabowo.jpg'}
          alt={post.author.name}
          className="size-10 shrink-0 rounded-full object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1 text-sm">
            <span className="truncate font-bold">{post.author.name}</span>
            <span className="text-muted-foreground truncate">@{handle}</span>
            <span className="text-muted-foreground">
              · {timeAgo(post.createdAt)}
            </span>
          </div>

          <p className="mt-0.5 text-[15px] leading-normal whitespace-pre-wrap">
            {post.content}
          </p>

          {post.media.length > 0 && (
            <div
              className={
                post.media.length === 1
                  ? 'mt-3'
                  : 'mt-3 grid grid-cols-2 gap-1.5'
              }
            >
              {post.media.map((m) => (
                <img
                  key={m.id}
                  src={imageKitUrl(m.filePath, 'w-1200,f-auto,q-auto')}
                  alt={m.altText ?? ''}
                  width={m.width}
                  height={m.height}
                  loading="lazy"
                  className="border-border max-h-[420px] w-full rounded-xl border object-cover"
                />
              ))}
            </div>
          )}

          <div className="text-muted-foreground mt-3 flex items-center justify-between pr-8 text-sm">
            <button className="hover:text-foreground flex items-center gap-1.5 transition-colors">
              <MessageCircle className="size-4" />
              {formatCount(post.replyCount)}
            </button>
            <button className="flex items-center gap-1.5 transition-colors hover:text-green-500">
              <Repeat2 className="size-4" />
              {formatCount(post.repostCount)}
            </button>
            <button className="flex items-center gap-1.5 transition-colors hover:text-red-500">
              <Heart className="size-4" />
              {formatCount(post.likeCount)}
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
