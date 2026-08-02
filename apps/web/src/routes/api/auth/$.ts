import { createFileRoute } from '@tanstack/react-router';
import { proxyToServer } from '@/lib/proxy-to-server';

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      ANY: ({ request }) =>
        proxyToServer(request, new URL(request.url).pathname),
    },
  },
});
