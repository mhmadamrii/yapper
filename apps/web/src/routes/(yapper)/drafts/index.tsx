import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { imageKitUrl } from '@/lib/imagekit';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { timeAgo } from '@/lib/utils';
import { useTRPC } from '@/utils/trpc';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { FileText, Send, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { For, Show } from '@/components/control-flow';
import { DialogCreatePost } from '@/routes/(yapper)/-components/dialog-create-post';

import {
  DialogCreateReply,
  type ReplyTarget,
} from '@/routes/(yapper)/-components/dialog-create-reply';

export const Route = createFileRoute('/(yapper)/drafts/')({
  beforeLoad: () => requireSession(),
  head: () => ({ meta: seo({ title: 'Drafts' }) }),
  component: DraftsPage,
});

function DraftsPage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const draftsQuery = useQuery(trpc.draft.list.queryOptions());
  const publishDraft = useMutation(trpc.draft.publish.mutationOptions());
  const deleteDraft = useMutation(trpc.draft.delete.mutationOptions());

  const invalidateDrafts = () => queryClient.invalidateQueries({ queryKey: trpc.draft.list.queryKey() }); // prettier-ignore

  const handlePublish = async (id: string) => {
    try {
      await publishDraft.mutateAsync({ id });
      await Promise.all([
        invalidateDrafts(),
        queryClient.invalidateQueries({
          queryKey: trpc.post.list.infiniteQueryKey(),
        }),
      ]);
      toast.success('Post published');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to publish draft',
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDraft.mutateAsync({ id });
      await invalidateDrafts();
      toast.success('Draft deleted');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete draft',
      );
    }
  };

  const drafts = draftsQuery.data ?? [];

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b px-4 py-3 backdrop-blur">
        <h1 className="font-bold">Drafts</h1>
      </header>

      <Show
        when={drafts.length > 0}
        fallback={
          <div className="px-8 py-16 text-center">
            <FileText className="text-muted-foreground mx-auto size-8" />
            <p className="mt-4 text-lg font-bold">No drafts yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Save a post for later from the compose dialog and it will show up
              here.
            </p>
          </div>
        }
      >
        <For each={drafts}>
          {(draft) => {
            const media = draft.media.map((m) => ({
              fileId: m.fileId,
              filePath: m.filePath,
              width: m.width,
              height: m.height,
              format: m.format,
              bytes: m.bytes,
              altText: m.altText ?? undefined,
            }));
            const initialDraft = {
              id: draft.id,
              content: draft.content,
              media,
            };
            const replyTarget: ReplyTarget | null = draft.replyTo
              ? {
                  id: draft.replyTo.id,
                  content: draft.replyTo.content,
                  author: {
                    name: draft.replyTo.author.name,
                    username: draft.replyTo.author.username,
                    image: draft.replyTo.author.image,
                  },
                  media: [],
                }
              : null;

            return (
              <div
                key={draft.id}
                className="border-border flex flex-col gap-2 border-b p-4"
              >
                <Show when={replyTarget}>
                  {(target) => (
                    <p className="text-muted-foreground text-sm">
                      Replying to @{target.author.username ?? 'unknown'}
                    </p>
                  )}
                </Show>

                <p className="text-[15px] whitespace-pre-wrap">
                  {draft.content || (
                    <span className="text-muted-foreground italic">
                      No text
                    </span>
                  )}
                </p>

                <Show when={draft.media.length > 0}>
                  <div className="flex gap-2">
                    <For each={draft.media}>
                      {(m) => (
                        <img
                          key={m.id}
                          src={imageKitUrl(m.filePath, 'w-200,f-auto,q-auto')}
                          alt={m.altText ?? ''}
                          className="border-border size-20 rounded-lg border object-cover"
                        />
                      )}
                    </For>
                  </div>
                </Show>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">
                    Edited {timeAgo(draft.updatedAt)}
                  </span>

                  <div className="flex items-center gap-1">
                    <Show
                      when={replyTarget}
                      fallback={
                        <DialogCreatePost
                          key={String(draft.updatedAt)}
                          initialDraft={initialDraft}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          }
                        />
                      }
                    >
                      {(target) => (
                        <DialogCreateReply
                          key={String(draft.updatedAt)}
                          post={target}
                          initialDraft={initialDraft}
                          trigger={
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          }
                        />
                      )}
                    </Show>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Publish now"
                      disabled={publishDraft.isPending}
                      onClick={() => handlePublish(draft.id)}
                    >
                      <Send className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Delete draft"
                      disabled={deleteDraft.isPending}
                      onClick={() => handleDelete(draft.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          }}
        </For>
      </Show>
    </main>
  );
}
