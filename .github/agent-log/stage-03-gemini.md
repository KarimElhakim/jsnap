# Stage 3 — Gemini reference provider

- **Agent:** parent session
- **Model:** opus-4.7
- **Date:** 2026-04-21

## Files created

- `src/providers/gemini.js` — `GeminiProvider` extends `Provider`, self-registers via `registerProvider`

## Acceptance checks

- File <200 lines.
- Uses `fetch` only; no SDK dependency.
- Native JSON mode via `generationConfig.responseMimeType = 'application/json'`.
- `401 | 403 → AuthError`, `429 → RateLimitError` with parsed `retryAfterMs`, `5xx → ProviderError`, network failure → `NetworkError`.
- Respects `AbortSignal`.
- Default model `gemini-2.5-flash`; configurable via settings.
- Self-registers at module import.
- No cross-layer imports (only from `./base.js`, `./factory.js`, `../core/errors.js`).

## Deviations from PLAN.md

None.
