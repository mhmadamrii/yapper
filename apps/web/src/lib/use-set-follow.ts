import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';
import { useSession } from '@/hooks/use-session';
import { useTRPC } from '@/utils/trpc';

interface ProfileShape {
  id: string;
  followerCount: number;
  followedByMe: boolean;
}

interface PostShape {
  author: { id: string; followedByMe?: boolean };
}

interface RecommendationShape {
  user: { id: string };
  followedByMe: boolean;
}

/**
 * Optimistic follow/unfollow: updates every cached `user.byId` profile
 * (flag + follower count), `post.byId` author, and `recommendation.follows`
 * card immediately, rolls back on error, and re-syncs with the server on
 * settle.
 */
export function useSetFollow() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const mutation = useMutation(
    trpc.user.setFollow.mutationOptions({
      onMutate: async ({ userId, followed }) => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: trpc.user.byId.queryKey() }),
          queryClient.cancelQueries({ queryKey: trpc.post.byId.queryKey() }),
          queryClient.cancelQueries({
            queryKey: trpc.recommendation.follows.queryKey(),
          }),
        ]);
        const snapshots = [
          ...queryClient.getQueriesData({
            queryKey: trpc.user.byId.queryKey(),
          }),
          ...queryClient.getQueriesData({
            queryKey: trpc.post.byId.queryKey(),
          }),
          ...queryClient.getQueriesData({
            queryKey: trpc.recommendation.follows.queryKey(),
          }),
        ];

        queryClient.setQueriesData(
          { queryKey: trpc.user.byId.queryKey() },
          (old: unknown) => {
            if (!old) return old;
            const data = old as ProfileShape;
            if (data.id !== userId || data.followedByMe === followed) {
              return old;
            }
            return {
              ...data,
              followedByMe: followed,
              followerCount: Math.max(
                0,
                data.followerCount + (followed ? 1 : -1),
              ),
            };
          },
        );

        queryClient.setQueriesData(
          { queryKey: trpc.post.byId.queryKey() },
          (old: unknown) => {
            if (!old) return old;
            const data = old as PostShape;
            if (
              data.author.id !== userId ||
              data.author.followedByMe === followed
            ) {
              return old;
            }
            return {
              ...data,
              author: { ...data.author, followedByMe: followed },
            };
          },
        );

        // The suggestion card flips to "Following" in place rather than
        // vanishing — pulling the card out from under the cursor reflows the
        // other two mid-click.
        queryClient.setQueriesData(
          { queryKey: trpc.recommendation.follows.queryKey() },
          (old: unknown) => {
            if (!Array.isArray(old)) return old;
            const list = old as RecommendationShape[];
            if (!list.some((rec) => rec.user.id === userId)) return old;
            return list.map((rec) =>
              rec.user.id === userId ? { ...rec, followedByMe: followed } : rec,
            );
          },
        );

        return { snapshots };
      },
      onError: (_error, _vars, context) => {
        context?.snapshots.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
        toast.error('Could not update follow');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.user.byId.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.post.byId.queryKey() });
      },
    }),
  );

  return (userId: string, followed: boolean) => {
    if (!session) {
      toast.error('Sign in to follow people');
      return;
    }
    if (session.user.id === userId) return;
    mutation.mutate({ userId, followed });
  };
}
