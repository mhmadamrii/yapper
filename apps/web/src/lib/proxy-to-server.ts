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

  // Forwarding the original `content-length` alongside a piped stream body
  // can disagree with how the runtime re-frames that stream, and undici
  // throws `RequestContentLengthMismatchError` when the two don't match —
  // let fetch recompute it from the actual body instead.
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.delete('content-length');
  forwardedHeaders.delete('host');

  const response = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders,
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
