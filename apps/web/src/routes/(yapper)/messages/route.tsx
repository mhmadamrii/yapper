import { createFileRoute, Outlet, useParams } from '@tanstack/react-router';
import { cn } from '@yapper/ui/lib/utils';
import { requireSession } from '@/lib/route-guards';
import { ConversationListPane } from './-components/conversation-list-pane';

export const Route = createFileRoute('/(yapper)/messages')({
  pendingMinMs: 0,
  beforeLoad: ({ context }) => requireSession(context),
  component: RouteComponent,
});

function RouteComponent() {
  const { conversationId } = useParams({ strict: false });
  const hasConversation = !!conversationId;

  // Below md: master-detail — show only the list, or only the open thread.
  return (
    <div className="border-border flex min-h-svh w-full max-w-[900px] border-x">
      <ConversationListPane
        className={cn(hasConversation && 'hidden md:flex')}
      />
      <div
        className={cn(
          'border-border min-w-0 flex-1 md:border-l',
          !hasConversation && 'hidden md:block',
        )}
      >
        <Outlet />
      </div>
    </div>
  );
}
