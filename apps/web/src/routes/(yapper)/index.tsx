import { createFileRoute } from '@tanstack/react-router';
import { Feed } from '@/components/home/feed';

export const Route = createFileRoute('/(yapper)/')({
  component: HomeComponent,
});

function HomeComponent() {
  return <Feed />;
}
