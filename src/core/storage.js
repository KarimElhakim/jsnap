/**
 * Versioned key-value storage wrapper over chrome.storage.local.
 *
 * `update(fn)` performs a read-modify-write in a single `set()` call and is
 * serialized against itself by a per-namespace promise chain, so concurrent
 * updates from the same service-worker instance do not race. Cross-process
 * races (popup + background writing simultaneously) remain possible but are
 * vanishingly rare for our usage patterns — the UI writes settings, the
 * background reads them.
 */

import { Platform } from './platform.js';

export const SETTINGS_SCHEMA_VERSION = 1;

const NAMESPACE = 'jsnap';
const SCHEMA_VERSION_KEY = `${NAMESPACE}.schemaVersion`;

let updateChain = Promise.resolve();

function scopedKey(key) {
  return `${NAMESPACE}.${key}`;
}

function unscope(scoped) {
  return scoped.startsWith(`${NAMESPACE}.`) ? scoped.slice(NAMESPACE.length + 1) : scoped;
}

export const Storage = {
  async get(key, fallback = null) {
    const scoped = scopedKey(key);
    const result = await Platform.storage.get(scoped);
    return Object.prototype.hasOwnProperty.call(result, scoped) ? result[scoped] : fallback;
  },

  async set(key, value) {
    await Platform.storage.set({ [scopedKey(key)]: value });
  },

  async remove(key) {
    await Platform.storage.remove(scopedKey(key));
  },

  /**
   * Serialized read-modify-write against a single key.
   *
   * @param {string} key
   * @param {(current: unknown) => unknown | Promise<unknown>} mutator
   * @returns {Promise<unknown>} the new value
   */
  update(key, mutator) {
    const run = async () => {
      const current = await Storage.get(key, null);
      const next = await mutator(current);
      await Storage.set(key, next);
      return next;
    };
    updateChain = updateChain.then(run, run);
    return updateChain;
  },

  subscribe(key, handler) {
    const scoped = scopedKey(key);
    const listener = (changes, area) => {
      if (area !== 'local') return;
      if (Object.prototype.hasOwnProperty.call(changes, scoped)) {
        handler(changes[scoped].newValue, changes[scoped].oldValue);
      }
    };
    Platform.storage.onChanged.addListener(listener);
    return () => Platform.storage.onChanged.removeListener(listener);
  },

  async migrate(migrations = []) {
    const current = (await Storage.get(unscope(SCHEMA_VERSION_KEY), 0)) ?? 0;
    if (current >= SETTINGS_SCHEMA_VERSION) return current;

    for (const m of migrations) {
      if (m.from === current) {
        await m.run({ get: Storage.get, set: Storage.set });
      }
    }
    await Storage.set(unscope(SCHEMA_VERSION_KEY), SETTINGS_SCHEMA_VERSION);
    return SETTINGS_SCHEMA_VERSION;
  },
};
