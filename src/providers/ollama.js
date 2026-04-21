/**
 * Ollama local provider.
 *
 * Sends requests to a locally running Ollama instance using the native
 * `/api/chat` endpoint. No API key required; the user must have Ollama
 * running and must set `OLLAMA_ORIGINS='*'` (or the extension origin)
 * to allow cross-origin requests from the browser extension.
 *
 * API reference: https://github.com/ollama/ollama/blob/main/docs/api.md#chat
 */

import { Provider, CAPABILITIES } from './base.js';
import { registerProvider } from './factory.js';
import { ERROR_CODES, NetworkError, ProviderError, ConfigError } from '../core/errors.js';

const DEFAULT_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

const CORS_HINT =
  "Make sure Ollama is running locally and that `OLLAMA_ORIGINS='*'` " +
  '(or the specific extension origin) is set so the browser extension can reach it.';

export class OllamaProvider extends Provider {
  static id = 'ollama';
  static meta = Object.freeze({
    displayName: 'Ollama (local)',
    requiresApiKey: false,
    docsUrl: 'https://ollama.com/download',
    freeTier: true,
    capabilities: { [CAPABILITIES.JSON_MODE]: true },
  });

  get supportsJsonMode() {
    return true;
  }

  get maxInputTokens() {
    return 128_000;
  }

  async complete({ system, user, responseFormat, signal }) {
    const baseUrl = resolveBaseUrl(this.config.baseUrl);
    const model = this.config.model?.trim() || DEFAULT_MODEL;
    const url = `${baseUrl}/api/chat`;

    const body = {
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      stream: false,
      options: { temperature: 0.2 },
      ...(responseFormat?.type === 'json_object' ? { format: 'json' } : {}),
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw new NetworkError(ERROR_CODES.PROVIDER_NETWORK, 'Could not reach Ollama', {
        cause: err,
        context: { hint: CORS_HINT },
      });
    }

    if (!response.ok) {
      await throwForStatus(response, model);
    }

    const payload = await response.json().catch((err) => {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'Ollama returned non-JSON response', {
        cause: err,
      });
    });

    const text = payload?.message?.content ?? '';
    if (!text) {
      throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, 'Ollama returned an empty response', {
        context: { model },
      });
    }

    return {
      text,
      raw: payload,
      usage: {
        inputTokens: payload.prompt_eval_count,
        outputTokens: payload.eval_count,
      },
    };
  }
}

/**
 * Resolve and validate baseUrl from config. Returns the URL string
 * with any trailing slash removed.
 *
 * @param {string | undefined} raw
 * @returns {string}
 */
function resolveBaseUrl(raw) {
  const trimmed = (raw ?? '').trim() || DEFAULT_BASE_URL;
  try {
    new URL(trimmed);
  } catch {
    throw new ConfigError(
      ERROR_CODES.CONFIG_INVALID,
      `Ollama baseUrl is not a valid URL: "${trimmed}"`,
      { context: { baseUrl: trimmed } },
    );
  }
  return trimmed.replace(/\/+$/, '');
}

/**
 * @param {Response} response
 * @param {string} model
 * @returns {Promise<never>}
 */
async function throwForStatus(response, model) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    /* ignore */
  }
  const status = response.status;
  const context = { status, detail };

  if (status === 404) {
    throw new ProviderError(
      ERROR_CODES.PROVIDER_FAILED,
      `Ollama model not found (${model}). Run: ollama pull ${model}`,
      { context: { ...context, hint: `ollama pull ${model}` } },
    );
  }
  if (status >= 500) {
    throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `Ollama server error (${status})`, {
      context,
    });
  }
  throw new ProviderError(ERROR_CODES.PROVIDER_FAILED, `Ollama request failed (${status})`, {
    context,
  });
}

registerProvider(OllamaProvider.id, OllamaProvider.meta, OllamaProvider);
