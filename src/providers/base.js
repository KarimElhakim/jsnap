/**
 * Provider base class and capability flags.
 *
 * A provider is a stateless adapter that translates the extractor's normalized
 * prompt shape into a provider-specific HTTP request, then returns a
 * normalized response. Providers must not depend on `chrome.*`, storage, or
 * anything under `background/`, `popup/`, or `content/`.
 *
 * Capability flags let the extractor adapt at runtime. A provider that
 * declares `supportsJsonMode = true` receives a request that relies on native
 * JSON mode; one that doesn't must fall back to prompt-enforced JSON plus the
 * validator's repair pass.
 */

export const CAPABILITIES = Object.freeze({
  JSON_MODE: 'jsonMode',
  STREAMING: 'streaming',
});

export class Provider {
  static id = '';
  static meta = Object.freeze({
    displayName: '',
    requiresApiKey: true,
    docsUrl: '',
    freeTier: false,
    capabilities: {},
  });

  /**
   * @param {object} config provider-specific config (apiKey, baseUrl, model, ...)
   */
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Issue one completion request.
   *
   * @param {object} args
   * @param {string} args.system   system prompt
   * @param {string} args.user     user message (page text + hint)
   * @param {{ type: 'json_object' } | undefined} [args.responseFormat]
   * @param {AbortSignal} [args.signal]
   * @returns {Promise<{ text: string, raw: unknown, usage?: { inputTokens?: number, outputTokens?: number } }>}
   */
  async complete(_args) {
    throw new Error(`${this.constructor.name}: complete() must be implemented`);
  }

  get supportsJsonMode() {
    return false;
  }

  get supportsStreaming() {
    return false;
  }

  /**
   * Conservative default. Subclasses override with model-aware limits.
   */
  get maxInputTokens() {
    return 8_000;
  }
}
