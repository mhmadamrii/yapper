import { Bubble, BubbleContent } from '@yapper/ui/components/bubble';
import { UserAvatar } from '@/components/user-avatar';
import { Match, Switch } from '@/components/control-flow';
import { timeAgo } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';

import type { ThreadMessage } from '@/lib/use-send-message';

import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@yapper/ui/components/message';

export function MessageBubble({
  message,
  isOwn,
  onRetry,
}: {
  message: ThreadMessage;
  isOwn: boolean;
  onRetry?: (message: ThreadMessage) => void;
}) {
  const align = isOwn ? 'end' : 'start';

  return (
    <Message align={align}>
      <MessageAvatar>
        <UserAvatar
          name={message.sender.name}
          image={message.sender.image}
          className="size-8"
        />
      </MessageAvatar>
      <MessageContent>
        <Bubble align={align} variant={isOwn ? 'default' : 'secondary'}>
          <BubbleContent>
            {message.body}
            <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] opacity-70 select-none">
              <Switch
                fallback={
                  <>
                    <span>{timeAgo(message.createdAt)}</span>
                    {isOwn ? (
                      <>
                        <span>·</span>
                        <CheckCheck className="size-3.5" aria-label="Sent" />
                      </>
                    ) : null}
                  </>
                }
              >
                <Match when={message.status === 'failed'}>
                  <span className="font-semibold">Not sent</span>
                  <span>·</span>
                  <button
                    onClick={() => onRetry?.(message)}
                    className="font-semibold underline"
                  >
                    Retry
                  </button>
                </Match>
                <Match when={message.status === 'sending'}>
                  <span>{timeAgo(message.createdAt)}</span>
                  <span>·</span>
                  <Check className="size-3.5" aria-label="Sending" />
                </Match>
              </Switch>
            </span>
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
