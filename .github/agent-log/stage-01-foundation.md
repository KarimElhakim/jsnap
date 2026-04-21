# Stage 1 — Foundation

- **Agent:** parent session
- **Model:** opus-4.7
- **Date:** 2026-04-21

## Files created

- `src/core/errors.js` — typed error hierarchy + `ERROR_CODES` + `toJSnapError` normalizer
- `src/core/logger.js` — leveled console logger with redactor for sensitive keys
- `src/core/platform.js` — `chrome.*` abstraction (storage, runtime, tabs, scripting, i18n)
- `src/core/storage.js` — versioned storage wrapper with serialized `update()` RMW
- `src/core/settings.js` — typed settings accessor with deep-merge, provider config helpers, usage counter
- `src/providers/base.js` — `Provider` base class + `CAPABILITIES` flags
- `src/providers/factory.js` — self-registration registry (`registerProvider`, `createProvider`, `listProviders`)
- `src/background/router.js` — versioned message contract + dispatcher factory

## Acceptance checks

- All files <200 lines.
- No `providers/*` imports from `background/*`, `popup/*`, or `content/*`.
- No `core/*` imports from `providers/*`, `background/*`, `popup/*`, or `content/*`.
- `logger.redact` masks string values under keys matching `/api[_-]?key|authorization|bearer|token|secret|password/i`.
- `Storage.update` is serialized per-call via a module-scope Promise chain.
- `Settings.incrementUsage` resets the per-provider counter on day boundary.
- `createDispatcher` returns `{ ok, data | error }` with serializable errors only.

## Deviations from PLAN.md

None.
