import { cn } from '@yapper/ui/lib/utils';

// Deterministic hash so a user's fallback gradient is stable across
// renders and surfaces instead of shuffling on every mount.
function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Avatar with a per-user gradient fallback: renders the profile image when
 * set, otherwise a gradient derived from the user's name. Pass sizing
 * (`size-*`, borders) via className — rounding and object-fit are built in.
 */
export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  const hash = hashString(name);
  const from = hash % 360;
  const to = (from + 45 + ((hash >> 8) % 90)) % 360;

  return (
    <div
      role="img"
      aria-label={name}
      className={cn('rounded-full', className)}
      style={{
        background: `linear-gradient(135deg, hsl(${from} 80% 60%), hsl(${to} 70% 40%))`,
      }}
    />
  );
}
