import { authClient } from '@/lib/auth-client';
import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/(global)')({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = authClient.useSession();
  console.log('current user', data);

  return <Outlet />;
}
