/**
 * Groq provider.
 *
 * Uses the Groq OpenAI-compatible REST endpoint with native JSON mode via
 * `response_format: { type: 'json_object' }`. Free tier as of 2026-04:
 * no credit card required for most Llama models.
 *
 * API reference: https://console.groq.com/docs/openai
 */

import { Provider, CAPABILITIES } from './base.js';
import { registerProvider } from './factory.js';
import {
  ERROR_CODES,
  AuthError,
  RateLimitError,
  NetworkError,
  ProviderError,
  ConfigError,
} from '../core/errors.js';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const MODEL_LIMITS = Object.freeze({
  'llama-3.1-8b-instant': 128_000,
  'llama-3.3-70b-versatile': 128_000,
  'meta-llama/llama-4-scout-17b-16e-instruct': 128_000,
});

export class GroqProvider extends Provider {
  static id = 'groq';
  static meta = Object.freeze({
    displayName: 'Groq',
    requiresApiKey: true,
    docsUrl: 'https://console.groq.com/keys',
    freeTier: true,
    capabilities: { [CAPABILITIES.JSON_MODE]: true },
  });

  get supportsJsonMode() {
    return true;
  }

  get maxInputTokens() {
    return MODEL_LIMITS[this.config.model] ?? 32_000;
  }

  async complete({ system, user, responseFormat, signal }) {
    const apiKey = this.config.apiKey?.trim();
    if (!apiKey) {
      throw new ConfigError(ERROR_CODES.CONFIG_MISSING_KEY, 'Groq API key is not set', {
        context: { provider: 'groq' },
      });
    }

    const model = this.config.model || 'llama-3.1-8b-instant';

    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      ...(responseFormat?.type === 'json_object'
        ? { response_format: { type: 'json_object' } }
        : {}),
    };

    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new NetworkError(ERROR_CODES.PROVIDER_NETWORK, 'Could not reach Groq', { cause: err });
    }

    if (!response.ok) {
      await throwForStatus(response);
    }

    const payload = await response.json().catch((err) => {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'Groq returned non-JSON response', { cause: err });
    });

    const text = payload?.choices?.[0]?.message?.content ?? '';
    if (!text) {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'Groq returned an empty response', {
        context: { finishReason: payload?.choices?.[0]?.finish_reason ?? null },
      });
    }

    return {
      text,
      raw: payload,
      usage: {
        inputTokens: payload.usage?.prompt_tokens,
        outputTokens: payload.usage?.completion_tokens,
      },
    };
  }
}

async function throwForStatus(response) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  const status = response.status;
  const context = { status, detail };

  if (status === 401 || status === 403) {
    throw new AuthError(ERROR_CODES.PROVIDER_AUTH, 'Groq rejected the API key', { context });
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(response);
    throw new RateLimitError(ERROR_CODES.PROVIDER_RATE_LIMIT, 'Groq rate limit exceeded', {
      retryAfterMs,
      context,
    });
  }
  if (status >= 500) {
    throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `Groq server error (${status})`, { context });
  }
  throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `Groq request failed (${status})`, { context });
}

function parseRetryAfter(response) {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

registerProvider(GroqProvider.id, GroqProvider.meta, GroqProvider);
