import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useTRPC } from '@/utils/trpc';

interface PostShape {
  id: string;
}

function removeFromInfinite(old: unknown, postId: string) {
  if (!old) return old;
  const data = old as {
    pages: Array<{ items: PostShape[]; nextCursor: unknown }>;
    pageParams: unknown[];
  };
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== postId),
    })),
  };
}

/**
 * Optimistic delete: removes the post from every cached `post.list` /
 * `post.byUser` / `post.saved` page immediately, rolls back on error, and
 * re-syncs with the server on settle.
 */
export function useDeletePost() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    trpc.post.delete.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: trpc.post.pathKey() });
        const snapshots = queryClient.getQueriesData({
          queryKey: trpc.post.pathKey(),
        });

        queryClient.setQueriesData(
          { queryKey: trpc.post.list.infiniteQueryKey() },
          (old: unknown) => removeFromInfinite(old, id),
        );
        queryClient.setQueriesData(
          { queryKey: trpc.post.byUser.infiniteQueryKey() },
          (old: unknown) => removeFromInfinite(old, id),
        );
        queryClient.setQueriesData(
          { queryKey: trpc.post.saved.infiniteQueryKey() },
          (old: unknown) => removeFromInfinite(old, id),
        );

        return { snapshots };
      },
      onError: (_error, _vars, context) => {
        context?.snapshots.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
        toast.error('Could not delete post');
      },
      onSuccess: () => {
        toast.success('Post deleted');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });
      },
    }),
  );

  return (postId: string) => mutation.mutateAsync({ id: postId });
}
