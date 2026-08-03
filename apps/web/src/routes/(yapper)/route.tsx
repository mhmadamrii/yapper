import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { Show } from '@/components/control-flow';
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
    <div className="mx-auto flex min-h-svh max-w-325 justify-center pb-16 md:pb-0">
      <SidebarLeft />
      <Show when={collapsed} fallback={<Outlet />}>
        <div className="flex-1">
          <Outlet />
        </div>
      </Show>
      <Show when={!collapsed}>
        <div className="flex-1">
          <SidebarRight />
        </div>
      </Show>
      <MobileNav />
    </div>
  );
}
