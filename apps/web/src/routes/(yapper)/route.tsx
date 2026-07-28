import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
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
    <div className="mx-auto flex min-h-svh max-w-[1300px] justify-center pb-16 md:pb-0">
      <SidebarLeft />
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
      <MobileNav />
    </div>
  );
}
