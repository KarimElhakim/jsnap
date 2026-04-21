# Stage 6c — OpenAI-Compatible provider

- **Agent:** parent session
- **Model:** claude-sonnet-4-6
- **Date:** 2026-04-21

## Files created

- `src/providers/openai-compatible.js` — `OpenAICompatibleProvider extends Provider`, self-registers via `registerProvider`

## Acceptance checks

- File 140 lines — under 200-line limit.
- Uses `fetch` only; no SDK dependency.
- Native JSON mode via `response_format: { type: 'json_object' }` when `responseFormat?.type === 'json_object'`.
- `401 | 403 → AuthError`, `429 → RateLimitError` with parsed `retryAfterMs`, `5xx → ProviderError`, network failure → `NetworkError`.
- Respects `AbortSignal`.
- `ConfigError` thrown when `baseUrl` is missing or unparseable as URL.
- `Authorization: Bearer` header added only when `apiKey` is present (local servers may omit it).
- `maxInputTokens` returns `32_000` as a conservative default.
- Self-registers at module import.
- No cross-layer imports (only from `./base.js`, `./factory.js`, `../core/errors.js`).
- No new dependencies.

## Deviations from PLAN.md

None.
