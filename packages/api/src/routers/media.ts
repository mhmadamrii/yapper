import { env } from '@yapper/env/server';

import { protectedProcedure, router } from '../index';

// ImageKit client-side upload auth: signature = HMAC-SHA1(token + expire)
// keyed with the private key. The private key never leaves the server; the
// file bytes never touch it (client uploads straight to upload.imagekit.io).
async function hmacSha1Hex(message: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const mediaRouter = router({
  uploadAuth: protectedProcedure.mutation(async () => {
    const token = crypto.randomUUID();
    // ImageKit rejects expire more than 1 hour in the future
    const expire = Math.floor(Date.now() / 1000) + 10 * 60;
    const signature = await hmacSha1Hex(
      token + expire,
      env.IMAGEKIT_PRIVATE_KEY,
    );

    return {
      token,
      expire,
      signature,
      publicKey: env.IMAGEKIT_PUBLIC_KEY,
    };
  }),
});
