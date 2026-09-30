import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/(owner)')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
