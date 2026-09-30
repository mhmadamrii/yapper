import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { Show } from '@/components/control-flow';
import { cn } from '@yapper/ui/lib/utils';
import { SidebarLeft } from '@/components/home/sidebar-left';
import { SidebarRight } from '@/components/home/sidebar-right';
import { MobileNav } from '@/components/home/mobile-nav';

export const Route = createFileRoute('/(yapper)')({
  component: RouteComponent,
});

function RouteComponent() {
  const location = useLocation();
  const collapsed = location.pathname.startsWith('/messages');

  return (
    // From xl up: 3-column grid. Tracks start at the container's left edge on
    // every route (xl:justify-start), so the left sidebar's x-position never
    // changes between routes. Below xl: plain centred flex row.
    <div
      className={cn(
        'mx-auto flex min-h-svh max-w-325 justify-center pb-16 md:pb-0 xl:grid xl:justify-start',
        collapsed
          ? 'xl:grid-cols-[8.5rem_minmax(0,900px)_minmax(0,1fr)]'
          : 'xl:grid-cols-[16rem_minmax(0,640px)_22rem]',
      )}
    >
      <SidebarLeft />
      <Show when={collapsed} fallback={<Outlet />}>
        <div className="flex-1">
          <Outlet />
        </div>
      </Show>
      <Show when={!collapsed}>
        <div className="flex-1 xl:flex-none">
          <SidebarRight />
        </div>
      </Show>
      <MobileNav />
    </div>
  );
}
