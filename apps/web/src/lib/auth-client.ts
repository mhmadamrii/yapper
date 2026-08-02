import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { getServerUrl } from './server-url';

export const authClient = createAuthClient({
  // Routed through the web app's own /api/auth/$ proxy (see
  // routes/api/auth/$.ts) rather than the Workers domain directly, so the
  // session cookie is set on this app's own origin. A plain page load never
  // sends a cookie scoped to a different domain, so a cross-domain
  // Set-Cookie here would make server-side session checks (route-guards.ts)
  // always see a logged-out user.
  baseURL: getServerUrl('/api/auth'),
  plugins: [usernameClient()],
});
