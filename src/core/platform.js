/**
 * Thin abstraction over the handful of browser-extension APIs JSnap uses.
 *
 * All higher layers import `Platform` from this module. `chrome.*` references
 * must not appear anywhere else in the codebase. A future Firefox port will
 * change only this file.
 */

const chromeApi = globalThis.chrome;

function assertChrome() {
  if (!chromeApi) {
    throw new Error('Platform: chrome.* is unavailable (running outside a browser extension context).');
  }
}

function promisify(apiCall) {
  return new Promise((resolve, reject) => {
    try {
      apiCall((result) => {
        const err = chromeApi.runtime?.lastError;
        if (err) reject(new Error(err.message ?? String(err)));
        else resolve(result);
      });
    } catch (e) {
      reject(e);
    }
  });
}

export const Platform = {
  storage: {
    get(keys) {
      assertChrome();
      return promisify((cb) => chromeApi.storage.local.get(keys, cb));
    },
    set(obj) {
      assertChrome();
      return promisify((cb) => chromeApi.storage.local.set(obj, cb));
    },
    remove(keys) {
      assertChrome();
      return promisify((cb) => chromeApi.storage.local.remove(keys, cb));
    },
    onChanged: {
      addListener(handler) {
        assertChrome();
        chromeApi.storage.onChanged.addListener(handler);
      },
      removeListener(handler) {
        assertChrome();
        chromeApi.storage.onChanged.removeListener(handler);
      },
    },
  },

  runtime: {
    sendMessage(msg) {
      assertChrome();
      return promisify((cb) => chromeApi.runtime.sendMessage(msg, cb));
    },
    onMessage: {
      addListener(handler) {
        assertChrome();
        chromeApi.runtime.onMessage.addListener(handler);
      },
    },
    getURL(path) {
      assertChrome();
      return chromeApi.runtime.getURL(path);
    },
    getManifest() {
      assertChrome();
      return chromeApi.runtime.getManifest();
    },
  },

  tabs: {
    query(q) {
      assertChrome();
      return promisify((cb) => chromeApi.tabs.query(q, cb));
    },
    get(tabId) {
      assertChrome();
      return promisify((cb) => chromeApi.tabs.get(tabId, cb));
    },
    sendMessage(tabId, msg) {
      assertChrome();
      return promisify((cb) => chromeApi.tabs.sendMessage(tabId, msg, cb));
    },
  },

  scripting: {
    executeScript(opts) {
      assertChrome();
      return chromeApi.scripting.executeScript(opts);
    },
  },

  i18n: {
    t(key, substitutions) {
      if (!chromeApi?.i18n) return key;
      const value = chromeApi.i18n.getMessage(key, substitutions);
      return value || key;
    },
    getUILanguage() {
      return chromeApi?.i18n?.getUILanguage?.() ?? 'en';
    },
  },
};
