/**
 * Typed settings accessor.
 *
 * The full settings blob is stored under a single key (`settings`) so every
 * update is a single atomic `set()`. Provider configs live under
 * `settings.providers[<id>]` with provider-specific shapes.
 *
 * Never import this module from content scripts — API keys must live only in
 * background/popup contexts.
 */

import { Storage } from './storage.js';

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: 1,
  defaultProviderId: 'gemini',
  providers: {
    gemini: { apiKey: '', model: 'gemini-2.5-flash' },
    groq: { apiKey: '', model: 'llama-3.1-8b-instant' },
    ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
    'openai-compatible': { baseUrl: '', apiKey: '', model: '' },
  },
  ui: { theme: 'system', locale: 'auto' },
  usage: {},
});

function deepMerge(base, patch) {
  if (patch == null || typeof patch !== 'object') return patch;
  if (Array.isArray(patch)) return patch.slice();
  const out = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(base?.[k], v) : v;
  }
  return out;
}

export const Settings = {
  async getAll() {
    const stored = await Storage.get(SETTINGS_KEY, null);
    return stored ? deepMerge(DEFAULT_SETTINGS, stored) : { ...DEFAULT_SETTINGS };
  },

  async update(patch) {
    return Storage.update(SETTINGS_KEY, (current) => {
      const base = current ?? DEFAULT_SETTINGS;
      return deepMerge(base, patch);
    });
  },

  async getProviderConfig(id) {
    const all = await Settings.getAll();
    return all.providers?.[id] ?? null;
  },

  async setProviderConfig(id, patch) {
    return Settings.update({ providers: { [id]: patch } });
  },

  async getDefaultProviderId() {
    const all = await Settings.getAll();
    return all.defaultProviderId;
  },

  async setDefaultProviderId(id) {
    return Settings.update({ defaultProviderId: id });
  },

  async getUsage(providerId) {
    const all = await Settings.getAll();
    return all.usage?.[providerId] ?? { date: null, count: 0 };
  },

  async incrementUsage(providerId) {
    const today = new Date().toISOString().slice(0, 10);
    return Storage.update(SETTINGS_KEY, (current) => {
      const base = current ?? DEFAULT_SETTINGS;
      const prev = base.usage?.[providerId] ?? { date: today, count: 0 };
      const count = prev.date === today ? prev.count + 1 : 1;
      return deepMerge(base, { usage: { [providerId]: { date: today, count } } });
    });
  },

  subscribe(handler) {
    return Storage.subscribe(SETTINGS_KEY, (newValue) => handler(newValue ?? DEFAULT_SETTINGS));
  },
};
