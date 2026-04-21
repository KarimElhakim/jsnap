/**
 * Generic OpenAI Chat-Completions-compatible provider.
 *
 * Covers any endpoint that speaks the OpenAI shape: OpenAI, OpenRouter,
 * Together AI, LM Studio, LocalAI, self-hosted vLLM, and future providers.
 *
 * API reference: https://platform.openai.com/docs/api-reference/chat
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

export class OpenAICompatibleProvider extends Provider {
  static id = 'openai-compatible';
  static meta = Object.freeze({
    displayName: 'OpenAI-Compatible (custom)',
    requiresApiKey: true,
    docsUrl: 'https://platform.openai.com/docs/api-reference/chat',
    freeTier: false,
    capabilities: { [CAPABILITIES.JSON_MODE]: true },
  });

  get supportsJsonMode() {
    return true;
  }

  get maxInputTokens() {
    return 32_000;
  }

  async complete({ system, user, responseFormat, signal }) {
    const rawBase = this.config.baseUrl?.trim();
    if (!rawBase) {
      throw new ConfigError(ERROR_CODES.CONFIG_INVALID, 'baseUrl is required for OpenAI-Compatible provider', {
        context: { provider: 'openai-compatible' },
      });
    }

    let baseUrl;
    try {
      baseUrl = new URL(rawBase).href.replace(/\/$/, '');
    } catch {
      throw new ConfigError(ERROR_CODES.CONFIG_INVALID, `baseUrl is not a valid URL: ${rawBase}`, {
        context: { provider: 'openai-compatible', baseUrl: rawBase },
      });
    }

    const model = this.config.model || 'gpt-4o-mini';
    const apiKey = this.config.apiKey?.trim();

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      ...(responseFormat?.type === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
    };

    let response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new NetworkError(ERROR_CODES.PROVIDER_NETWORK, 'Could not reach OpenAI-compatible endpoint', {
        cause: err,
        context: { baseUrl },
      });
    }

    if (!response.ok) {
      await throwForStatus(response, baseUrl);
    }

    const payload = await response.json().catch((err) => {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'OpenAI-compatible endpoint returned non-JSON response', {
        cause: err,
      });
    });

    const text = payload?.choices?.[0]?.message?.content ?? '';
    if (!text) {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'OpenAI-compatible endpoint returned an empty response', {
        context: { finishReason: payload?.choices?.[0]?.finish_reason ?? null },
      });
    }

    return {
      text,
      raw: payload,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens,
        outputTokens: payload?.usage?.completion_tokens,
      },
    };
  }
}

async function throwForStatus(response, baseUrl) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  const status = response.status;
  const context = { status, detail, baseUrl };

  if (status === 401 || status === 403) {
    throw new AuthError(ERROR_CODES.PROVIDER_AUTH, 'OpenAI-compatible endpoint rejected the API key', { context });
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfter(response);
    throw new RateLimitError(ERROR_CODES.PROVIDER_RATE_LIMIT, 'OpenAI-compatible endpoint rate limit exceeded', {
      retryAfterMs,
      context,
    });
  }
  if (status >= 500) {
    throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `OpenAI-compatible endpoint server error (${status})`, {
      context,
    });
  }
  throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `OpenAI-compatible endpoint request failed (${status})`, {
    context,
  });
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

registerProvider(OpenAICompatibleProvider.id, OpenAICompatibleProvider.meta, OpenAICompatibleProvider);
