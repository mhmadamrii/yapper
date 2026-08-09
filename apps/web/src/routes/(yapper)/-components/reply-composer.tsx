import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { toast } from '@/lib/toast';
import { Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { useSession } from '@/hooks/use-session';
import { useTRPC } from '@/utils/trpc';

const MAX_POST_LENGTH = 300;

export function ReplyComposer({ postId }: { postId: string }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createReply = useMutation(
    trpc.post.create.mutationOptions({
      onSuccess: async () => {
        setText('');
        await queryClient.invalidateQueries({
          queryKey: trpc.post.pathKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || 'Could not send reply');
      },
    }),
  );

  const canReply =
    !createReply.isPending &&
    text.trim().length > 0 &&
    text.length <= MAX_POST_LENGTH;

  return (
    <Show when={session}>
      {(s) => (
        <div className="border-border flex gap-3 border-b px-4 py-3">
          <UserAvatar
            name={s.user.name}
            image={s.user.image}
            className="size-9 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <textarea
              value={text}
              onFocus={() => setFocused(true)}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write your reply"
              rows={focused || text ? 3 : 1}
              className="placeholder:text-muted-foreground w-full resize-none bg-transparent pt-1.5 outline-none"
            />
            <Show when={focused || text}>
              <div className="flex items-center justify-end gap-3">
                <span
                  className={
                    text.length > MAX_POST_LENGTH
                      ? 'text-destructive text-sm'
                      : 'text-muted-foreground text-sm'
                  }
                >
                  {MAX_POST_LENGTH - text.length}
                </span>
                <Button
                  size="sm"
                  className="rounded-full px-5"
                  disabled={!canReply}
                  onClick={() =>
                    createReply.mutate({
                      content: text.trim(),
                      replyToPostId: postId,
                    })
                  }
                >
                  {createReply.isPending ? 'Replying...' : 'Reply'}
                </Button>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
