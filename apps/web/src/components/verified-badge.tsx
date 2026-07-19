import { BadgeCheck } from 'lucide-react';
import { cn } from '@yapper/ui/lib/utils';

/** Blue verification seal shown next to verified users' display names. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <BadgeCheck
      aria-label="Verified"
      className={cn('fill-blue-500 text-background size-4 shrink-0', className)}
    />
  );
}
