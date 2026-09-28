import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { useState } from 'react';
import { InterestPillGrid } from '@/components/interest-pill-grid';
import { requireSession } from '@/lib/route-guards';
import { seo } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/(global)/onboarding/')({
  beforeLoad: ({ context }) => requireSession(context),
  head: () => ({ meta: seo({ title: 'Pick your interests' }) }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const interestListQuery = useQuery(trpc.interest.list.queryOptions());

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const setMine = useMutation(
    trpc.interest.setMine.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  async function finish() {
    if (selected.size > 0) {
      await setMine.mutateAsync({ interestSlugs: [...selected] });
    }
    navigate({ to: '/' });
  }

  return (
    <section className="flex min-h-svh w-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">
          Pick a few interests
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          We'll use these to build your{' '}
          <span className="text-foreground font-medium">Feeds</span> tab. You
          can change them anytime.
        </p>

        <div className="mt-8">
          <InterestPillGrid
            interests={interestListQuery.data ?? []}
            selected={selected}
            onToggle={toggle}
          />
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            disabled={setMine.isPending}
            onClick={() => navigate({ to: '/' })}
          >
            Skip for now
          </Button>
          <Button
            type="button"
            size="lg"
            className="rounded-full px-8"
            disabled={setMine.isPending}
            onClick={finish}
          >
            {setMine.isPending ? 'Saving...' : 'Done'}
          </Button>
        </div>
      </div>
    </section>
  );
}
