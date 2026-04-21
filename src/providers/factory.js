/**
 * Provider registry.
 *
 * Providers self-register at import time by calling `registerProvider`. The
 * popup, options page, and background orchestrator consult this registry via
 * `listProviders()` and `createProvider()`. Adding a new provider does not
 * require edits to this file.
 */

import { UnknownProviderError, ERROR_CODES } from '../core/errors.js';
import { logger } from '../core/logger.js';

const registry = new Map();

export function registerProvider(id, meta, ctor) {
  if (!id || typeof id !== 'string') {
    throw new Error('registerProvider: id must be a non-empty string');
  }
  if (registry.has(id)) {
    logger.warn(
      `Provider "${id}" is being re-registered; the earlier registration is overwritten.`,
    );
  }
  registry.set(id, { id, meta: Object.freeze({ ...meta }), ctor });
}

export function listProviders() {
  return [...registry.values()].map(({ id, meta }) => ({ id, meta }));
}

export function hasProvider(id) {
  return registry.has(id);
}

export function createProvider(id, config) {
  const entry = registry.get(id);
  if (!entry) {
    throw new UnknownProviderError(ERROR_CODES.PROVIDER_UNKNOWN, `Unknown provider: ${id}`, {
      context: { providerId: id, known: [...registry.keys()] },
    });
  }
  return new entry.ctor(config);
}

export function _resetRegistryForTests() {
  registry.clear();
}
