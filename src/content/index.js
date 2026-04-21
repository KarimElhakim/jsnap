/**
 * JSnap content script.
 *
 * Injected statically via manifest.content_scripts on document_idle, and
 * re-injectable on demand via scripting.executeScript for pre-existing tabs
 * that predate the extension install. Guarded so duplicate injections do not
 * register duplicate message listeners.
 *
 * Never reads settings or API keys.
 */

import { Platform } from '../core/platform.js';
import { sanitize } from './sanitizer.js';
import { extractStructured } from './structured.js';

const LOAD_FLAG = '__jsnapContentLoaded';

if (!globalThis[LOAD_FLAG]) {
  globalThis[LOAD_FLAG] = true;

  Platform.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;

    if (msg.type === 'GET_PAGE_CONTENT') {
      try {
        sendResponse({ ok: true, data: sanitize(document) });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
      return true;
    }

    if (msg.type === 'GET_PAGE_STRUCTURED') {
      try {
        sendResponse({ ok: true, data: extractStructured(document) });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
      return true;
    }

    return false;
  });
}
