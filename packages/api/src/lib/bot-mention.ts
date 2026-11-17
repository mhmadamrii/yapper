import type { Database } from '@yapper/db';
import { user } from '@yapper/db/schema/auth';
import { botConfig } from '@yapper/db/schema/bot';
import { community } from '@yapper/db/schema/community';
import { post } from '@yapper/db/schema/post';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { buildPostInsertStatements } from '../routers/post';
import { generateBotReply } from './gemini';
import { notify } from './notifications';

// Same shape as the web's mention pattern (apps/web/src/lib/mentions.ts):
// starts the text or follows whitespace; handles may contain dots.
const MENTION_PATTERN = /(?:^|\s)@([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/g;

// Context window handed to the model: the reply chain above the mention
// (what is actually being discussed) plus the latest community chatter.
const MAX_ANCESTORS = 10;
const MAX_RECENT_POSTS = 15;
// Per-line cap so one huge post can't dominate the prompt.
const MAX_LINE_CHARS = 500;
// One bot answering at most this many distinct mentions per post.
const MAX_BOTS_PER_POST = 2;

// Gemini spend guard: per-asker sliding window. In-memory is fine for the
// single VPS container (same trade-off as the auth rate limiter).
const ASK_LIMIT = 5;
const ASK_WINDOW_MS = 10 * 60_000;
const asks = new Map<string, number[]>();

function allowAsk(userId: string) {
  const now = Date.now();
  const recent = (asks.get(userId) ?? []).filter(
    (t) => now - t < ASK_WINDOW_MS,
  );
  if (recent.length >= ASK_LIMIT) {
    asks.set(userId, recent);
    return false;
  }
  recent.push(now);
  asks.set(userId, recent);
  return true;
}

function extractHandles(content: string) {
  const handles = new Set<string>();
  for (const match of content.matchAll(MENTION_PATTERN)) {
    handles.add(match[1]!.toLowerCase());
  }
  return [...handles];
}

function line(username: string | null, content: string) {
  const text =
    content.length > MAX_LINE_CHARS
      ? `${content.slice(0, MAX_LINE_CHARS)}…`
      : content;
  return `@${username ?? 'unknown'}: ${text}`;
}

// Called (fire-and-forget) after a community post is created. If it
// @-mentions a bot assigned to that community, the bot replies in-thread
// with the conversation as context. Never throws into the caller.
export async function respondToBotMentions(
  db: Database,
  args: {
    postId: string;
    authorId: string;
    content: string;
    communityId: string | null | undefined;
  },
) {
  try {
    if (!args.communityId) return;
    const handles = extractHandles(args.content);
    if (handles.length === 0) return;

    // Only bots assigned to *this* community can be summoned; bots never
    // trigger bots, so two of them can't loop each other.
    const [author] = await db
      .select({ isBot: user.isBot })
      .from(user)
      .where(eq(user.id, args.authorId));
    if (!author || author.isBot) return;

    const bots = await db
      .select({
        userId: botConfig.userId,
        username: user.username,
        systemPrompt: botConfig.systemPrompt,
      })
      .from(botConfig)
      .innerJoin(user, eq(user.id, botConfig.userId))
      .where(
        and(
          eq(botConfig.communityId, args.communityId),
          eq(botConfig.active, true),
          inArray(sql`lower(${user.username})`, handles),
        ),
      )
      .limit(MAX_BOTS_PER_POST);
    if (bots.length === 0) return;

    if (!allowAsk(args.authorId)) {
      console.log('[bot-mention] asker rate limited', args.authorId);
      return;
    }

    const [communityRow] = await db
      .select({ name: community.name })
      .from(community)
      .where(eq(community.id, args.communityId));
    if (!communityRow) return;

    const transcript = await buildTranscript(db, args);

    for (const bot of bots) {
      try {
        const reply = await generateBotReply({
          systemPrompt: bot.systemPrompt,
          communityName: communityRow.name,
          transcript,
          question: args.content,
        });

        const replyId = crypto.randomUUID();
        await db.transaction(async (tx) => {
          const statements = buildPostInsertStatements(tx, {
            postId: replyId,
            authorId: bot.userId,
            content: reply,
            media: [],
            replyToPostId: args.postId,
            communityId: args.communityId!,
          });
          for (const statement of statements) {
            await statement;
          }
        });

        await notify(db, {
          recipientId: args.authorId,
          actorId: bot.userId,
          type: 'reply',
          postId: args.postId,
        });
      } catch (error) {
        console.error(`[bot-mention] bot ${bot.userId} failed`, error);
      }
    }
  } catch (error) {
    console.error('[bot-mention] failed', error);
  }
}

// Oldest-first transcript: recent community posts, then the reply chain
// leading to (and including) the mention. Posts in the chain are deduped
// out of the recent list so nothing appears twice.
async function buildTranscript(
  db: Database,
  args: { postId: string; communityId: string | null | undefined },
) {
  const author = {
    id: user.id,
    username: user.username,
  };

  // Walk up the reply chain.
  const chain: { id: string; username: string | null; content: string }[] = [];
  let cursorId: string | null = args.postId;
  for (let i = 0; cursorId && i <= MAX_ANCESTORS; i++) {
    const [row] = await db
      .select({
        id: post.id,
        content: post.content,
        replyToPostId: post.replyToPostId,
        username: author.username,
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .where(eq(post.id, cursorId));
    if (!row) break;
    chain.unshift({ id: row.id, username: row.username, content: row.content });
    cursorId = row.replyToPostId;
  }
  const chainIds = new Set(chain.map((c) => c.id));

  // Latest top-level chatter in the community, for general context.
  const recent = (
    await db
      .select({
        id: post.id,
        content: post.content,
        username: author.username,
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .where(
        and(
          eq(post.communityId, args.communityId!),
          sql`${post.id} <> ${args.postId}`,
        ),
      )
      .orderBy(desc(post.createdAt), desc(post.id))
      .limit(MAX_RECENT_POSTS)
  )
    .filter((r) => !chainIds.has(r.id))
    .reverse();

  const parts: string[] = [];
  if (recent.length > 0) {
    parts.push('# Recent community posts');
    parts.push(...recent.map((r) => line(r.username, r.content)));
    parts.push('');
  }
  parts.push('# This thread (oldest first)');
  parts.push(...chain.map((c) => line(c.username, c.content)));
  return parts.join('\n');
}
