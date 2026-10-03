import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { env } from '@yapper/env/server';

// Lazy singleton — avoids constructing the client (and reading the env var)
// at module load for code paths that never generate a bot post.
let client: GoogleGenAI | undefined;
function getClient() {
  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

// `gemini-2.0-flash` was retired (API now 404s, pointed here). Model
// naming/config moved on since: 3.x Flash replaced the numeric
// `thinkingConfig.thinkingBudget` with a `thinkingLevel` enum
// (LOW/MEDIUM/HIGH) and — unlike 2.5 — can't fully disable thinking, only
// minimize it. See `thinkingLevel: LOW` below.
const MODEL = 'gemini-3.8-flash';

// `post.create`'s content cap (packages/api/src/routers/post.ts) is 500
// chars — instruct the model to stay under it, but never trust an LLM's
// length compliance blindly.
const MAX_POST_LENGTH = 500;

// 503 (model overloaded) and 429 (rate limited) are both explicitly
// transient per Google's own error message — worth a couple of short
// retries before giving up, since the scheduler otherwise just skips this
// bot's post for the whole tick over a blip.
const RETRYABLE_STATUS = new Set([429, 503]);
const RETRY_DELAYS_MS = [500, 1500];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry(systemPrompt: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getClient().models.generateContent({
        model: MODEL,
        contents:
          'Write one social media post now. Output only the post text, no quotes, no hashtags unless they fit naturally.',
        config: {
          systemInstruction: systemPrompt,
          // Thinking tokens count against this cap, so a tight value gets
          // eaten by hidden reasoning and cuts the visible post off
          // (MAX_TOKENS). Post length is enforced by the prompt + the
          // MAX_POST_LENGTH slice below, so this is only a runaway guard.
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
    } catch (error) {
      const retryable =
        error instanceof ApiError && RETRYABLE_STATUS.has(error.status);
      const delay = RETRY_DELAYS_MS[attempt];
      if (!retryable || delay === undefined) throw error;
      await sleep(delay);
    }
  }
}

export async function generateBotPost(systemPrompt: string): Promise<string> {
  const response = await generateWithRetry(systemPrompt);

  // `finishReason` (e.g. MAX_TOKENS, SAFETY) explains an empty/truncated
  // result that `.text` alone doesn't.
  const finishReason = response.candidates?.[0]?.finishReason;
  console.log('[bot] gemini response', {
    text: response.text,
    finishReason,
    promptFeedback: response.promptFeedback,
    // `thoughtsTokenCount` makes a future "hit MAX_TOKENS on a tiny output"
    // provable instead of inferred, the way this one was.
    usage: response.usageMetadata,
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error(
      `Gemini returned an empty response (finishReason: ${finishReason})`,
    );
  }
  if (finishReason === 'MAX_TOKENS') {
    console.warn(
      '[bot] gemini hit MAX_TOKENS — output may be cut off mid-sentence',
    );
  }
  if (text.length > MAX_POST_LENGTH) {
    console.log(
      `[bot] gemini output truncated: ${text.length} -> ${MAX_POST_LENGTH} chars`,
    );
  }
  return text.slice(0, MAX_POST_LENGTH);
}
