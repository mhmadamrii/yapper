import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireSession } from '@/lib/route-guards';
import { ConversationListPane } from './-components/conversation-list-pane';

export const Route = createFileRoute('/(yapper)/messages')({
  pendingMinMs: 0,
  beforeLoad: () => requireSession(),
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="border-border flex min-h-svh w-full max-w-[900px] border-x">
      <ConversationListPane />
      <div className="border-border min-w-0 flex-1 border-l">
        <Outlet />
      </div>
    </div>
  );
}
