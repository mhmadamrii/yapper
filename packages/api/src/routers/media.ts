import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TRPCError } from '@trpc/server';
import { env } from '@yapper/env/server';
import { z } from 'zod';
import { protectedProcedure, router } from '../index';

const s3 = new S3Client({
  endpoint: env.MEDIA_S3_ENDPOINT,
  region: env.MEDIA_S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export const mediaRouter = router({
  // Client PUTs the file straight to this URL — file bytes never touch our
  // server, same property the old ImageKit client-upload flow had.
  uploadUrl: protectedProcedure
    .input(
      z.object({
        contentType: z.string(),
        size: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ext = EXTENSION_BY_CONTENT_TYPE[input.contentType];
      if (!ext) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Unsupported content type: ${input.contentType}`,
        });
      }
      if (input.size > MAX_UPLOAD_BYTES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB)`,
        });
      }

      // Server picks the key so a user can't overwrite someone else's file
      // or write outside their own prefix.
      const objectKey = `${ctx.session.user.id}/${crypto.randomUUID()}.${ext}`;

      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: env.MEDIA_S3_BUCKET,
          Key: objectKey,
          ContentType: input.contentType,
        }),
        { expiresIn: 10 * 60 },
      );

      return { uploadUrl, objectKey };
    }),
});
