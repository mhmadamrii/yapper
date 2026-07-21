export const interestTags = [
  'Software Dev',
  'Video Games',
  'Nature',
  'Culture',
  'Books',
  'Education',
];

export type TrendingItem = {
  id: string;
  title: string;
  category: string;
  avatarNames: string[];
  badge: { kind: 'hot' } | { kind: 'time'; label: string };
};

export const trendingExplore: TrendingItem[] = [
  {
    id: 'mariners',
    title: 'Mariners',
    category: 'Sports',
    avatarNames: ['Alex Rivera', 'Jamie Sok', 'Priya Nair'],
    badge: { kind: 'hot' },
  },
  {
    id: 'big-brother',
    title: 'Big Brother',
    category: 'Entertainment',
    avatarNames: ['Devon Marsh', 'Nina Falk', 'Theo Grant'],
    badge: { kind: 'time', label: '8h ago' },
  },
  {
    id: 'valkyries',
    title: 'Valkyries',
    category: 'Sports',
    avatarNames: ['Sam Okafor', 'Lena Voss', 'Marcus Ide'],
    badge: { kind: 'time', label: '8h ago' },
  },
  {
    id: 'cal-raleigh',
    title: 'Cal Raleigh',
    category: 'Sports',
    avatarNames: ['Ruth Palmer', 'Owen Diaz', 'Kira Suzuki'],
    badge: { kind: 'time', label: '8h ago' },
  },
  {
    id: 'meta-controversy',
    title: 'Meta Controversy',
    category: 'Entertainment',
    avatarNames: ['Ben Torres', 'Maya Lindqvist', 'Isla Chen'],
    badge: { kind: 'time', label: '11h ago' },
  },
];
