import { createFileRoute } from '@tanstack/react-router';
import { proxyToServer } from '@/lib/proxy-to-server';

export const Route = createFileRoute('/api/conversations/$id/stream')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        proxyToServer(request, `/conversations/${params.id}/stream`),
    },
  },
});
