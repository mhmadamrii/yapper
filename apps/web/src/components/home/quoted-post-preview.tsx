import { imageKitUrl } from '@/lib/imagekit';
import { UserAvatar } from '@/components/user-avatar';
import { MentionText } from '@/components/mention-text';
import { Show } from '@/components/control-flow';
import { timeAgo } from '@/lib/utils';

// Structural, not tied to one router shape — anywhere a post's `quotedPost`
// relation is embedded fits this.
export interface QuotedPostTarget {
  id: string;
  content: string;
  createdAt: string | Date;
  author: {
    name: string;
    username: string | null;
    image: string | null;
  };
  media: Array<{
    id: string;
    filePath: string;
    altText: string | null;
  }>;
}

/**
 * The embedded card for a quote post — reused both as the read-only preview
 * shown while composing a quote and as the clickable embed rendered inside
 * a quote post's card. Pass `onClick` to make it interactive.
 */
export function QuotedPostPreview({
  post,
  onClick,
}: {
  post: QuotedPostTarget;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={(e) => {
        if (!onClick) return;
        // Prevents the outer PostCard's navigate-to-detail from also
        // firing for the wrapping post when the embed is clicked.
        e.stopPropagation();
        onClick();
      }}
      className={`border-border mt-3 rounded-lg border p-3 ${
        onClick ? 'hover:bg-accent/30 cursor-pointer transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm">
        <UserAvatar
          name={post.author.name}
          image={post.author.image}
          className="size-5"
        />
        <span className="truncate font-bold">{post.author.name}</span>
        <span className="text-muted-foreground truncate">
          @{post.author.username ?? 'unknown'}
        </span>
        <span className="text-muted-foreground shrink-0">
          · {timeAgo(post.createdAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-4 text-[15px] whitespace-pre-wrap">
        <MentionText text={post.content} />
      </p>
      <Show when={post.media[0]}>
        {(m) => (
          <img
            src={imageKitUrl(m.filePath, 'w-800,f-auto,q-auto')}
            alt={m.altText ?? ''}
            className="border-border mt-2 max-h-72 w-full rounded-xl border object-cover"
          />
        )}
      </Show>
    </div>
  );
}
