import { createFileRoute } from '@tanstack/react-router';
import { MessageCircle, Plus } from 'lucide-react';
import { Button } from '@yapper/ui/components/button';
import { seo } from '@/lib/seo';
import { DialogNewChat } from './-components/dialog-new-chat';

import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@yapper/ui/components/empty';

export const Route = createFileRoute('/(yapper)/messages/')({
  head: () => ({ meta: seo({ title: 'Messages' }) }),
  component: MessagesIndexPage,
});

function MessagesIndexPage() {
  return (
    <Empty className="h-full min-h-svh border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircle />
        </EmptyMedia>
        <EmptyTitle>Say hi to someone</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <DialogNewChat
          trigger={
            <Button className="rounded-full px-5">
              <Plus />
              New chat
            </Button>
          }
        />
      </EmptyContent>
    </Empty>
  );
}
