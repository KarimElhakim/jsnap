# Stage 5 — Background orchestration

- **Agent:** parent session
- **Model:** opus-4.7
- **Date:** 2026-04-21

## Files created

- `src/background/index.js` (118 lines) — composition root

## What it does

1. Imports all four provider files for side-effect self-registration (`gemini`, `groq`, `ollama`, `openai-compatible`).
2. Registers message handlers for `PING`, `LIST_PROVIDERS`, `GET_SETTINGS`, `SET_SETTINGS`, `GET_USAGE`, `CANCEL_REQUEST`, and `EXTRACT_REQUEST`.
3. `EXTRACT_REQUEST` spawns `runExtraction` (fire-and-forget) and returns `{ accepted: true, requestId }` immediately so the popup is not blocked.
4. `runExtraction` orchestrates: `GET_PAGE_CONTENT` → content script → `createProvider` with stored config → `extract()` → `Settings.incrementUsage` → push `EXTRACT_RESULT`.
5. `AbortController` per `requestId` stored in module-scope `Map`; `CANCEL_REQUEST` aborts in-flight fetches.
6. Progress events are pushed to the popup via `runtime.sendMessage`; the popup subscribes and filters by `requestId`.
7. Errors normalized via `toJSnapError(...)`; serialized through `toJSON()` so no `cause` leaks.
8. `Storage.migrate()` runs on service-worker install.

## Acceptance checks

- File well under 200 lines.
- No module-scope mutable state beyond the `inFlight` abort map (fine because SW eviction cancels all in-flight work anyway).
- No direct `chrome.*` references.
- Typed-error handling end-to-end.
- No cross-layer downward imports outside the allowed set (`core/`, `providers/`, sibling `./router.js`).

## Deviations from PLAN.md

None. The "progress pushed to popup via broadcast" detail was implied in 3.10 but not spelled out; using `runtime.sendMessage` with `.catch(() => {})` to absorb "popup closed" is the clean MV3 idiom.
