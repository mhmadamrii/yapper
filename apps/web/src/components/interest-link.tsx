import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

// "> slug" next to a post's author: opens Feeds filtered to that interest.
// Stops propagation because post cards are clickable as a whole.
export function InterestLink({ slug }: { slug: string }) {
  return (
    <Link
      to="/feeds"
      search={{ interest: slug }}
      onClick={(e) => e.stopPropagation()}
      className="text-foreground flex min-w-0 shrink items-center gap-0.5 hover:underline"
    >
      <ChevronRight className="size-4 shrink-0" strokeWidth={2.5} />
      <span className="truncate font-bold">{slug}</span>
    </Link>
  );
}
