import { useQuery } from '@tanstack/react-query';
import { LINK_CLASSNAME } from '@/lib/constants';
import { Link, useNavigate, useLocation } from '@tanstack/react-router';
import { DialogCreatePost } from '@/routes/(yapper)/-components/dialog-create-post';
import { DialogSignIn } from '@/routes/(yapper)/-components/dialog-sign-in';
import { useSession, useSignOut } from '@/hooks/use-session';
import { ScrollToTop } from '@/components/scroll-to-top';
import { UserAvatar } from '@/components/user-avatar';
import { useTRPC } from '@/utils/trpc';
import { cn } from '@yapper/ui/lib/utils';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@yapper/ui/components/dropdown-menu';

import {
  Bell,
  Bookmark,
  ChevronDown,
  CircleUserRound,
  Ellipsis,
  Globe,
  Hash,
  Home,
  List,
  LogOut,
  MessageCircle,
  PenSquare,
  Plus,
  Search,
  Settings,
  User,
} from 'lucide-react';

export interface AccountUser {
  id: string;
  name: string;
  image?: string | null;
  username?: string | null;
}

// Everything up to "Profile" — Profile links to the signed-in user's own
// profile (/profile/$userId), so it's rendered separately from this list.
export const navItemsBeforeProfile = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Explore', icon: Search, to: '/search' },
  { label: 'Notifications', icon: Bell, to: '/notifications' },
  { label: 'Chat', icon: MessageCircle, to: '/messages' },
  { label: 'Feeds', icon: Hash, to: '/' },
  { label: 'Drafts', icon: List, to: '/drafts' },
  { label: 'Saved', icon: Bookmark, to: '/saved' },
] as const;

export const navItemsAfterProfile = [
  { label: 'Settings', icon: Settings, to: '/settings' },
] as const;

export function SidebarLeft() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const collapsed = location.pathname.startsWith('/messages');

  return (
    <aside className="sticky top-0 hidden h-svh flex-col items-start py-6 pl-10 pr-6 md:flex">
      <div
        className={cn(
          'flex flex-col gap-1',
          collapsed ? 'w-fit' : session || isPending ? 'w-50' : 'w-64',
        )}
      >
        {isPending ? (
          <SidebarSkeleton />
        ) : session ? (
          <LoggedInNav user={session.user} collapsed={collapsed} />
        ) : (
          <LoggedOutPanel />
        )}
      </div>
      <div className="mt-auto self-end">
        <ScrollToTop />
      </div>
    </aside>
  );
}

function AccountChip({
  user,
  collapsed,
}: {
  user: AccountUser;
  collapsed?: boolean;
}) {
  const navigate = useNavigate();
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            className={cn(
              'group hover:bg-accent aria-expanded:bg-accent mb-4 flex h-14 w-full items-center gap-2.5 rounded-full p-1 transition-colors',
              !collapsed && 'hover:pr-3 aria-expanded:pr-3',
            )}
          />
        }
      >
        <UserAvatar
          name={user.name}
          image={user.image}
          className={cn(
            'size-12 shrink-0',
            !collapsed &&
              'transition-[width,height] duration-200 group-hover:size-9 group-aria-expanded:size-9',
          )}
        />
        {!collapsed && (
          <>
            <span className="hidden min-w-0 flex-1 flex-col text-left group-hover:flex group-aria-expanded:flex">
              <span className="truncate text-sm font-bold">{user.name}</span>
              <span className="text-muted-foreground truncate text-xs">
                @{user.username ?? 'unknown'}
              </span>
            </span>
            <Ellipsis className="text-muted-foreground hidden size-4 shrink-0 group-hover:block group-aria-expanded:block" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="bg-card w-56">
        <DropdownMenuItem
          onClick={() =>
            navigate({ to: '/profile/$userId', params: { userId: user.id } })
          }
        >
          <CircleUserRound />
          Go to profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: '/auth' })}>
          <Plus />
          Add another account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoggedInNav({
  user,
  collapsed,
}: {
  user: AccountUser;
  collapsed?: boolean;
}) {
  const trpc = useTRPC();
  // Polling, not sockets — matches CLAUDE.md's "start with refetchInterval"
  // guidance for real-time surfaces; upgrade to SSE only if this matters.
  const unreadQuery = useQuery(
    trpc.notification.unreadCount.queryOptions(undefined, {
      refetchInterval: 30_000,
    }),
  );
  const unreadCount = unreadQuery.data?.count ?? 0;

  const unreadMessagesQuery = useQuery(
    trpc.message.unreadCount.queryOptions(undefined, {
      refetchInterval: 30_000,
    }),
  );
  const unreadMessagesCount = unreadMessagesQuery.data?.count ?? 0;

  return (
    <nav className="flex flex-col gap-1">
      <AccountChip user={user} collapsed={collapsed} />

      {navItemsBeforeProfile.map(({ label, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          className={LINK_CLASSNAME}
          activeProps={{ className: 'font-bold' }}
          activeOptions={{ exact: true }}
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icon
                  className="size-6"
                  fill={isActive ? 'currentColor' : 'none'}
                />
                {label === 'Notifications' && unreadCount > 0 && (
                  <span className="bg-primary absolute -top-1 -right-1 size-2.5 rounded-full" />
                )}
                {label === 'Chat' && unreadMessagesCount > 0 && (
                  <span className="bg-primary absolute -top-1 -right-1 size-2.5 rounded-full" />
                )}
              </span>
              {!collapsed && label}
            </>
          )}
        </Link>
      ))}

      <Link
        to="/profile/$userId"
        params={{ userId: user.id }}
        className={LINK_CLASSNAME}
        activeProps={{ className: 'font-bold' }}
      >
        {({ isActive }) => (
          <>
            <User
              className="size-6"
              fill={isActive ? 'currentColor' : 'none'}
            />
            {!collapsed && 'Profile'}
          </>
        )}
      </Link>

      {navItemsAfterProfile.map(({ label, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          className={LINK_CLASSNAME}
          activeProps={{ className: 'font-bold' }}
          activeOptions={{ exact: true }}
        >
          {({ isActive }) => (
            <>
              <Icon
                className="size-6"
                fill={isActive ? 'currentColor' : 'none'}
              />
              {!collapsed && label}
            </>
          )}
        </Link>
      ))}

      <DialogCreatePost
        trigger={
          collapsed ? (
            <Button
              size="icon"
              className="mt-4 rounded-full"
              aria-label="New post"
            >
              <PenSquare />
            </Button>
          ) : (
            <Button size="lg" className="mt-4 w-fit rounded-full px-8">
              <PenSquare />
              New post
            </Button>
          )
        }
      />
    </nav>
  );
}

export function LoggedOutPanel() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <img src="/yapper-logo.png" alt="Yapper" className="size-10" />

      <h1 className="text-3xl font-bold tracking-tight">
        Join the conversation
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        <Link to="/auth">
          <Button className="rounded-full px-5">Create account</Button>
        </Link>
        <DialogSignIn />
      </div>

      <Button
        variant="ghost"
        className="text-muted-foreground w-fit rounded-full"
      >
        <Globe />
        English
        <ChevronDown />
      </Button>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="size-12 rounded-full" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-7 w-40" />
      ))}
    </div>
  );
}
