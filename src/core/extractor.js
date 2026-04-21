/**
 * Provider-agnostic extraction orchestrator.
 *
 * Two execution paths:
 *
 *  - **Section-wise** (Structure mode on multi-section documents): split the
 *    page by `#`/`##` headings and issue one API call per section, each
 *    producing a small JSON fragment. Results are merged into
 *    `{ title, sections: [...], __meta }`. This is how we handle documents
 *    that would otherwise blow past a provider's output-token ceiling.
 *
 *  - **Single-shot** (Summary, Data, or short Structure documents): one API
 *    call covers the whole page.
 *
 * No `chrome.*`, no storage, no side effects beyond the injected provider's
 * `complete()` calls.
 */

import {
  buildExtractionPrompt,
  buildSectionPrompt,
  PROMPT_VERSION,
  MODES,
  DEFAULT_MODE,
} from './prompt.js';
import { chunk, estimateTokens, splitBySections } from './chunker.js';
import { validateAndParse } from './validator.js';
import { ERROR_CODES, ContentTooLargeError, CancelledError } from './errors.js';

const MIN_USEFUL_CONTENT_CHARS = 40;
const SINGLE_SHOT_TOKEN_CEILING = 6_000;

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

  if (mode === MODES.STRUCTURE) {
    const sections = splitBySections(pageText);
    const totalTokens = estimateTokens(pageText);
    if (sections.length >= 2 && totalTokens > SINGLE_SHOT_TOKEN_CEILING) {
      return sectionwiseExtract({
        provider,
        pageTitle,
        pageUrl,
        userHint,
        mode,
        signal,
        onProgress,
        sections,
      });
    }
  }

  return singleShotExtract({
    provider,
    pageText,
    pageTitle,
    pageUrl,
    userHint,
    mode,
    signal,
    onProgress,
  });
}

async function singleShotExtract({
  provider,
  pageText,
  pageTitle,
  pageUrl,
  userHint,
  mode,
  signal,
  onProgress,
}) {
  const providerMax = provider.maxInputTokens ?? 8_000;
  const chunks = chunk(pageText, { maxTokens: providerMax });

  onProgress?.({ stage: 'thinking', pct: 0.1 });

  const results = [];
  for (let i = 0; i < chunks.length; i += 1) {
    if (signal?.aborted)
      throw new CancelledError(ERROR_CODES.CANCELLED, 'Cancelled during extraction');
    const chunkText =
      chunks.length > 1 ? `(Chunk ${i + 1} of ${chunks.length})\n\n${chunks[i]}` : chunks[i];

    if (estimateTokens(chunkText) > providerMax) {
      throw new ContentTooLargeError(
        ERROR_CODES.CONTENT_TOO_LARGE,
        'Page exceeds the provider context window even after chunking',
        { context: { chunkIndex: i, providerId: provider.constructor.id } },
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

  const merged = chunks.length === 1 ? results[0] : mergeSingleShotResults(results);
  return stampMeta(merged, { pageUrl, userHint, mode, providerId: provider.constructor.id });
}

async function sectionwiseExtract({
  provider,
  pageTitle,
  pageUrl,
  userHint,
  mode,
  signal,
  onProgress,
  sections,
}) {
  const total = sections.length;
  const results = [];

  for (let i = 0; i < total; i += 1) {
    if (signal?.aborted)
      throw new CancelledError(ERROR_CODES.CANCELLED, 'Cancelled during extraction');
    const section = sections[i];

    onProgress?.({
      stage: 'thinking',
      pct: 0.05 + (0.9 * i) / total,
      sectionIndex: i + 1,
      sectionTotal: total,
      sectionHeading: section.heading,
    });

    const prompt = buildSectionPrompt({
      pageTitle,
      pageUrl,
      userHint,
      sectionHeading: section.heading,
      sectionText: section.text,
      sectionIndex: i + 1,
      sectionTotal: total,
    });

    const response = await provider.complete({
      system: prompt.system,
      user: prompt.user,
      responseFormat: prompt.responseFormat,
      signal,
    });

    results.push(validateAndParse(response.text));
  }

  onProgress?.({ stage: 'parsing', pct: 0.97 });

  const merged = {
    title: pageTitle ?? null,
    url: pageUrl ?? null,
    sections: results,
  };

  return stampMeta(merged, {
    pageUrl,
    userHint,
    mode,
    providerId: provider.constructor.id,
    sectionCount: total,
  });
}

function mergeSingleShotResults(results) {
  if (results.length === 1) return results[0];
  const out = { __meta: { chunks: results.length } };
  results.forEach((r, i) => {
    out[`chunk_${i + 1}`] = r;
  });
  return out;
}

function stampMeta(result, { pageUrl, userHint, mode, providerId, sectionCount }) {
  const meta = {
    sourceUrl: pageUrl ?? null,
    extractedAt: new Date().toISOString(),
    userHint: (userHint ?? '').trim() || null,
    mode,
    promptVersion: PROMPT_VERSION,
    providerId,
    ...(sectionCount ? { sectionCount } : {}),
    ...(result?.__meta ?? {}),
  };
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return { ...result, __meta: meta };
  }
  return { value: result, __meta: meta };
}
