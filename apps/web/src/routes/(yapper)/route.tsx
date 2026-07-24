import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { SidebarLeft } from '@/components/home/sidebar-left';
import { SidebarRight } from '@/components/home/sidebar-right';

export const Route = createFileRoute('/(yapper)')({
  component: RouteComponent,
});

function RouteComponent() {
  const location = useLocation();
  const collapsed = location.pathname.startsWith('/messages');

  return (
    <div className="mx-auto flex min-h-svh max-w-[1300px] justify-center">
      <div className={collapsed ? 'shrink-0' : 'flex-1'}>
        <SidebarLeft />
      </div>
      {collapsed ? (
        <div className="flex-1">
          <Outlet />
        </div>
      ) : (
        <Outlet />
      )}
      {!collapsed && (
        <div className="flex-1">
          <SidebarRight />
        </div>
      )}
    </div>
  );
}
