import { protectedProcedure, publicProcedure, router } from '../index';
import { draftRouter } from './draft';
import { mediaRouter } from './media';
import { postRouter } from './post';
import { socialRouter } from './social';
import { userRouter } from './user';

export const appRouter = router({
  draft: draftRouter,
  media: mediaRouter,
  post: postRouter,
  social: socialRouter,
  user: userRouter,
  healthCheck: publicProcedure.query(() => {
    return 'OK';
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: 'This is private',
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
