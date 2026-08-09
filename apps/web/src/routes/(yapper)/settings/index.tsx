import { Button } from '@yapper/ui/components/button';
import { For, Show } from '@/components/control-flow';
import { UserAvatar } from '@/components/user-avatar';
import { authClient } from '@/lib/auth-client';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';

import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';

import {
  Accessibility,
  ArrowLeft,
  Bell,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Globe,
  Hand,
  Image,
  Info,
  Lock,
  Paintbrush,
  User,
  UserPlus,
} from 'lucide-react';

export const Route = createFileRoute('/(yapper)/settings/')({
  pendingMinMs: 0,
  beforeLoad: ({ context }) => requireSession(context),
  head: () => ({ meta: seo({ title: 'Settings' }) }),
  component: SettingsPage,
});

const SETTINGS_ROWS = [
  { label: 'Account', icon: User },
  { label: 'Privacy and security', icon: Lock },
  { label: 'Moderation and content filters', icon: Hand },
  { label: 'Notifications', icon: Bell },
  { label: 'Content and media', icon: Image },
  { label: 'Appearance', icon: Paintbrush },
  { label: 'Accessibility', icon: Accessibility },
  { label: 'Languages', icon: Globe },
  { label: 'Beta features', icon: FlaskConical },
  { label: 'Help', icon: CircleHelp },
  { label: 'About', icon: Info },
] as const;

function SettingsPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center gap-4 border-b px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="font-bold">Settings</h1>
      </header>
      <Show
        when={!isPending && session}
        fallback={
          <p className="text-muted-foreground px-4 py-12 text-center text-sm">
            Sign in to see your settings.
          </p>
        }
      >
        {(s) => (
          <>
            <div className="flex flex-col items-center gap-1 py-8">
              <UserAvatar
                name={s.user.name}
                image={s.user.image}
                className="size-24"
              />
              <h2 className="mt-3 text-xl font-bold">{s.user.name}</h2>
              <p className="text-muted-foreground">
                @{s.user.username ?? 'unknown'}
              </p>
            </div>
            <button
              onClick={() => navigate({ to: '/auth' })}
              className="hover:bg-accent/50 border-border flex w-full items-center gap-4 border-b px-4 py-3.5 text-left transition-colors"
            >
              <UserPlus className="size-5" />
              <span className="font-medium">Add another account</span>
            </button>
            <div className="border-border border-b">
              <For each={SETTINGS_ROWS}>
                {({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="text-muted-foreground flex w-full items-center gap-4 px-4 py-3.5"
                  >
                    <Icon className="size-5" />
                    <span className="flex-1 font-medium">{label}</span>
                    <ChevronRight className="size-4" />
                  </div>
                )}
              </For>
            </div>
            <button
              onClick={() =>
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => navigate({ to: '/' }),
                  },
                })
              }
              className="text-destructive hover:bg-accent/50 w-full px-4 py-4 text-left font-medium transition-colors"
            >
              Sign out
            </button>
          </>
        )}
      </Show>
    </main>
  );
}
