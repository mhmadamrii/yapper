import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/utils/trpc';

interface LikeShape {
  id: string;
  likeCount: number;
  likedByMe: boolean;
}

function applyLike<T extends LikeShape>(
  item: T,
  postId: string,
  liked: boolean,
): T {
  if (item.id !== postId || item.likedByMe === liked) return item;
  return {
    ...item,
    likedByMe: liked,
    likeCount: Math.max(0, item.likeCount + (liked ? 1 : -1)),
  };
}

/**
 * Optimistic like/unlike: updates every cached `post.list` / `post.saved`
 * page and `post.byId` result (including replies) immediately, rolls all of
 * them back on error, and re-syncs with the server on settle.
 */
export function useSetLike() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const mutation = useMutation(
    trpc.post.setLike.mutationOptions({
      onMutate: async ({ postId, liked }) => {
        await queryClient.cancelQueries({ queryKey: trpc.post.pathKey() });
        const snapshots = queryClient.getQueriesData({
          queryKey: trpc.post.pathKey(),
        });

        const applyToInfinite = (old: unknown) => {
          if (!old) return old;
          const data = old as {
            pages: Array<{ items: LikeShape[]; nextCursor: unknown }>;
            pageParams: unknown[];
          };
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => applyLike(item, postId, liked)),
            })),
          };
        };

        queryClient.setQueriesData(
          { queryKey: trpc.post.list.infiniteQueryKey() },
          applyToInfinite,
        );
        queryClient.setQueriesData(
          { queryKey: trpc.post.saved.infiniteQueryKey() },
          applyToInfinite,
        );

        queryClient.setQueriesData(
          { queryKey: trpc.post.byId.queryKey() },
          (old: unknown) => {
            if (!old) return old;
            const data = old as LikeShape & { replies: LikeShape[] };
            return {
              ...applyLike(data, postId, liked),
              replies: data.replies.map((reply) =>
                applyLike(reply, postId, liked),
              ),
            };
          },
        );

        return { snapshots };
      },
      onError: (_error, _vars, context) => {
        context?.snapshots.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
        toast.error('Could not update like');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });
      },
    }),
  );

  return (postId: string, liked: boolean) => {
    if (!session) {
      toast.error('Sign in to like posts');
      return;
    }
    mutation.mutate({ postId, liked });
  };
}
