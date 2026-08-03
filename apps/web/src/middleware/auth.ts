import { createMiddleware } from '@tanstack/react-start';
import { authServerClient } from '@/lib/auth-server-client';

export const authMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const session = await authServerClient.getSession({
      fetchOptions: {
        headers: request.headers,
        throw: true,
      },
    });
    return next({
      context: { session },
    });
  },
);
