/**
 * Local extraction history.
 *
 * Every successful extraction is optionally persisted to `chrome.storage.local`
 * under the `history` key as a rolling array (newest first). The UI can list,
 * search, re-export, or delete entries. The whole archive never leaves the
 * user's browser.
 */

import { Storage } from './storage.js';

const HISTORY_KEY = 'history';
const MAX_ENTRIES = 100;
const MAX_BYTES_PER_ENTRY = 1_500_000;

export const History = {
  async list() {
    const raw = (await Storage.get(HISTORY_KEY, [])) ?? [];
    return Array.isArray(raw) ? raw : [];
  },

  async get(id) {
    const items = await History.list();
    return items.find((e) => e.id === id) ?? null;
  },

  async add(entry) {
    const id = entry.id ?? generateId();
    const serialized = safeStringify(entry.data);
    if (!serialized) return null;
    const sizeBytes = serialized.length;
    if (sizeBytes > MAX_BYTES_PER_ENTRY) {
      return History.add({ ...entry, data: truncateMarker(entry.data, sizeBytes) });
    }
    const record = {
      id,
      title: entry.title ?? '(untitled)',
      url: entry.url ?? '',
      mode: entry.mode ?? 'raw',
      extractedAt: entry.extractedAt ?? new Date().toISOString(),
      sizeBytes,
      providerId: entry.providerId ?? null,
      apiCalls: entry.apiCalls ?? 0,
      data: entry.data,
    };

    return Storage.update(HISTORY_KEY, (current) => {
      const existing = Array.isArray(current) ? current : [];
      const next = [record, ...existing.filter((e) => e.id !== id)];
      return next.slice(0, MAX_ENTRIES);
    });
  },

  async remove(id) {
    return Storage.update(HISTORY_KEY, (current) => {
      const existing = Array.isArray(current) ? current : [];
      return existing.filter((e) => e.id !== id);
    });
  },

  async clear() {
    return Storage.set(HISTORY_KEY, []);
  },

  async search(query) {
    const q = (query ?? '').toLowerCase().trim();
    const items = await History.list();
    if (!q) return items;
    return items.filter(
      (e) => e.title?.toLowerCase().includes(q) || e.url?.toLowerCase().includes(q),
    );
  },
};

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function truncateMarker(data, originalBytes) {
  return {
    ...data,
    __meta: {
      ...(data?.__meta ?? {}),
      historyTruncated: true,
      originalBytes,
    },
  };
}

function generateId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'h_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
