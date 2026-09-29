import appCss from '../index.css?url';

import type { QueryClient } from '@tanstack/react-query';
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@yapper/api/routers/index';

import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { Toaster } from '@yapper/ui/components/sonner';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { seo } from '@/lib/seo';
import { sessionQueryOptions } from '@/lib/session-query';

import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router';

export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#0c0a09',
      },
      ...seo({}),
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      // Favicon set + manifest already existed on disk but weren't linked
      // anywhere — browsers/OSes only ever saw the fallback below.
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/site.webmanifest',
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/yapper-logo.png',
      },
    ],
  }),

  // Resolved once per document load (server-side during SSR, then dehydrated
  // into the client cache) so that guarded routes in `lib/route-guards.ts`
  // never have to block a client navigation on a session round trip.
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(sessionQueryOptions),

  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Toaster />
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
        <Scripts />
      </body>
    </html>
  );
}
