# Stage 6a — Groq Provider

## Files created

| File | Lines |
|---|---|
| `src/providers/groq.js` | 148 |

## Acceptance checklist

- [x] `class GroqProvider extends Provider` with `static id = 'groq'`
- [x] `static meta` includes `displayName`, `requiresApiKey`, `docsUrl`, `freeTier`, `capabilities`
- [x] Endpoint: `POST https://api.groq.com/openai/v1/chat/completions`
- [x] OpenAI-compatible request shape (`messages` array, `temperature: 0.2`)
- [x] `response_format` only included when `responseFormat?.type === 'json_object'`
- [x] `Authorization: Bearer <apiKey>` header
- [x] Default model: `llama-3.1-8b-instant`
- [x] `get maxInputTokens()` with 128K table for three Llama models, fallback 32K
- [x] Status mapping mirrors Gemini: 401/403 → `AuthError`, 429 → `RateLimitError` with `retry-after` parse, 5xx → `ProviderError`, other non-OK → `ProviderError`, fetch throw → `NetworkError`
- [x] Response parsing: `payload.choices[0].message.content`, `usage.prompt_tokens`/`completion_tokens`
- [x] `ConfigError(ERROR_CODES.CONFIG_MISSING_KEY)` when `apiKey` is missing
- [x] `registerProvider(GroqProvider.id, GroqProvider.meta, GroqProvider)` at module bottom
- [x] `AbortSignal` respected; `AbortError` re-thrown without wrapping
- [x] `fetch` only, no SDK, no new dependencies
- [x] File is 148 lines (< 200)
- [x] No imports from `background/`, `popup/`, `content/`, or `options/`
- [x] JSDoc header with API reference link

## Deviations

None. Implementation mirrors the Gemini provider pattern exactly as specified.
