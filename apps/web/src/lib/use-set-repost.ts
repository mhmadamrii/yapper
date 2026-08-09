import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { useSession } from '@/hooks/use-session';
import { useTRPC } from '@/utils/trpc';

interface RepostShape {
  id: string;
  repostCount: number;
  repostedByMe: boolean;
}

function applyRepost<T extends RepostShape>(
  item: T,
  postId: string,
  reposted: boolean,
): T {
  if (item.id !== postId || item.repostedByMe === reposted) return item;
  return {
    ...item,
    repostedByMe: reposted,
    repostCount: Math.max(0, item.repostCount + (reposted ? 1 : -1)),
  };
}

/**
 * Optimistic repost/unrepost: updates every cached `post.list` / `post.saved`
 * page and `post.byId` result (including replies) immediately, rolls all of
 * them back on error, and re-syncs with the server on settle.
 */
export function useSetRepost() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const mutation = useMutation(
    trpc.post.setRepost.mutationOptions({
      onMutate: async ({ postId, reposted }) => {
        await queryClient.cancelQueries({ queryKey: trpc.post.pathKey() });
        const snapshots = queryClient.getQueriesData({
          queryKey: trpc.post.pathKey(),
        });

        const applyToInfinite = (old: unknown) => {
          if (!old) return old;
          const data = old as {
            pages: Array<{ items: RepostShape[]; nextCursor: unknown }>;
            pageParams: unknown[];
          };
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                applyRepost(item, postId, reposted),
              ),
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
            const data = old as RepostShape & { replies: RepostShape[] };
            return {
              ...applyRepost(data, postId, reposted),
              replies: data.replies.map((reply) =>
                applyRepost(reply, postId, reposted),
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
        toast.error('Could not update repost');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });
      },
    }),
  );

  return (postId: string, reposted: boolean) => {
    if (!session) {
      toast.error('Sign in to repost');
      return;
    }
    mutation.mutate({ postId, reposted });
  };
}
