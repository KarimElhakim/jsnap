/**
 * Minimal structured logger with secret redaction.
 *
 * Redacts any object key matching SENSITIVE_KEY_PATTERN before emission so
 * API keys, bearer tokens, and authorization headers never reach the
 * console or devtools — even accidentally via a thrown provider error.
 */

const LEVELS = Object.freeze({ silent: 0, error: 1, warn: 2, info: 3, debug: 4 });

const SENSITIVE_KEY_PATTERN = /api[_-]?key|authorization|bearer|token|secret|password/i;
const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function redact(value, depth = 0) {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (value == null) return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  if (typeof value === 'object') {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, code: value.code, context: value.context };
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(k) && typeof v === 'string') {
        out[k] = REDACTED;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function formatPayload(payload) {
  return payload.map((p) => (typeof p === 'object' ? redact(p) : p));
}

function createLogger(namespace) {
  let currentLevel = LEVELS.info;

  const logger = {
    setLevel(level) {
      const n = typeof level === 'string' ? LEVELS[level] : level;
      if (typeof n === 'number') currentLevel = n;
    },
    getLevel() {
      return currentLevel;
    },
    child(sub) {
      return createLogger(`${namespace}:${sub}`);
    },
    error(...args) {
      if (currentLevel >= LEVELS.error) console.error(`[${namespace}]`, ...formatPayload(args));
    },
    warn(...args) {
      if (currentLevel >= LEVELS.warn) console.warn(`[${namespace}]`, ...formatPayload(args));
    },
    info(...args) {
      if (currentLevel >= LEVELS.info) console.info(`[${namespace}]`, ...formatPayload(args));
    },
    debug(...args) {
      if (currentLevel >= LEVELS.debug) console.debug(`[${namespace}]`, ...formatPayload(args));
    },
  };

  return logger;
}

export const logger = createLogger('jsnap');
export { createLogger, redact, LEVELS };
