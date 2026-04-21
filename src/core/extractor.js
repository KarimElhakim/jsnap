/**
 * Provider-agnostic extraction orchestrator.
 *
 * Pure function over an injected `Provider`. No `chrome.*`, no storage, no
 * side effects beyond the single `provider.complete()` call (or N calls when
 * chunking is engaged).
 */

import { buildExtractionPrompt, PROMPT_VERSION, DEFAULT_MODE } from './prompt.js';
import { chunk, estimateTokens, mergeResults } from './chunker.js';
import { validateAndParse } from './validator.js';
import { ERROR_CODES, ContentTooLargeError, CancelledError } from './errors.js';

const MIN_USEFUL_CONTENT_CHARS = 40;

/**
 * @param {object} args
 * @param {import('../providers/base.js').Provider} args.provider
 * @param {string} args.pageText
 * @param {string} [args.pageTitle]
 * @param {string} [args.pageUrl]
 * @param {string | null} [args.userHint]
 * @param {AbortSignal} [args.signal]
 * @param {(evt: { stage: string, pct: number }) => void} [args.onProgress]
 * @returns {Promise<object>} the stamped JSON result
 */
export async function extract(args) {
  const {
    provider,
    pageText,
    pageTitle,
    pageUrl,
    userHint,
    mode = DEFAULT_MODE,
    signal,
    onProgress,
  } = args;

  if (signal?.aborted) throw new CancelledError(ERROR_CODES.CANCELLED, 'Cancelled before start');
  if (!pageText || pageText.trim().length < MIN_USEFUL_CONTENT_CHARS) {
    throw new ContentTooLargeError(
      ERROR_CODES.CONTENT_EMPTY,
      `Page had no meaningful text after sanitization (got ${pageText?.trim().length ?? 0} chars)`,
      { context: { charCount: pageText?.trim().length ?? 0, url: pageUrl } },
    );
  }

  const providerMax = provider.maxInputTokens ?? 8_000;
  const chunks = chunk(pageText, { maxTokens: providerMax });

  onProgress?.({ stage: 'thinking', pct: 0.1 });

  const results = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (signal?.aborted)
      throw new CancelledError(ERROR_CODES.CANCELLED, 'Cancelled during extraction');

    const isMulti = chunks.length > 1;
    const chunkText = isMulti ? `(Chunk ${i + 1} of ${chunks.length})\n\n${chunks[i]}` : chunks[i];

    if (estimateTokens(chunkText) > providerMax) {
      throw new ContentTooLargeError(
        ERROR_CODES.CONTENT_TOO_LARGE,
        'Page exceeds the provider context window even after chunking',
        {
          context: {
            chunkIndex: i,
            providerId: provider.constructor.id,
            estimated: estimateTokens(chunkText),
            max: providerMax,
          },
        },
      );
    }

    const prompt = buildExtractionPrompt({
      pageText: chunkText,
      pageTitle,
      pageUrl,
      userHint,
      mode,
    });

    const response = await provider.complete({
      system: prompt.system,
      user: prompt.user,
      responseFormat: prompt.responseFormat,
      signal,
    });

    results.push(validateAndParse(response.text));
    onProgress?.({ stage: 'thinking', pct: 0.1 + (0.8 * (i + 1)) / chunks.length });
  }

  onProgress?.({ stage: 'parsing', pct: 0.95 });

  const merged = chunks.length === 1 ? results[0] : mergeResults(results);
  return stampMeta(merged, { pageUrl, userHint, mode, providerId: provider.constructor.id });
}

function stampMeta(result, { pageUrl, userHint, mode, providerId }) {
  const meta = {
    sourceUrl: pageUrl ?? null,
    extractedAt: new Date().toISOString(),
    userHint: (userHint ?? '').trim() || null,
    mode,
    promptVersion: PROMPT_VERSION,
    providerId,
    ...(result?.__meta ?? {}),
  };
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...result, __meta: meta };
  }
  return { value: result, __meta: meta };
}
