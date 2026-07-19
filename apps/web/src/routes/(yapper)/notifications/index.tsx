import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';

import { For, Match, Show, Switch } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';

import {
  Bookmark,
  ChevronDown,
  CornerDownRight,
  Ellipsis,
  Heart,
  MessageCircle,
  Repeat2,
  Settings,
  Share,
  UserPlus,
} from 'lucide-react';

export const Route = createFileRoute('/(yapper)/notifications/')({
  component: NotificationsPage,
});

// ---------------------------------------------------------------------------
// Dummy data — layout preview only, until the notification API exists.
// ---------------------------------------------------------------------------

interface DummyActor {
  name: string;
  username: string;
}

type DummyNotification =
  | {
      id: string;
      type: 'like';
      actors: DummyActor[];
      othersCount: number;
      postSnippet: string;
      date: string;
    }
  | {
      id: string;
      type: 'follow';
      actors: DummyActor[];
      othersCount: number;
      date: string;
    }
  | {
      id: string;
      type: 'reply';
      actor: DummyActor;
      content: string;
      date: string;
      mention: boolean;
    };

const DUMMY_NOTIFICATIONS: DummyNotification[] = [
  {
    id: '1',
    type: 'like',
    actors: [
      { name: 'Mira Dian', username: 'miradian.yapper' },
      { name: 'Budi Santoso', username: 'budisan.yapper' },
      { name: 'Citra Ayu', username: 'citraayu.yapper' },
      { name: 'Dewa Putra', username: 'dewaputra.yapper' },
      { name: 'Eka Sari', username: 'ekasari.yapper' },
    ],
    othersCount: 16,
    postSnippet: 'hello world',
    date: 'Jun 10, 2024',
  },
  {
    id: '2',
    type: 'reply',
    actor: { name: 'qzzure', username: 'mamiculauw.yapper' },
    content: 'hai',
    date: 'Jun 10, 2024',
    mention: true,
  },
  {
    id: '3',
    type: 'follow',
    actors: [
      { name: 'Fajar Nugroho', username: 'fajarn.yapper' },
      { name: 'Gita Lestari', username: 'gitalestari.yapper' },
    ],
    othersCount: 3,
    date: 'Jun 10, 2024',
  },
  {
    id: '4',
    type: 'reply',
    actor: { name: 'adingga', username: 'adingga.yapper' },
    content: 'hallo',
    date: 'Jun 10, 2024',
    mention: false,
  },
];

const TABS = ['All', 'Mentions'] as const;

function NotificationsPage() {
  const [activeTab, setActiveTab] = useState(0);

  const notifications =
    activeTab === 0
      ? DUMMY_NOTIFICATIONS
      : DUMMY_NOTIFICATIONS.filter((n) => n.type === 'reply' && n.mention);

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold">Notifications</h1>
          <Button variant="ghost" size="icon-sm">
            <Settings className="size-5" />
          </Button>
        </div>

        <nav className="flex">
          <For each={TABS}>
            {(tab, i) => (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                className="hover:bg-accent/50 flex-1 py-3 text-sm font-semibold transition-colors"
              >
                <span
                  className={
                    activeTab === i
                      ? 'border-primary border-b-2 pb-3'
                      : 'text-muted-foreground'
                  }
                >
                  {tab}
                </span>
              </button>
            )}
          </For>
        </nav>
      </header>

      <For
        each={notifications}
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Nothing here yet.
          </p>
        }
      >
        {(notification) => (
          <NotificationRow key={notification.id} notification={notification} />
        )}
      </For>
    </main>
  );
}

function NotificationRow({
  notification,
}: {
  notification: DummyNotification;
}) {
  return (
    <Switch>
      <Match when={notification.type === 'like' && notification}>
        {(n) => (
          <AggregatedRow
            icon={<Heart className="size-7 fill-rose-500 text-rose-500" />}
            actors={n.actors}
            othersCount={n.othersCount}
            action="liked your post"
            date={n.date}
            snippet={n.postSnippet}
          />
        )}
      </Match>

      <Match when={notification.type === 'follow' && notification}>
        {(n) => (
          <AggregatedRow
            icon={<UserPlus className="text-primary size-7" />}
            actors={n.actors}
            othersCount={n.othersCount}
            action="followed you"
            date={n.date}
          />
        )}
      </Match>

      <Match when={notification.type === 'reply' && notification}>
        {(n) => <ReplyRow notification={n} />}
      </Match>
    </Switch>
  );
}

function AggregatedRow({
  icon,
  actors,
  othersCount,
  action,
  date,
  snippet,
}: {
  icon: React.ReactNode;
  actors: DummyActor[];
  othersCount: number;
  action: string;
  date: string;
  snippet?: string;
}) {
  const [first] = actors;

  return (
    <div className="border-border hover:bg-accent/30 cursor-pointer border-b px-4 py-3 transition-colors">
      <div className="flex items-center gap-3">
        <div className="flex w-10 shrink-0 justify-center">{icon}</div>
        <div className="flex items-center gap-1.5">
          <For each={actors}>
            {(actor) => (
              <UserAvatar
                key={actor.username}
                name={actor.name}
                className="size-9"
              />
            )}
          </For>
        </div>
        <Show when={othersCount > actors.length}>
          <button className="text-muted-foreground flex items-center gap-1 text-sm">
            +{othersCount - actors.length + 1}
            <ChevronDown className="size-4" />
          </button>
        </Show>
      </div>

      <p className="pl-13 mt-2.5 text-[15px]">
        <span className="font-bold">{first?.name}</span> and{' '}
        <span className="font-bold">{othersCount} others</span> {action}{' '}
        <span className="text-muted-foreground">· {date}</span>
      </p>
      <Show when={snippet}>
        {(text) => <p className="text-muted-foreground pl-13">{text}</p>}
      </Show>
    </div>
  );
}

function ReplyRow({
  notification,
}: {
  notification: Extract<DummyNotification, { type: 'reply' }>;
}) {
  return (
    <div className="border-border hover:bg-accent/30 cursor-pointer border-b px-4 py-3 transition-colors">
      <div className="flex gap-3">
        <UserAvatar
          name={notification.actor.name}
          className="size-10 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1 text-[15px]">
            <span className="truncate font-bold">
              {notification.actor.name}
            </span>
            <span className="text-muted-foreground truncate">
              @{notification.actor.username}
            </span>
            <span className="text-muted-foreground">· {notification.date}</span>
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CornerDownRight className="size-3.5" />
            Replied to you
          </p>
          <p className="mt-1 text-[15px]">{notification.content}</p>

          <div className="text-muted-foreground mt-3 flex items-center justify-between pr-8 text-sm">
            <button className="hover:text-foreground transition-colors">
              <MessageCircle className="size-4" />
            </button>
            <button className="transition-colors hover:text-green-500">
              <Repeat2 className="size-4" />
            </button>
            <button className="transition-colors hover:text-red-500">
              <Heart className="size-4" />
            </button>
            <div className="flex items-center gap-4">
              <button className="hover:text-foreground transition-colors">
                <Bookmark className="size-4" />
              </button>
              <button className="hover:text-foreground transition-colors">
                <Share className="size-4" />
              </button>
              <button className="hover:text-foreground transition-colors">
                <Ellipsis className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
