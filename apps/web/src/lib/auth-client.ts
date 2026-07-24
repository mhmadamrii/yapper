import { env } from '@yapper/env/web';
import { usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { getServerUrl } from './server-url';

export const authClient = createAuthClient({
  // better-auth derives its route-matching base from this URL's path, so the
  // public auth path must equal the server-side mount (/api/auth everywhere)
  baseURL: new URL('/api/auth', getServerUrl(env.VITE_SERVER_URL)).toString(),
  plugins: [usernameClient()],
});
