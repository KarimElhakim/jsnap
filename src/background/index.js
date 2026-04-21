/**
 * JSnap background service worker.
 *
 * Composition root: wires message router, keyboard commands, and context
 * menus to the extractor pipeline and the download helper. MV3 service
 * workers can be evicted between messages, so no durable state lives at
 * module scope beyond the abort-controller map.
 */

import { Platform } from '../core/platform.js';
import { Settings } from '../core/settings.js';
import { Storage } from '../core/storage.js';
import { History } from '../core/history.js';
import { extract } from '../core/extractor.js';
import { logger } from '../core/logger.js';
import { downloadResult } from '../core/download.js';
import { createDispatcher, MESSAGE_TYPES, message } from './router.js';
import { createProvider, listProviders } from '../providers/factory.js';
import { ERROR_CODES, ConfigError, JSnapError, toJSnapError } from '../core/errors.js';

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
on(MESSAGE_TYPES.GET_HISTORY, ({ query } = {}) => (query ? History.search(query) : History.list()));
on(MESSAGE_TYPES.DELETE_HISTORY, ({ id }) => History.remove(id));
on(MESSAGE_TYPES.CLEAR_HISTORY, () => History.clear());

on(MESSAGE_TYPES.EXTRACT_REQUEST, async (payload) => {
  const { tabId, providerId, hint, mode, requestId, selectionText } = payload ?? {};
  if (!tabId || !requestId) {
    throw new ConfigError(ERROR_CODES.CONFIG_INVALID, 'tabId and requestId are required');
  }
  runExtraction({ tabId, providerId, hint, mode, requestId, selectionText }).catch((err) => {
    logger.error('Extraction rejected unexpectedly', err);
  });
  return { accepted: true, requestId };
});

on(MESSAGE_TYPES.EXTRACT_ALL_TABS, async (payload) => {
  const { requestId } = payload ?? {};
  if (!requestId) throw new ConfigError(ERROR_CODES.CONFIG_INVALID, 'requestId is required');
  runAllTabsExtraction(requestId).catch((err) => logger.error('All-tabs extraction failed', err));
  return { accepted: true, requestId };
});

async function runExtraction({ tabId, providerId, hint, mode, requestId, selectionText }) {
  const controller = new AbortController();
  inFlight.set(requestId, controller);
  const autoDownload = requestId.startsWith('kb_') || requestId.startsWith('ctx_');

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

    let data;
    if (mode === 'raw') {
      push(MESSAGE_TYPES.EXTRACT_PROGRESS, { stage: 'thinking', pct: 0.5 });
      data = await fetchStructuredContent(tabId);
      if (selectionText) narrowToSelection(data, selectionText);
      push(MESSAGE_TYPES.EXTRACT_PROGRESS, { stage: 'parsing', pct: 0.95 });
    } else {
      const page = await fetchPageContent(tabId);
      const pageText = selectionText || page.text;
      const providerConfig = (await Settings.getProviderConfig(providerId)) ?? {};
      const provider = createProvider(providerId, providerConfig);
      data = await extract({
        provider,
        pageText,
        pageTitle: page.title,
        pageUrl: page.url,
        userHint: hint,
        mode,
        signal: controller.signal,
        onProgress: (evt) => push(MESSAGE_TYPES.EXTRACT_PROGRESS, evt),
      });
      const calls = Number(data?.__meta?.apiCalls) || 1;
      await Settings.incrementUsage(providerId, calls);
    }

    await saveToHistory(data);

    if (autoDownload) {
      try {
        await downloadResult(data, { format: 'json', saveAs: true });
        Platform.notifications.create({
          type: 'basic',
          iconUrl: Platform.runtime.getURL('icons/icon-128.png'),
          title: 'JSnap',
          message: `Saved: ${data?.title ?? tab?.title ?? 'page'}`,
        });
      } catch (err) {
        logger.warn('Auto-download failed', err);
      }
    }

    push(MESSAGE_TYPES.EXTRACT_RESULT, { ok: true, data });
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

async function runAllTabsExtraction(requestId) {
  const push = (type, extra) => {
    Platform.runtime.sendMessage(message(type, { requestId, ...extra })).catch(() => {});
  };

  try {
    const tabs = await Platform.tabs.query({ currentWindow: true });
    const eligible = tabs.filter(
      (t) => t.url && !RESTRICTED_URL_PATTERNS.some((re) => re.test(t.url)),
    );
    const total = eligible.length;
    if (!total) {
      throw new JSnapError(ERROR_CODES.CONTENT_EMPTY, 'No eligible tabs to extract.');
    }

    const folder = `jsnap-batch-${new Date().toISOString().replace(/[:]/g, '-').slice(0, 19)}`;
    const summary = [];
    let savedCount = 0;

    for (let i = 0; i < total; i += 1) {
      const tab = eligible[i];
      push(MESSAGE_TYPES.EXTRACT_PROGRESS, {
        stage: 'thinking',
        pct: 0.05 + (0.9 * i) / total,
        sectionIndex: i + 1,
        sectionTotal: total,
        sectionHeading: tab.title?.slice(0, 60) ?? tab.url,
      });
      try {
        const data = await fetchStructuredContent(tab.id);
        await saveToHistory(data);
        await downloadResult(data, { format: 'json', saveAs: false, prefix: folder });
        summary.push({ title: tab.title, url: tab.url, ok: true });
        savedCount += 1;
      } catch (err) {
        summary.push({
          title: tab.title,
          url: tab.url,
          ok: false,
          error: String(err?.message ?? err),
        });
      }
    }

    Platform.notifications.create({
      type: 'basic',
      iconUrl: Platform.runtime.getURL('icons/icon-128.png'),
      title: 'JSnap',
      message: `Saved ${savedCount} of ${total} tabs into Downloads/${folder}/`,
    });

    push(MESSAGE_TYPES.EXTRACT_RESULT, {
      ok: true,
      data: {
        kind: 'jsnap-batch-summary',
        folder,
        savedCount,
        totalCount: total,
        tabs: summary,
        __meta: { schemaVersion: '2.1', mode: 'raw-batch' },
      },
    });
  } catch (err) {
    const normalized = toJSnapError(err);
    logger.error('All-tabs extraction failed', normalized);
    push(MESSAGE_TYPES.EXTRACT_RESULT, { ok: false, error: normalized.toJSON() });
  }
}

function narrowToSelection(result, selectionText) {
  if (!result || !selectionText) return;
  const needle = selectionText.trim().toLowerCase();
  if (!needle) return;
  result.__meta = { ...(result.__meta ?? {}), selectionNarrowed: true };
  if (!Array.isArray(result.sections)) return;
  result.sections = result.sections.filter((s) => sectionMatches(s, needle));
}

function sectionMatches(section, needle) {
  if (!section) return false;
  if (section.heading?.toLowerCase().includes(needle)) return true;
  for (const b of section.blocks ?? []) {
    if (b?.text?.toLowerCase().includes(needle)) return true;
    if (Array.isArray(b?.items) && b.items.some((i) => String(i).toLowerCase().includes(needle)))
      return true;
  }
  return (section.subsections ?? []).some((s) => sectionMatches(s, needle));
}

async function saveToHistory(data) {
  try {
    await History.add({
      title: data?.title ?? '(untitled)',
      url: data?.url ?? data?.__meta?.sourceUrl ?? '',
      mode: data?.__meta?.mode ?? 'raw',
      extractedAt: data?.__meta?.extractedAt ?? new Date().toISOString(),
      providerId: data?.__meta?.providerId ?? null,
      apiCalls: data?.__meta?.apiCalls ?? 0,
      data,
    });
  } catch (err) {
    logger.warn('History save failed', err);
  }
}

async function fetchPageContent(tabId) {
  return sendToTabWithInjection(tabId, { type: 'GET_PAGE_CONTENT' });
}

async function fetchStructuredContent(tabId) {
  return sendToTabWithInjection(tabId, { type: 'GET_PAGE_STRUCTURED' });
}

async function sendToTabWithInjection(tabId, msg) {
  try {
    const response = await Platform.tabs.sendMessage(tabId, msg);
    if (response?.ok) return response.data;
    throw new JSnapError(
      ERROR_CODES.CONTENT_EMPTY,
      response?.error ?? 'Content script returned no data',
    );
  } catch (err) {
    const em = String(err?.message ?? err);
    if (
      !em.includes('Could not establish connection') &&
      !em.includes('Receiving end does not exist')
    ) {
      throw err;
    }
  }

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

  const response = await Platform.tabs.sendMessage(tabId, msg);
  if (response?.ok) return response.data;
  throw new JSnapError(
    ERROR_CODES.CONTENT_EMPTY,
    response?.error ?? 'Content script returned no data after injection',
  );
}

function findContentScriptPath() {
  const manifest = Platform.runtime.getManifest();
  return manifest?.content_scripts?.[0]?.js?.[0] ?? null;
}

/* ── Keyboard commands and context menus ──────────────────────────────── */

Platform.commands.onCommand.addListener(async (commandName) => {
  if (commandName !== 'extract-current-page') return;
  const [tab] = await Platform.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  runExtraction({
    tabId: tab.id,
    providerId: null,
    hint: null,
    mode: 'raw',
    requestId: `kb_${Date.now()}`,
  }).catch((err) => logger.error('Keyboard-triggered extraction failed', err));
});

async function registerContextMenus() {
  await Platform.contextMenus.removeAll();
  Platform.contextMenus.create({
    id: 'jsnap-save-page',
    title: 'Save this page as JSON',
    contexts: ['page'],
  });
  Platform.contextMenus.create({
    id: 'jsnap-save-selection',
    title: 'Save selected text as JSON',
    contexts: ['selection'],
  });
}

Platform.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const selectionText = info.menuItemId === 'jsnap-save-selection' ? info.selectionText : null;
  runExtraction({
    tabId: tab.id,
    providerId: null,
    hint: null,
    mode: 'raw',
    requestId: `ctx_${Date.now()}`,
    selectionText,
  }).catch((err) => logger.error('Context-menu extraction failed', err));
});

registerContextMenus().catch((err) => logger.warn('Context menu registration failed', err));

globalThis.addEventListener?.('install', () => {
  Storage.migrate().catch((err) => logger.error('Migration failed', err));
  registerContextMenus().catch(() => {});
});
