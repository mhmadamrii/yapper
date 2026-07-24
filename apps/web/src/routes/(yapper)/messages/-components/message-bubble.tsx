import { Bubble, BubbleContent } from '@yapper/ui/components/bubble';

import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from '@yapper/ui/components/message';

import { UserAvatar } from '@/components/user-avatar';
import { timeAgo } from '@/lib/utils';

import type { AppRouter } from '@yapper/api/routers/index';
import type { inferRouterOutputs } from '@trpc/server';

type MessageItem =
  inferRouterOutputs<AppRouter>['message']['thread']['items'][number];

export function MessageBubble({
  message,
  isOwn,
}: {
  message: MessageItem;
  isOwn: boolean;
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
          <BubbleContent>{message.body}</BubbleContent>
        </Bubble>
        <MessageFooter>{timeAgo(message.createdAt)}</MessageFooter>
      </MessageContent>
    </Message>
  );
}
