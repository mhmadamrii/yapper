import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { seo } from '@/lib/seo';

// `/u/<handle>` — what `@mention` links point at. Profiles are keyed by user
// id, so this only resolves the handle and redirects; it renders only when
// the handle doesn't resolve (unknown user, or one the viewer blocked).
export const Route = createFileRoute('/(yapper)/u/$username/')({
  beforeLoad: async ({ context, params }) => {
    let userId: string | undefined;
    try {
      const found = await context.queryClient.ensureQueryData(
        context.trpc.user.idByUsername.queryOptions({
          username: params.username,
        }),
      );
      userId = found.id;
    } catch {
      // Not found — fall through and render the message below.
    }
    if (userId) {
      throw redirect({
        to: '/profile/$userId',
        params: { userId },
        replace: true,
      });
    }
  },
  head: () => ({ meta: seo({ title: 'Account not found' }) }),
  component: NotFound,
});

function NotFound() {
  const { username } = Route.useParams();
  return (
    <main className="border-border min-h-svh w-full max-w-[640px] border-x px-8 py-16 text-center">
      <p className="text-lg font-bold">This account doesn't exist</p>
      <p className="text-muted-foreground mt-1 text-sm">
        No one goes by @{username}.
      </p>
      <Link
        to="/"
        className="bg-primary text-primary-foreground mt-4 inline-block rounded-full px-6 py-2.5 font-semibold"
      >
        Back home
      </Link>
    </main>
  );
}
