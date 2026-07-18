import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SidebarLeft } from '@/components/home/sidebar-left';
import { SidebarRight } from '@/components/home/sidebar-right';

export const Route = createFileRoute('/(yapper)')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto flex min-h-svh max-w-[1300px] justify-center">
      <div className="flex-1">
        <SidebarLeft />
      </div>
      <Outlet />
      <div className="flex-1">
        <SidebarRight />
      </div>
    </div>
  );
}
