/**
 * DeepSeek client. Uses the official `openai` SDK pointed at DeepSeek's
 * OpenAI-compatible API endpoint.
 *
 * Why this works: DeepSeek exposes `/chat/completions` with the same
 * request/response shape as OpenAI. The only differences are the base
 * URL, the API key, and the model name.
 *
 * API key: read from DEEPSEEK_API_KEY. We fail fast with a clear error
 * if it's missing — never silently degrade to a default.
 *
 * Usage:
 *   import { getDeepSeek } from '@/lib/ai/client';
 *   const client = getDeepSeek();
 *   const res = await client.chat.completions.create({ ... });
 */

import OpenAI from 'openai';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
// "deepseek-chat" is DeepSeek-V3 (their general-purpose model).
// Good quality, very cheap, fast enough for this use case.
const DEFAULT_MODEL = 'deepseek-chat';

let cachedClient: OpenAI | null = null;

export function getDeepSeek(): OpenAI {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      'DEEPSEEK_API_KEY is not set. Add it to .env.local (see .env.example).',
    );
  }

  cachedClient = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });
  return cachedClient;
}

export const MODEL_NAME = DEFAULT_MODEL;

/** Hard timeout for any single LLM call. */
export const LLM_TIMEOUT_MS = 60_000;
