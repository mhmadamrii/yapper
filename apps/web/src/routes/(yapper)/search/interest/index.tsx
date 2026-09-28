import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@yapper/ui/components/button';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InterestPillGrid } from '@/components/interest-pill-grid';
import { seo } from '@/lib/seo';
import { toast } from '@/lib/toast';
import { useTRPC } from '@/utils/trpc';

export const Route = createFileRoute('/(yapper)/search/interest/')({
  head: () => ({ meta: seo({ title: 'Interests' }) }),
  component: InterestsPage,
});

function InterestsPage() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const interestListQuery = useQuery(trpc.interest.list.queryOptions());
  const myInterestsQuery = useQuery(trpc.interest.mine.queryOptions());

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Seed local selection from the saved set once it loads — a ref-less
  // one-time sync would fight the user's own toggles on every refetch, so
  // this only runs while the query hasn't resolved yet.
  useEffect(() => {
    if (myInterestsQuery.data) {
      setSelected(new Set(myInterestsQuery.data));
    }
  }, [myInterestsQuery.data]);

  const setMine = useMutation(
    trpc.interest.setMine.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.interest.mine.queryKey(),
        });
        toast.success('Interests saved');
      },
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

  return (
    <main className="border-border w-full max-w-[640px] border-x">
      <header className="bg-background/80 border-border sticky top-0 z-10 flex items-center gap-4 border-b px-4 py-2 backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.history.back()}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="font-bold">Your interests</h1>
      </header>

      <p className="text-muted-foreground border-border border-b p-4 text-sm">
        Your selected interests help us serve you content you care about.
      </p>

      <div className="p-4">
        <InterestPillGrid
          interests={interestListQuery.data ?? []}
          selected={selected}
          onToggle={toggle}
        />
      </div>

      <div className="border-border sticky bottom-0 border-t p-4">
        <Button
          className="w-full rounded-full"
          disabled={setMine.isPending}
          onClick={() => setMine.mutate({ interestSlugs: [...selected] })}
        >
          {setMine.isPending ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </main>
  );
}
