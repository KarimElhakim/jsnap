/**
 * Typed error hierarchy for JSnap.
 *
 * Every thrown error in this codebase is a subclass of JSnapError with a
 * stable, machine-readable `code`. UI code switches on `error.code`, never
 * on `error.message`. Error messages are intended for logs and developer
 * diagnostics; user-facing copy is rendered in the UI layer via i18n keys
 * derived from `code`.
 */

export const ERROR_CODES = Object.freeze({
  CONFIG_MISSING_KEY: 'config.missing_key',
  CONFIG_INVALID: 'config.invalid',

  PROVIDER_UNKNOWN: 'provider.unknown',
  PROVIDER_FAILED: 'provider.failed',
  PROVIDER_AUTH: 'provider.auth',
  PROVIDER_RATE_LIMIT: 'provider.rate_limit',
  PROVIDER_NETWORK: 'provider.network',
  PROVIDER_TIMEOUT: 'provider.timeout',

  SCHEMA_INVALID: 'schema.invalid',
  SCHEMA_UNREPAIRABLE: 'schema.unrepairable',

  CONTENT_TOO_LARGE: 'content.too_large',
  CONTENT_EMPTY: 'content.empty',

  CANCELLED: 'cancelled',
  INTERNAL: 'internal',
});

export class JSnapError extends Error {
  /**
   * @param {string} code   stable code (see ERROR_CODES)
   * @param {string} message developer-facing message
   * @param {{ cause?: unknown, context?: Record<string, unknown> }} [opts]
   */
  constructor(code, message, { cause, context } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = cause;
    this.context = context ?? {};
  }

  /**
   * Safe serialization for message-passing across extension contexts.
   * Never includes `cause` because it may contain secrets or non-cloneable values.
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
    };
  }
}

export class ConfigError extends JSnapError {}
export class ProviderError extends JSnapError {}
export class AuthError extends ProviderError {}
export class NetworkError extends ProviderError {}
export class TimeoutError extends ProviderError {}

export class RateLimitError extends ProviderError {
  constructor(code, message, { retryAfterMs, cause, context } = {}) {
    super(code, message, { cause, context });
    this.retryAfterMs = retryAfterMs ?? null;
  }

  toJSON() {
    return { ...super.toJSON(), retryAfterMs: this.retryAfterMs };
  }
}

export class SchemaError extends JSnapError {}
export class ContentTooLargeError extends JSnapError {}
export class CancelledError extends JSnapError {}
export class UnknownProviderError extends JSnapError {}

/**
 * Wrap an unknown value into a JSnapError. Used at message-passing boundaries
 * where a value might be a native Error, a serialized JSnapError, or a plain string.
 */
export function toJSnapError(value, fallbackCode = ERROR_CODES.INTERNAL) {
  if (value instanceof JSnapError) return value;
  if (value instanceof Error) {
    return new JSnapError(fallbackCode, value.message, { cause: value });
  }
  if (value && typeof value === 'object' && typeof value.code === 'string') {
    const err = new JSnapError(value.code, value.message ?? '', { context: value.context });
    err.name = value.name ?? 'JSnapError';
    return err;
  }
  return new JSnapError(fallbackCode, String(value ?? 'Unknown error'));
}
