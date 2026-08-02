import { env } from '@yapper/env/web';
import { getServerUrl } from './server-url';

/**
 * Relays a browser request to the Workers API server, preserving method,
 * headers, and body. Used so the browser's session cookie (and any
 * Set-Cookie response) stays scoped to the web app's own origin instead of
 * the Workers `*.workers.dev` domain, which the browser would otherwise
 * never send cross-domain on plain navigations.
 */
export async function proxyToServer(request: Request, path: string) {
  const incoming = new URL(request.url);
  const target = new URL(
    path + incoming.search,
    getServerUrl(env.VITE_SERVER_URL),
  );

  const response = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    // @ts-expect-error -- Node's fetch requires `duplex` when the body is a stream
    duplex: 'half',
    redirect: 'manual',
  });

  const headers = new Headers(response.headers);
  // The runtime already decoded the body, so relaying these verbatim would
  // make the browser try to decode it a second time.
  headers.delete('content-encoding');
  headers.delete('content-length');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
