/**
 * Google Gemini provider.
 *
 * Uses Gemini's REST `generateContent` endpoint with native JSON mode via
 * `generationConfig.responseMimeType = 'application/json'`. Free tier as of
 * 2026-04: no credit card, 1M-token context on 2.5 Flash.
 *
 * API reference: https://ai.google.dev/api/generate-content
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

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const MODEL_LIMITS = Object.freeze({
  'gemini-2.5-pro': 1_000_000,
  'gemini-2.5-flash': 1_000_000,
  'gemini-2.5-flash-lite': 1_000_000,
});

export class GeminiProvider extends Provider {
  static id = 'gemini';
  static meta = Object.freeze({
    displayName: 'Google Gemini',
    requiresApiKey: true,
    docsUrl: 'https://aistudio.google.com/apikey',
    freeTier: true,
    capabilities: { [CAPABILITIES.JSON_MODE]: true },
  });

  get supportsJsonMode() {
    return true;
  }

  get maxInputTokens() {
    return MODEL_LIMITS[this.config.model] ?? 1_000_000;
  }

  async complete({ system, user, responseFormat, signal }) {
    const apiKey = this.config.apiKey?.trim();
    if (!apiKey) {
      throw new ConfigError(ERROR_CODES.CONFIG_MISSING_KEY, 'Gemini API key is not set', {
        context: { provider: 'gemini' },
      });
    }

    const model = this.config.model || 'gemini-2.5-flash';
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        ...(responseFormat?.type === 'json_object' ? { responseMimeType: 'application/json' } : {}),
      },
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new NetworkError(ERROR_CODES.PROVIDER_NETWORK, 'Could not reach Gemini', { cause: err });
    }

    if (!response.ok) {
      await throwForStatus(response);
    }

    const payload = await response.json().catch((err) => {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'Gemini returned non-JSON response', { cause: err });
    });

    const text = payload?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'Gemini returned an empty response', {
        context: { finishReason: payload?.candidates?.[0]?.finishReason ?? null },
      });
    }

    return {
      text,
      raw: payload,
      usage: {
        inputTokens: payload?.usageMetadata?.promptTokenCount,
        outputTokens: payload?.usageMetadata?.candidatesTokenCount,
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
    throw new AuthError(ERROR_CODES.PROVIDER_AUTH, 'Gemini rejected the API key', { context });
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(response);
    throw new RateLimitError(ERROR_CODES.PROVIDER_RATE_LIMIT, 'Gemini rate limit exceeded', {
      retryAfterMs,
      context,
    });
  }
  if (status >= 500) {
    throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `Gemini server error (${status})`, { context });
  }
  throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `Gemini request failed (${status})`, { context });
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

registerProvider(GeminiProvider.id, GeminiProvider.meta, GeminiProvider);
