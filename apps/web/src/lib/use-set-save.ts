import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/lib/toast';

import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/utils/trpc';

interface SaveShape {
  id: string;
  savedByMe: boolean;
}

function applySave<T extends SaveShape>(
  item: T,
  postId: string,
  saved: boolean,
): T {
  if (item.id !== postId || item.savedByMe === saved) return item;
  return { ...item, savedByMe: saved };
}

/**
 * Optimistic save/unsave (bookmark): updates every cached `post.list` /
 * `post.saved` page and `post.byId` result (including replies) immediately,
 * rolls back on error, and re-syncs with the server on settle.
 */
export function useSetSave() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();

  const mutation = useMutation(
    trpc.post.setSave.mutationOptions({
      onMutate: async ({ postId, saved }) => {
        await queryClient.cancelQueries({ queryKey: trpc.post.pathKey() });
        const snapshots = queryClient.getQueriesData({
          queryKey: trpc.post.pathKey(),
        });

        const applyToInfinite = (old: unknown) => {
          if (!old) return old;
          const data = old as {
            pages: Array<{ items: SaveShape[]; nextCursor: unknown }>;
            pageParams: unknown[];
          };
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => applySave(item, postId, saved)),
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
            const data = old as SaveShape & { replies: SaveShape[] };
            return {
              ...applySave(data, postId, saved),
              replies: data.replies.map((reply) =>
                applySave(reply, postId, saved),
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
        toast.error('Could not update save');
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: trpc.post.pathKey() });
      },
    }),
  );

  return (postId: string, saved: boolean) => {
    if (!session) {
      toast.error('Sign in to save posts');
      return;
    }
    mutation.mutate({ postId, saved });
  };
}
