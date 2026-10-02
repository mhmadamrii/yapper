import { createFileRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/(owner)')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className='flex gap-4'>
      <div className='flex flex-col gap-5'>
        <Link to="/">Home</Link>
        <Link to="/moderation">Moderation</Link>
        <Link to="/bots-assignment">Bot Assignments</Link>
      </div>
      <Outlet />
    </div>
  )
}
