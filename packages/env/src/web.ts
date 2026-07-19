import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_SERVER_URL: z.url(),
    VITE_IMAGEKIT_URL_ENDPOINT: z.url(),
    // Klipy app key — used by gif-picker-react in the post/reply composers.
    VITE_KLIPY_API_KEY: z.string().min(1),
  },
  runtimeEnv: (import.meta as any).env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
