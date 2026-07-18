import { protectedProcedure, publicProcedure, router } from '../index';
import { mediaRouter } from './media';
import { postRouter } from './post';
import { userRouter } from './user';

export const appRouter = router({
  media: mediaRouter,
  post: postRouter,
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
