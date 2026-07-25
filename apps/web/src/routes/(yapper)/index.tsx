import { createFileRoute } from '@tanstack/react-router';
import { Feed } from '@/components/home/feed';
import { seo } from '@/lib/seo';

export const Route = createFileRoute('/(yapper)/')({
  head: () => ({ meta: seo({ title: 'Discover' }) }),
  component: HomeComponent,
});

function HomeComponent() {
  return <Feed />;
}
