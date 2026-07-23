import alchemy from 'alchemy';
import { RateLimit, Worker } from 'alchemy/cloudflare';
import { config } from 'dotenv';

const isProd = process.env.SERVER_ENV === 'production';

config({ path: './.env' });
config({ path: `../../apps/server/${isProd ? '.env.production' : '.env'}` });

const app = await alchemy('yapper');

export const server = await Worker('server', {
  cwd: '../../apps/server',
  entrypoint: 'src/index.ts',
  compatibility: 'node',
  url: true,
  bindings: {
    DATABASE_URL: alchemy.secret.env.DATABASE_URL!,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    IMAGEKIT_PUBLIC_KEY: alchemy.env.IMAGEKIT_PUBLIC_KEY!,
    IMAGEKIT_PRIVATE_KEY: alchemy.secret.env.IMAGEKIT_PRIVATE_KEY!,
    RATE_LIMITER: RateLimit({
      namespace_id: 1001,
      simple: { limit: 10, period: 60 },
    }),
  },
  dev: {
    port: 3000,
  },
});

console.log(`Server -> ${server.url}`);

await app.finalize();
