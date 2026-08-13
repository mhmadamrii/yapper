import { protectedProcedure, publicProcedure, router } from '../index';
import { draftRouter } from './draft';
import { linkRouter } from './link';
import { mediaRouter } from './media';
import { messageRouter } from './message';
import { notificationRouter } from './notification';
import { postRouter } from './post';
import { recommendationRouter } from './recommendation';
import { socialRouter } from './social';
import { trendingRouter } from './trending';
import { userRouter } from './user';

export const appRouter = router({
  draft: draftRouter,
  link: linkRouter,
  media: mediaRouter,
  message: messageRouter,
  notification: notificationRouter,
  post: postRouter,
  recommendation: recommendationRouter,
  social: socialRouter,
  trending: trendingRouter,
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
