import { createDb } from '@yapper/db';
import { z } from 'zod';
import { protectedProcedure, router } from '../index';
import { getOrCreateLinkPreview, normalizeUrl } from '../lib/unfurl';

export const linkRouter = router({
  /**
   * Composer-side unfurl. Protected because it makes the server fetch a URL
   * the caller chose — an open endpoint here is a request-forwarding service
   * for anyone on the internet.
   *
   * Returns null rather than throwing for a URL that is unusable or that
   * failed to unfurl: the composer treats "no card" as a normal outcome, and
   * an error toast for every paste of a plain link would be noise.
   */
  preview: protectedProcedure
    .input(z.object({ url: z.string().min(1).max(2048) }))
    .query(async ({ input }) => {
      const url = normalizeUrl(input.url);
      if (!url) return null;

      const preview = await getOrCreateLinkPreview(createDb(), url);
      return preview.status === 'ok' ? preview : null;
    }),
});
