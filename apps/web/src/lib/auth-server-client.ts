import { createAuthClient } from 'better-auth/react';
import { env } from '@yapper/env/web';
import { getServerUrl } from './server-url';

/**
 * Server-only session client. Hits the Workers auth server directly instead
 * of looping back through this app's own /api/auth/$ proxy — the proxy only
 * exists so a browser's Set-Cookie lands on this app's origin (see
 * auth-client.ts). A server-to-server session read just forwards the
 * incoming Cookie header and never needs that trick, so going through the
 * proxy here is a wasted extra hop (and extra cold start) on every guarded
 * route load.
 */
export const authServerClient = createAuthClient({
  baseURL: `${getServerUrl(env.VITE_SERVER_URL)}/api/auth`,
});
