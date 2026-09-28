import { createEnv } from '@t3-oss/env-core';
import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '../../apps/server/.env' });

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
    CORS_ORIGIN: z.url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),
    MEDIA_S3_ENDPOINT: z.url(),
    MEDIA_S3_BUCKET: z.string().min(1),
    MEDIA_S3_REGION: z.string().min(1).default('us-east-1'),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    BOT_CREATION_PASSWORD: z.string().min(1),
    PORT: z.coerce.number().default(3000),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
