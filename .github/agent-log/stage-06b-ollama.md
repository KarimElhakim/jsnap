# Stage 6b — Ollama Provider

**Model:** Sonnet 4.6
**Date:** 2026-04-21

## Files created

| File | Lines |
|---|---|
| `src/providers/ollama.js` | 159 |

## Implementation notes

- `OllamaProvider extends Provider` with `static id = 'ollama'`.
- `static meta` marks `requiresApiKey: false`, `freeTier: true`, `docsUrl: 'https://ollama.com/download'`, and declares `JSON_MODE` capability.
- Config shape is `{ baseUrl?, model? }`. `resolveBaseUrl` validates the URL via `new URL()` and trims trailing slashes; missing/empty `baseUrl` falls back to `http://localhost:11434` before validation, so the default is always valid and no `ConfigError` is thrown when config is omitted entirely. A `ConfigError(CONFIG_INVALID)` is only thrown when the user supplies an unparseable string.
- Default model: `llama3.2`.
- Endpoint: `POST <baseUrl>/api/chat` with native Ollama chat body (`stream: false`, `options.temperature: 0.2`, `format: 'json'` when `responseFormat.type === 'json_object'`).
- `get maxInputTokens()` returns `128_000`.
- Response: `text = payload.message.content`, `usage = { inputTokens: payload.prompt_eval_count, outputTokens: payload.eval_count }`.
- Network errors carry `context.hint` with the CORS / OLLAMA_ORIGINS guidance.
- 404 errors carry `context.hint` with the `ollama pull <model>` command.
- 5xx and other non-OK statuses throw `ProviderError`.
- No 401/429 handling (local server, no auth, no rate limits).
- `AbortSignal` respected; re-throws `AbortError` before wrapping in `NetworkError`.
- Self-registers at bottom via `registerProvider(OllamaProvider.id, OllamaProvider.meta, OllamaProvider)`.
- No external dependencies. No cross-layer imports.

## Acceptance criteria

| Criterion | Status |
|---|---|
| Same interface contract as Gemini | Pass |
| Typed error mapping (ConfigError, NetworkError, ProviderError) | Pass |
| Registered via `registerProvider` | Pass |
| JSDoc header linking to API reference | Pass |
| Under 200 lines | Pass (159) |
| No external SDK | Pass |
| No cross-layer imports | Pass |
| `requiresApiKey: false` | Pass |

## Deviations

None. All requirements from the task specification are implemented as specified.
