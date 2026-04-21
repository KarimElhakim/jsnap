/**
 * Versioned message contract between popup / options / content / background.
 *
 * Every message carries `{ v, type, payload }`. Handlers are registered in a
 * single map and dispatched by type. Unknown types return a typed error. The
 * version field lets us break shape cleanly later without silently breaking
 * older popups.
 */

import { toJSnapError, ERROR_CODES } from '../core/errors.js';
import { logger } from '../core/logger.js';

export const MESSAGE_VERSION = 1;

export const MESSAGE_TYPES = Object.freeze({
  EXTRACT_REQUEST: 'EXTRACT_REQUEST',
  EXTRACT_PROGRESS: 'EXTRACT_PROGRESS',
  EXTRACT_RESULT: 'EXTRACT_RESULT',
  CANCEL_REQUEST: 'CANCEL_REQUEST',
  LIST_PROVIDERS: 'LIST_PROVIDERS',
  GET_SETTINGS: 'GET_SETTINGS',
  SET_SETTINGS: 'SET_SETTINGS',
  GET_USAGE: 'GET_USAGE',
  PING: 'PING',
});

export function message(type, payload = {}) {
  return { v: MESSAGE_VERSION, type, payload };
}

export function isMessage(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.type === 'string' &&
    typeof value.v === 'number'
  );
}

/**
 * Builds a dispatcher: register typed handlers, return a function suitable
 * for `Platform.runtime.onMessage.addListener(...)`.
 *
 * Handlers may return a value or a Promise; both are awaited and the result
 * is returned to the sender. Thrown errors are normalized through
 * `toJSnapError` and returned as `{ ok: false, error: ... }` so the caller
 * can switch on `error.code`.
 */
export function createDispatcher() {
  const handlers = new Map();

  function on(type, handler) {
    handlers.set(type, handler);
  }

  function listener(msg, sender, sendResponse) {
    if (!isMessage(msg)) {
      sendResponse({
        ok: false,
        error: { code: ERROR_CODES.INTERNAL, message: 'Malformed message' },
      });
      return false;
    }
    if (msg.v !== MESSAGE_VERSION) {
      sendResponse({
        ok: false,
        error: {
          code: ERROR_CODES.INTERNAL,
          message: `Unsupported message version: ${msg.v} (expected ${MESSAGE_VERSION})`,
        },
      });
      return false;
    }

    const handler = handlers.get(msg.type);
    if (!handler) {
      sendResponse({
        ok: false,
        error: { code: ERROR_CODES.INTERNAL, message: `No handler for type: ${msg.type}` },
      });
      return false;
    }

    Promise.resolve()
      .then(() => handler(msg.payload ?? {}, sender))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => {
        const normalized = toJSnapError(err);
        logger.error('dispatch error', { type: msg.type, error: normalized });
        sendResponse({ ok: false, error: normalized.toJSON() });
      });

    return true;
  }

  return { on, listener };
}
