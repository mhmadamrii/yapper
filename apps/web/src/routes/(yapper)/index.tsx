import { createFileRoute } from '@tanstack/react-router';
import { Feed } from '@/components/home/feed';
import { SidebarLeft } from '@/components/home/sidebar-left';
import { SidebarRight } from '@/components/home/sidebar-right';

export const Route = createFileRoute('/(yapper)/')({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="mx-auto flex min-h-svh max-w-[1300px] justify-center">
      <div className="flex-1">
        <SidebarLeft />
      </div>
      <Feed />
      <div className="flex-1">
        <SidebarRight />
      </div>
    </div>
  );
}
