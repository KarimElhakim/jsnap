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
const RESTRICTED_URL_PATTERNS = [
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  /^edge:\/\//i,
  /^about:/i,
  /^view-source:/i,
  /^https:\/\/chromewebstore\.google\.com\//i,
  /^https:\/\/chrome\.google\.com\/webstore\//i,
];

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
  const { tabId, providerId, hint, mode, requestId } = payload ?? {};
  if (!tabId || !providerId || !requestId) {
    throw new ConfigError(ERROR_CODES.CONFIG_INVALID, 'tabId, providerId, and requestId are required');
  }
  runExtraction({ tabId, providerId, hint, mode, requestId }).catch((err) => {
    logger.error('Extraction rejected unexpectedly', err);
  });
  return { accepted: true, requestId };
});

async function runExtraction({ tabId, providerId, hint, mode, requestId }) {
  const controller = new AbortController();
  inFlight.set(requestId, controller);

  const push = (type, extra) => {
    Platform.runtime.sendMessage(message(type, { requestId, ...extra })).catch(() => {});
  };

  try {
    push(MESSAGE_TYPES.EXTRACT_PROGRESS, { stage: 'fetching', pct: 0.1 });

    const tab = await Platform.tabs.get(tabId).catch(() => null);
    if (tab?.url && RESTRICTED_URL_PATTERNS.some((re) => re.test(tab.url))) {
      throw new JSnapError(
        ERROR_CODES.CONTENT_EMPTY,
        'This page does not allow extensions. Try a regular website.',
        { context: { url: tab.url, reason: 'restricted_url' } },
      );
    }

    // Raw mode: no LLM, pull the structured JSON straight from the page.
    if (mode === 'raw') {
      push(MESSAGE_TYPES.EXTRACT_PROGRESS, { stage: 'thinking', pct: 0.5 });
      const result = await fetchStructuredContent(tabId);
      push(MESSAGE_TYPES.EXTRACT_PROGRESS, { stage: 'parsing', pct: 0.95 });
      push(MESSAGE_TYPES.EXTRACT_RESULT, { ok: true, data: result });
      return;
    }

    const page = await fetchPageContent(tabId);

    const providerConfig = (await Settings.getProviderConfig(providerId)) ?? {};
    const provider = createProvider(providerId, providerConfig);

    const result = await extract({
      provider,
      pageText: page.text,
      pageTitle: page.title,
      pageUrl: page.url,
      userHint: hint,
      mode,
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

async function fetchPageContent(tabId) {
  return sendToTabWithInjection(tabId, { type: 'GET_PAGE_CONTENT' });
}

async function fetchStructuredContent(tabId) {
  return sendToTabWithInjection(tabId, { type: 'GET_PAGE_STRUCTURED' });
}

async function sendToTabWithInjection(tabId, message) {
  try {
    const response = await Platform.tabs.sendMessage(tabId, message);
    if (response?.ok) return response.data;
    throw new JSnapError(ERROR_CODES.CONTENT_EMPTY, response?.error ?? 'Content script returned no data');
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (!msg.includes('Could not establish connection') && !msg.includes('Receiving end does not exist')) {
      throw err;
    }
  }

  logger.info('Content script not present; injecting on demand', { tabId });

  const contentScriptPath = findContentScriptPath();
  if (!contentScriptPath) {
    throw new JSnapError(
      ERROR_CODES.CONTENT_EMPTY,
      'Could not locate the content script in the extension bundle.',
      { context: { reason: 'content_script_not_found' } },
    );
  }

  try {
    await Platform.scripting.executeScript({ target: { tabId }, files: [contentScriptPath] });
  } catch (err) {
    throw new JSnapError(
      ERROR_CODES.CONTENT_EMPTY,
      'Unable to access this page. Try reloading the tab, or open a regular website.',
      { context: { reason: 'inject_failed', detail: String(err?.message ?? err) } },
    );
  }

  const response = await Platform.tabs.sendMessage(tabId, message);
  if (response?.ok) return response.data;
  throw new JSnapError(ERROR_CODES.CONTENT_EMPTY, response?.error ?? 'Content script returned no data after injection');
}

function findContentScriptPath() {
  const manifest = Platform.runtime.getManifest();
  const entry = manifest?.content_scripts?.[0]?.js?.[0];
  return entry ?? null;
}

globalThis.addEventListener?.('install', () => {
  Storage.migrate().catch((err) => logger.error('Migration failed', err));
});
