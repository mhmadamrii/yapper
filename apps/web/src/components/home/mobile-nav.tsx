import { useState } from 'react';
import { LINK_CLASSNAME } from '@/lib/constants';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Bell, Home, LogOut, Menu, MessageCircle, Search } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { useTRPC } from '@/utils/trpc';
import { UserAvatar } from '@/components/user-avatar';
import { Show, For } from '@/components/control-flow';

import {
  navItemsAfterProfile,
  navItemsBeforeProfile,
  LoggedOutPanel,
  type AccountUser,
} from '@/components/home/sidebar-left';

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from '@yapper/ui/components/drawer';

const bottomTabs = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Explore', icon: Search, to: '/search' },
  { label: 'Chat', icon: MessageCircle, to: '/messages' },
  { label: 'Notifications', icon: Bell, to: '/notifications' },
] as const;

export function MobileNav() {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);

  const trpc = useTRPC();
  const unreadQuery = useQuery(
    trpc.notification.unreadCount.queryOptions(undefined, {
      refetchInterval: 30_000,
      enabled: !!session,
    }),
  );
  const unreadCount = unreadQuery.data?.count ?? 0;

  const unreadMessagesQuery = useQuery(
    trpc.message.unreadCount.queryOptions(undefined, {
      refetchInterval: 30_000,
      enabled: !!session,
    }),
  );
  const unreadMessagesCount = unreadMessagesQuery.data?.count ?? 0;

  return (
    <>
      <Drawer open={open} onOpenChange={setOpen} swipeDirection="left">
        <DrawerTrigger
          render={
            <button
              aria-label="Open menu"
              className="bg-background/80 border-border fixed top-3 left-3 z-30 rounded-full border p-2 backdrop-blur md:hidden"
            />
          }
        >
          <Menu className="size-5" />
        </DrawerTrigger>

        <DrawerContent className="p-4">
          <Show when={session} fallback={<LoggedOutPanel />}>
            {(s) => <DrawerNavContent user={s.user} />}
          </Show>
        </DrawerContent>
      </Drawer>

      <Show when={session}>
        {(s) => (
          <nav className="bg-background/95 border-border fixed inset-x-0 bottom-0 z-30 flex items-center justify-between border-t px-4 py-2 backdrop-blur md:hidden">
            <For each={bottomTabs}>
              {(tab) => (
                <Link
                  key={tab.label}
                  to={tab.to}
                  className="flex flex-1 items-center justify-center py-2"
                  activeOptions={{ exact: true }}
                >
                  {({ isActive }) => (
                    <span className="relative">
                      <tab.icon
                        className="size-6"
                        fill={isActive ? 'currentColor' : 'none'}
                      />
                      {tab.label === 'Notifications' && unreadCount > 0 && (
                        <span className="bg-primary absolute -top-1 -right-1 size-2.5 rounded-full" />
                      )}
                      {tab.label === 'Chat' && unreadMessagesCount > 0 && (
                        <span className="bg-primary absolute -top-1 -right-1 size-2.5 rounded-full" />
                      )}
                    </span>
                  )}
                </Link>
              )}
            </For>
            <Link
              to="/profile/$userId"
              params={{ userId: s.user.id }}
              className="flex flex-1 items-center justify-center py-2"
            >
              <UserAvatar
                name={s.user.name}
                image={s.user.image}
                className="size-7"
              />
            </Link>
          </nav>
        )}
      </Show>
    </>
  );
}

function DrawerNavContent({ user }: { user: AccountUser }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-1">
      <DrawerClose
        render={
          <Link
            to="/profile/$userId"
            params={{ userId: user.id }}
            className="mb-4 flex flex-col gap-2 rounded-lg p-2"
          />
        }
      >
        <UserAvatar name={user.name} image={user.image} className="size-12" />
        <span className="flex flex-col">
          <span className="text-sm font-bold">{user.name}</span>
          <span className="text-muted-foreground text-xs">
            @{user.username ?? 'unknown'}
          </span>
        </span>
      </DrawerClose>
      <For each={navItemsBeforeProfile}>
        {(item) => (
          <DrawerClose
            key={item.label}
            render={
              <Link
                to={item.to}
                className={LINK_CLASSNAME}
                activeProps={{ className: 'font-bold' }}
                activeOptions={{ exact: true }}
              />
            }
          >
            <item.icon className="size-6" />
            {item.label}
          </DrawerClose>
        )}
      </For>
      <DrawerClose
        render={
          <Link
            to="/profile/$userId"
            params={{ userId: user.id }}
            className={LINK_CLASSNAME}
            activeProps={{ className: 'font-bold' }}
          />
        }
      >
        <UserAvatar name={user.name} image={user.image} className="size-6" />
        Profile
      </DrawerClose>
      <For each={navItemsAfterProfile}>
        {(item) => (
          <DrawerClose
            key={item.label}
            render={
              <Link
                to={item.to}
                className={LINK_CLASSNAME}
                activeProps={{ className: 'font-bold' }}
                activeOptions={{ exact: true }}
              />
            }
          >
            <item.icon className="size-6" />
            {item.label}
          </DrawerClose>
        )}
      </For>
      <button
        className={LINK_CLASSNAME}
        onClick={() =>
          authClient.signOut({
            fetchOptions: { onSuccess: () => navigate({ to: '/' }) },
          })
        }
      >
        <LogOut className="size-6" />
        Sign out
      </button>
    </div>
  );
}
