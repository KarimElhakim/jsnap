/**
 * JSnap content script.
 *
 * Injected into every page at document_idle. Waits for a GET_PAGE_CONTENT
 * message from the background service worker, sanitizes the document, and
 * returns structured page data. Never reads settings or API keys.
 */

import { Platform } from '../core/platform.js';
import { sanitize } from './sanitizer.js';

Platform.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'GET_PAGE_CONTENT') return false;

  try {
    const data = sanitize(document);
    sendResponse({ ok: true, data });
  } catch (err) {
    sendResponse({ ok: false, error: String(err) });
  }

  return true; // keep channel open for async sendResponse
});
