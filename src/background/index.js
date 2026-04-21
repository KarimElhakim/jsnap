/**
 * JSnap background service worker.
 *
 * Composition root: wires the message router to the extractor pipeline.
 * MV3 service workers can be evicted between messages, so this file holds
 * no durable state at module scope beyond the abort-controller map for
 * in-flight requests (which is acceptable because a SW eviction naturally
 * cancels any in-flight request it owned).
 */

import { Platform } from '../core/platform.js';
import { Settings } from '../core/settings.js';
import { Storage } from '../core/storage.js';
import { extract } from '../core/extractor.js';
import { logger } from '../core/logger.js';
import { createDispatcher, MESSAGE_TYPES, message } from './router.js';
import { createProvider, listProviders } from '../providers/factory.js';
import {
  ERROR_CODES,
  ConfigError,
  JSnapError,
  toJSnapError,
} from '../core/errors.js';

import '../providers/gemini.js';
import '../providers/groq.js';
import '../providers/ollama.js';
import '../providers/openai-compatible.js';

const inFlight = new Map();

const { on, listener } = createDispatcher();

Platform.runtime.onMessage.addListener(listener);

on(MESSAGE_TYPES.PING, () => ({ ok: true, at: Date.now() }));

on(MESSAGE_TYPES.LIST_PROVIDERS, () => listProviders());

on(MESSAGE_TYPES.GET_SETTINGS, () => Settings.getAll());

on(MESSAGE_TYPES.SET_SETTINGS, async ({ patch }) => {
  if (!patch || typeof patch !== 'object') {
    throw new ConfigError(ERROR_CODES.CONFIG_INVALID, 'patch must be an object');
  }
  return Settings.update(patch);
});

on(MESSAGE_TYPES.GET_USAGE, async ({ providerId }) => {
  if (!providerId) return { date: null, count: 0 };
  return Settings.getUsage(providerId);
});

on(MESSAGE_TYPES.CANCEL_REQUEST, ({ requestId }) => {
  const ctrl = inFlight.get(requestId);
  if (ctrl) {
    ctrl.abort();
    inFlight.delete(requestId);
    return { cancelled: true };
  }
  return { cancelled: false };
});

on(MESSAGE_TYPES.EXTRACT_REQUEST, async (payload) => {
  const { tabId, providerId, hint, requestId } = payload ?? {};
  if (!tabId || !providerId || !requestId) {
    throw new ConfigError(ERROR_CODES.CONFIG_INVALID, 'tabId, providerId, and requestId are required');
  }
  runExtraction({ tabId, providerId, hint, requestId }).catch((err) => {
    logger.error('Extraction rejected unexpectedly', err);
  });
  return { accepted: true, requestId };
});

async function runExtraction({ tabId, providerId, hint, requestId }) {
  const controller = new AbortController();
  inFlight.set(requestId, controller);

  const push = (type, payload) => {
    Platform.runtime.sendMessage(message(type, { requestId, ...payload })).catch(() => {
      /* popup may have closed — harmless */
    });
  };

  try {
    push(MESSAGE_TYPES.EXTRACT_PROGRESS, { stage: 'fetching', pct: 0.05 });

    const pageResponse = await Platform.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' });
    if (!pageResponse?.ok) {
      throw new JSnapError(ERROR_CODES.CONTENT_EMPTY, pageResponse?.error ?? 'Content script returned no data');
    }
    const page = pageResponse.data;

    const providerConfig = (await Settings.getProviderConfig(providerId)) ?? {};
    const provider = createProvider(providerId, providerConfig);

    const result = await extract({
      provider,
      pageText: page.text,
      pageTitle: page.title,
      pageUrl: page.url,
      userHint: hint,
      signal: controller.signal,
      onProgress: (evt) => push(MESSAGE_TYPES.EXTRACT_PROGRESS, evt),
    });

    await Settings.incrementUsage(providerId);
    push(MESSAGE_TYPES.EXTRACT_RESULT, { ok: true, data: result });
  } catch (err) {
    if (err?.name === 'AbortError') {
      push(MESSAGE_TYPES.EXTRACT_RESULT, {
        ok: false,
        error: { code: ERROR_CODES.CANCELLED, message: 'Cancelled' },
      });
      return;
    }
    const normalized = toJSnapError(err);
    logger.error('Extraction failed', normalized);
    push(MESSAGE_TYPES.EXTRACT_RESULT, { ok: false, error: normalized.toJSON() });
  } finally {
    inFlight.delete(requestId);
  }
}

globalThis.addEventListener?.('install', () => {
  Storage.migrate().catch((err) => logger.error('Migration failed', err));
});
