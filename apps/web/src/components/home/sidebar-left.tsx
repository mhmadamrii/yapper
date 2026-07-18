import { Link } from '@tanstack/react-router';
import { Button } from '@yapper/ui/components/button';
import { Skeleton } from '@yapper/ui/components/skeleton';
import {
  Bell,
  Bird,
  Bookmark,
  ChevronDown,
  Globe,
  Hash,
  Home,
  List,
  MessageCircle,
  PenSquare,
  Search,
  Settings,
  User,
} from 'lucide-react';

import { authClient } from '@/lib/auth-client';
import DialogSignIn from '@/routes/-components/dialog-sign-in';

const navItems = [
  { label: 'Home', icon: Home, to: '/' },
  { label: 'Explore', icon: Search, to: '/search' },
  { label: 'Notifications', icon: Bell, to: '/notifications' },
  { label: 'Chat', icon: MessageCircle, to: '/messages' },
  { label: 'Feeds', icon: Hash, to: '/' },
  { label: 'Lists', icon: List, to: '/' },
  { label: 'Saved', icon: Bookmark, to: '/saved' },
  { label: 'Profile', icon: User, to: '/profile' },
  { label: 'Settings', icon: Settings, to: '/settings' },
] as const;

export function SidebarLeft() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <aside className="sticky top-0 hidden h-svh flex-col items-end px-6 py-6 md:flex">
      <div className="flex w-52 flex-col gap-1">
        {isPending ? (
          <SidebarSkeleton />
        ) : session ? (
          <LoggedInNav
            name={session.user.name}
            image={session.user.image ?? '/prabowo.jpg'}
          />
        ) : (
          <LoggedOutPanel />
        )}
      </div>
    </aside>
  );
}

function LoggedInNav({ name, image }: { name: string; image: string }) {
  return (
    <nav className="flex flex-col gap-1">
      <Link to="/profile" className="mb-4 w-fit">
        <img
          src={image}
          alt={name}
          className="size-12 rounded-full object-cover"
        />
      </Link>

      {navItems.map(({ label, icon: Icon, to }) => (
        <Link
          key={label}
          to={to}
          className="hover:bg-accent flex items-center gap-4 rounded-full px-3 py-2.5 text-lg font-medium transition-colors"
          activeProps={{ className: 'font-bold' }}
          activeOptions={{ exact: true }}
        >
          <Icon className="size-6" />
          {label}
        </Link>
      ))}

      <Button size="lg" className="mt-4 w-fit rounded-full px-8">
        <PenSquare />
        New post
      </Button>
    </nav>
  );
}

function LoggedOutPanel() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <Bird className="text-primary size-10" />

      <h1 className="text-3xl font-bold tracking-tight">
        Join the conversation
      </h1>

      <div className="flex items-center gap-2">
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
