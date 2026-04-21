# Stage 2 — Core pipeline + system prompt

- **Agent:** parent session
- **Model:** opus-4.7
- **Date:** 2026-04-21

## Files created

- `src/core/prompt.js` — `PROMPT_VERSION = '1.0.0'`, `SYSTEM_PROMPT` text, `buildExtractionPrompt` returns `{ system, user, responseFormat }`
- `src/core/chunker.js` — `estimateTokens`, heading-aware `chunk`, deterministic `mergeResults` with conflict recording
- `src/core/validator.js` — `validateAndParse` with repair pass (strip fences, slice to outermost JSON, strip trailing commas, balance brackets)
- `src/core/extractor.js` — pure orchestration: prompt build → chunk → per-chunk complete → validate → merge → stamp `__meta`

## Acceptance checks

- All files <200 lines.
- `extractor.js` has zero references to `chrome.*`, storage, or any code under `providers/`, `background/`, `popup/`, `content/`.
- System prompt is a single contiguous block at the top of `prompt.js` with `PROMPT_VERSION` bumped on edits.
- Validator handles: valid JSON, code-fenced JSON, leading prose, trailing commas, truncated brackets.
- Chunker returns `[pageText]` when input fits in `maxTokens * 0.8`; otherwise splits on `^#+ ` boundaries first, then paragraphs.
- Merger deduplicates array entries by `JSON.stringify` and records scalar conflicts under `__meta.conflicts`.

## Deviations from PLAN.md

None.
