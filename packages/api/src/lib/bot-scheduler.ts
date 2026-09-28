import type { Database } from '@yapper/db';
import { botConfig } from '@yapper/db/schema/bot';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { generateBotPost } from './gemini';
import { buildPostInsertStatements } from '../routers/post';

// One bot's generate-and-post cycle. Shared by the interval tick and the
// manual `bot.generateNow` procedure, so there's exactly one implementation
// of "what happens when a bot posts."
export async function postForBot(
  db: Database,
  bot: { userId: string; systemPrompt: string },
) {
  const content = await generateBotPost(bot.systemPrompt);
  const postId = crypto.randomUUID();

  console.log('[bot] inserting post', {
    postId,
    authorId: bot.userId,
    content,
  });

  await db.transaction(async (tx) => {
    const statements = buildPostInsertStatements(tx, {
      postId,
      authorId: bot.userId,
      content,
      media: [],
    });
    for (const statement of statements) {
      await statement;
    }
  });

  await db
    .update(botConfig)
    .set({ lastPostedAt: new Date() })
    .where(eq(botConfig.userId, bot.userId));

  console.log(`[bot] posted ${postId} for ${bot.userId}`);

  return { id: postId };
}

// Called on a fixed interval from `apps/server/src/index.ts`. Each bot is
// wrapped in try/catch so one bot's Gemini error/quota failure doesn't block
// the rest — same "survive a failed tick" resilience the old trending cron
// used. Sequential, not `Promise.all`, to avoid bursting the Gemini API.
export async function runBotScheduler(db: Database) {
  const due = await db
    .select({
      userId: botConfig.userId,
      systemPrompt: botConfig.systemPrompt,
    })
    .from(botConfig)
    .where(
      and(
        eq(botConfig.active, true),
        or(
          isNull(botConfig.lastPostedAt),
          sql`${botConfig.lastPostedAt} <= now() - make_interval(mins => ${botConfig.postIntervalMinutes})`,
        ),
      ),
    );

  for (const bot of due) {
    try {
      await postForBot(db, bot);
    } catch (error) {
      console.error(`[bot-scheduler] bot ${bot.userId} failed`, error);
    }
  }
}
