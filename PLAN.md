# JSnap Implementation Plan

**Version:** 0.1.0
**Target:** Chrome MV3 (Chromium-based; Edge supported, Firefox via later port)
**Scope:** Single page → JSON extraction via user's own LLM API key.

This document is the contract. Every file's interface, every acceptance criterion, and every stage's model assignment is locked here. Changes to this document must be reviewed before implementation changes.

---

## 1. Product scope

### In scope for v0.1.0

- One browser tab, one click, one JSON output.
- Automatic structure inference by default.
- Optional natural-language "hint" to scope the extraction.
- Provider support: Gemini, Groq, Ollama, OpenAI-compatible.
- BYOK (bring your own key). Keys are stored locally in `chrome.storage.local`; never transmitted to anywhere except the provider the user selected.
- Light/dark theme matching system preference with manual override.
- i18n on day one: `en`, `ar` (RTL), `es`, `fr`, `de`.
- Daily usage meter per provider so users see how close they are to free-tier limits.

### Explicitly out of scope for v0.1.0

- Whole-site crawling, multi-tab batches, scheduled extractions.
- Cloud sync, accounts, telemetry, any backend.
- Map/reduce reducer passes on chunked extractions (deferred — may appear as an advanced toggle in 0.2.0).
- Vendor-locked OpenAI adapter (the OpenAI-compatible generic adapter covers OpenAI, OpenRouter, Together, LM Studio, LocalAI, and self-hosted endpoints).

---

## 2. Architecture

### Layering

```
┌──────────────────────────────────────────────────────────────┐
│  Presentation  src/popup/    src/options/                    │
│                (Preact + Signals + chrome.i18n + Lucide)     │
├──────────────────────────────────────────────────────────────┤
│  Orchestration src/background/    src/content/               │
│                (MV3 service worker, content sanitization)    │
├──────────────────────────────────────────────────────────────┤
│  Core          src/core/                                     │
│                (extractor, prompt, validator, chunker,       │
│                 storage, settings, logger, errors, platform) │
├──────────────────────────────────────────────────────────────┤
│  Providers     src/providers/                                │
│                (base, registry, gemini, groq, ollama,        │
│                 openai-compatible)                           │
└──────────────────────────────────────────────────────────────┘
```

### Hard rules

1. **No cross-layer upward imports.** `core/*` never imports from `providers/*`, `background/*`, `popup/*`, or `content/*`. `providers/*` never imports from `background/*` or `popup/*`. Violations are build-time failures (enforced via a grep in CI).
2. **No file exceeds 200 lines.** If it grows past that, split it.
3. **No hidden state in `background/`.** MV3 service workers are evicted. Module-scope mutable state is a bug.
4. **Typed errors only.** Every `throw` is a subclass of `JSnapError` from `core/errors.js`. The UI switches on `error.code`, never on `error.message`.
5. **Prompt and schema are versioned.** `PROMPT_VERSION` and `SETTINGS_SCHEMA_VERSION` are baked into every stored record for future migrations.
6. **No secrets in logs.** The logger's redactor strips anything matching `api[_-]?key|authorization|bearer` before emitting a line.
7. **All UI strings go through `chrome.i18n.getMessage`.** No hardcoded English in JSX.
8. **Platform abstraction.** UI and core code import from `src/core/platform.js`, never from `chrome.*` directly. This is the one-file change needed for a future Firefox port.

### File tree

```
jsnap/
├── manifest.json
├── vite.config.js
├── package.json
├── _locales/
│   ├── en/messages.json
│   ├── ar/messages.json
│   ├── es/messages.json
│   ├── fr/messages.json
│   └── de/messages.json
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── scripts/
│   └── package.mjs
├── src/
│   ├── core/
│   │   ├── errors.js
│   │   ├── storage.js
│   │   ├── settings.js
│   │   ├── logger.js
│   │   ├── platform.js
│   │   ├── prompt.js
│   │   ├── chunker.js
│   │   ├── validator.js
│   │   └── extractor.js
│   ├── providers/
│   │   ├── base.js
│   │   ├── factory.js
│   │   ├── gemini.js
│   │   ├── groq.js
│   │   ├── ollama.js
│   │   └── openai-compatible.js
│   ├── background/
│   │   ├── index.js
│   │   └── router.js
│   ├── content/
│   │   ├── index.js
│   │   └── sanitizer.js
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── styles.css
│   │   ├── components/
│   │   │   ├── ProviderSelect.jsx
│   │   │   ├── HintInput.jsx
│   │   │   ├── ExtractButton.jsx
│   │   │   ├── ResultView.jsx
│   │   │   ├── UsageMeter.jsx
│   │   │   ├── StatusBar.jsx
│   │   │   └── DonateFooter.jsx
│   │   └── hooks/
│   │       └── useI18n.js
│   └── options/
│       ├── index.html
│       ├── main.jsx
│       └── App.jsx
└── test/
    └── smoke/
```

---

## 3. Interfaces (the contract)

### 3.1 `core/errors.js`

```js
export class JSnapError extends Error {
  constructor(code, message, { cause, context } = {}) {
    super(message);
    this.code = code;         // stable, machine-readable
    this.cause = cause;       // underlying Error, if any
    this.context = context;   // arbitrary metadata (provider, stage, etc.)
    this.name = this.constructor.name;
  }
  toJSON() { /* code, message, context only — NEVER cause with secrets */ }
}

export class ConfigError          extends JSnapError {}  // missing/invalid API key
export class ProviderError        extends JSnapError {}  // provider-side failure
export class RateLimitError       extends ProviderError {} // with retryAfterMs
export class AuthError            extends ProviderError {}
export class NetworkError         extends ProviderError {}
export class SchemaError          extends JSnapError {}  // validator failure
export class ContentTooLargeError extends JSnapError {}  // exceeded capacity
export class CancelledError       extends JSnapError {}  // user aborted
export class UnknownProviderError extends JSnapError {}
```

All error codes live in `ERROR_CODES` — a frozen object exported from the same file.

### 3.2 `core/storage.js`

Wraps `chrome.storage.local` with a versioned schema. Reads/writes are keyed and atomic per call. Multi-key updates go through `update(fn)` which performs read-modify-write in a single `set()` call.

```js
export const SETTINGS_SCHEMA_VERSION = 1;

export const Storage = {
  get(key, fallback) { ... },
  set(key, value) { ... },
  update(fn) { ... },          // fn(snapshot) -> patch; single atomic set
  subscribe(key, handler) { ... },
  migrate() { ... },           // runs on SW startup
};
```

### 3.3 `core/settings.js`

Typed accessor over `Storage`. Schema:

```js
{
  schemaVersion: 1,
  defaultProviderId: 'gemini',
  providers: {
    gemini: { apiKey: '', model: 'gemini-2.5-flash' },
    groq:   { apiKey: '', model: 'llama-3.1-8b-instant' },
    ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.2' },
    'openai-compatible': { baseUrl: '', apiKey: '', model: '' },
  },
  ui: { theme: 'system', locale: 'auto' },
  usage: { /* keyed by providerId, rolling daily counters */ },
}
```

### 3.4 `providers/base.js`

```js
export class Provider {
  static id = '';
  static meta = { displayName: '', requiresApiKey: true, capabilities: {} };

  constructor(config) { this.config = config; }

  // Returns Promise<{ text: string, raw: unknown, usage?: { inputTokens, outputTokens } }>
  async complete({ system, user, responseFormat, signal }) {
    throw new Error('not implemented');
  }

  // Optional capabilities:
  get supportsJsonMode() { return false; }
  get supportsStreaming() { return false; }
  get maxInputTokens()    { return 8_000; }
}

export const CAPABILITIES = Object.freeze({ JSON_MODE: 'jsonMode', STREAMING: 'streaming' });
```

### 3.5 `providers/factory.js` (registry)

```js
const registry = new Map();

export function registerProvider(id, meta, ctor) { registry.set(id, { id, meta, ctor }); }
export function listProviders() { return [...registry.values()].map(({id, meta}) => ({id, meta})); }
export function createProvider(id, config) {
  const entry = registry.get(id);
  if (!entry) throw new UnknownProviderError('provider.unknown', `Unknown provider: ${id}`);
  return new entry.ctor(config);
}
```

Each provider file ends with `registerProvider(...)`. Adding a new provider never touches this file.

### 3.6 `core/prompt.js`

```js
export const PROMPT_VERSION = '1.0.0';

export function buildExtractionPrompt({ pageText, pageUrl, pageTitle, userHint, locale }) {
  return {
    system: /* the JSnap extraction system prompt, version 1.0.0 */,
    user:   /* formatted user message with page content + optional hint */,
    responseFormat: { type: 'json_object' },
  };
}
```

The system prompt itself (in plain English) is the single highest-leverage artifact in the project. It's drafted in Stage 2 and stamped with `PROMPT_VERSION` so regressions can be correlated.

### 3.7 `core/validator.js`

Pure function. Given a provider response string, attempt a strict JSON parse; on failure, attempt one repair pass (balanced-brace recovery, trailing-comma cleanup); on failure, throw `SchemaError`.

```js
export function validateAndParse(rawText) { ... }  // -> object
```

### 3.8 `core/chunker.js`

Minimal heading-aware splitter. Engaged only when content exceeds `provider.maxInputTokens`. For v0.1.0 it's a safety valve, not a common path.

```js
export function chunk(pageText, { maxTokens }) { ... }  // -> string[]
```

### 3.9 `core/extractor.js`

Pure orchestration layer. Provider-agnostic. Receives a `Provider` instance via dependency injection.

```js
export async function extract({ provider, pageText, pageUrl, pageTitle, userHint, locale, signal, onProgress }) {
  // 1. buildExtractionPrompt(...)
  // 2. if pageText fits in provider.maxInputTokens: one-shot call
  //    else: chunk + per-chunk extract + deterministic merge
  // 3. validateAndParse(...)
  // 4. stamp { __meta: { promptVersion, providerId, extractedAt, sourceUrl } }
  // 5. return result
}
```

### 3.10 `background/router.js`

Message schema (versioned):

```js
export const MESSAGE_VERSION = 1;

// popup -> bg
{ v: 1, type: 'EXTRACT_REQUEST',  payload: { tabId, providerId, hint, requestId } }
{ v: 1, type: 'LIST_PROVIDERS',   payload: {} }
{ v: 1, type: 'GET_SETTINGS',     payload: {} }
{ v: 1, type: 'SET_SETTINGS',     payload: { patch } }
{ v: 1, type: 'CANCEL_REQUEST',   payload: { requestId } }

// bg -> popup
{ v: 1, type: 'EXTRACT_PROGRESS', payload: { requestId, stage, pct } }
{ v: 1, type: 'EXTRACT_RESULT',   payload: { requestId, ok: true,  data } }
{ v: 1, type: 'EXTRACT_RESULT',   payload: { requestId, ok: false, error: {code, message, context} } }
```

### 3.11 `background/index.js`

Thin composition root:

1. On startup: `Storage.migrate()`, register all providers (import side-effects).
2. Listen for messages; dispatch via `router.js`.
3. For `EXTRACT_REQUEST`:
   - Inject `content/index.js` into the target tab via `chrome.scripting.executeScript`.
   - Receive the sanitized page text back.
   - Instantiate the requested provider via `createProvider`.
   - Call `extract(...)`.
   - Increment usage counter.
   - Return result.
4. Service worker can be evicted between messages — never rely on module-scope state.

### 3.12 `content/index.js` + `content/sanitizer.js`

Content script injected on demand. Extracts cleaned text + structural cues. Never reads API keys (they live only in the background SW).

```js
export function sanitize(document) {
  // Strip script, style, svg, noscript, iframe, nav, aside, footer.
  // Drop hidden elements (display:none, visibility:hidden, aria-hidden).
  // Drop common ad/cookie banner selectors.
  // Keep title, meta description, headings, paragraphs, lists, tables, <main>, <article>.
  // Return { text, title, url, meta }.
}
```

### 3.13 `core/platform.js`

Thin shim over the handful of `chrome.*` APIs we actually use:

```js
export const Platform = {
  storage: {
    get(keys) { ... },
    set(obj)  { ... },
    onChanged: { addListener(fn) { ... }, removeListener(fn) { ... } },
  },
  runtime: {
    sendMessage(msg) { ... },
    onMessage: { addListener(fn) { ... } },
    getURL(path) { ... },
  },
  tabs: {
    query(q) { ... },
    get(tabId) { ... },
  },
  scripting: {
    executeScript(opts) { ... },
  },
  i18n: {
    t(key, substitutions) { ... },
  },
};
```

All other code imports `Platform` from here. Future Firefox port: change this one file.

---

## 4. Stage plan

Every stage ends with a git commit. Every file has acceptance criteria below.

### Stage 1 — Foundation (Opus 4.7)

**Files:** `core/errors.js`, `core/storage.js`, `core/settings.js`, `core/logger.js`, `core/platform.js`, `providers/base.js`, `providers/factory.js`, `background/router.js`.

**Acceptance:**

- All error classes exported and documented with JSDoc.
- `Storage.update` performs a single atomic `chrome.storage.local.set()`.
- `Settings` defaults survive first install; subsequent installs see the migrated shape.
- `logger.js` redacts keys matching `/api[_-]?key|authorization|bearer/i` from any logged object before emission.
- `Provider` base class has clear JSDoc for `complete()`; subclasses cannot forget to implement it (it throws by default).
- `registerProvider` is idempotent (re-registering the same id warns in dev, overwrites in prod).
- `router.js` exports message builders and a validator that checks `{ v, type, payload }` shape before dispatch.

### Stage 2 — Core pipeline + system prompt (Opus 4.7)

**Files:** `core/prompt.js`, `core/chunker.js`, `core/validator.js`, `core/extractor.js`.

**Acceptance:**

- The system prompt is one block of text at the top of `prompt.js`, commented, versioned, and referenced by constant from `extractor.js`.
- `validateAndParse` passes a suite of hand-written malformed-JSON recovery cases (trailing commas, code-fence wrapping, BOM, leading prose).
- `extractor.js` is pure: no `chrome.*` references, no side effects beyond calls to the injected provider.
- Chunker fires only when `pageText.length * 0.25 > provider.maxInputTokens * 0.8` (heuristic token estimate, 80% budget).

### Stage 3 — Gemini provider (Opus 4.7)

**Files:** `providers/gemini.js`.

**Acceptance:**

- Uses Gemini's native `generationConfig.responseMimeType: 'application/json'`.
- Default model: `gemini-2.5-flash`. Settable via settings.
- Maps HTTP status codes to typed errors: 401 → `AuthError`, 429 → `RateLimitError` (with `retryAfterMs`), 5xx → `ProviderError`.
- Respects `AbortSignal` for cancellation.
- No external SDK; `fetch` only.
- Registers itself via `registerProvider('gemini', ...)`.

### Stage 4 — UI plumbing (Sonnet 4.5 sub-agent, can start after Stage 1)

**Files:** `manifest.json`, `src/popup/*`, `src/options/*`, `src/content/*`, `_locales/*/messages.json`, `vite.config.js`, `public/icons/*`.

**Acceptance:**

- Popup loads in <100ms on cold start.
- All user-facing strings route through `chrome.i18n.getMessage`.
- Light/dark parity verified; `prefers-color-scheme` auto + manual override.
- `ar` locale renders RTL with correct layout mirroring.
- Lucide icons tree-shaken (bundle <30KB gz).
- Content script never reads storage; only sanitizes and returns page data.
- Options page persists settings atomically via `Settings.update`.
- Donate footer links to `https://buymeacoffee.com/karimali` and GitHub Sponsors.

### Stage 5 — Background orchestration (Opus 4.7)

**Files:** `src/background/index.js`.

**Acceptance:**

- Under 150 lines.
- No module-scope mutable state.
- Handles `EXTRACT_REQUEST` end-to-end: inject content script → receive text → create provider → extract → respond.
- Emits `EXTRACT_PROGRESS` for three stages: `fetching`, `thinking`, `parsing`.
- Correctly handles concurrent requests via `requestId` keyed maps persisted to storage.
- `CANCEL_REQUEST` aborts in-flight fetch.

### Stage 6 — Other providers (Sonnet 4.5, 3 parallel sub-agents)

**Files (parallel):**
- 6a: `providers/groq.js`
- 6b: `providers/ollama.js`
- 6c: `providers/openai-compatible.js`

**Acceptance (all three):**

- Same interface contract as Gemini.
- Same typed error mapping.
- Each registered via `registerProvider`.
- Each has a short JSDoc header linking to the provider's API reference.

### Stage 7 — Polish (Sonnet 4.5, 2 parallel sub-agents)

**Files (parallel):**
- 7a: `README.md` (badges, screenshots, install, usage, i18n list, donate links)
- 7b: `scripts/package.mjs`, final `manifest.json` review, Chrome Web Store readiness checklist

**Acceptance:**

- README renders well on GitHub: badges for license, version, CI, Chrome Web Store (placeholder), sponsors.
- `npm run package` produces `jsnap-<version>.zip` ready for Chrome Web Store submission.
- README includes a "Get a free API key in 60 seconds" section pointing to Google AI Studio.

---

## 5. System prompt (draft — finalized in Stage 2)

```
You are JSnap, a precision JSON extractor. You receive the sanitized textual
content of a single web page, optionally with a user hint describing what they
care about. Your single job is to return a well-formed JSON object that
captures the meaningful structured content of the page.

Rules:
1. Return ONLY a JSON object. No prose, no code fences, no comments.
2. Infer a clean, human-readable structure. Prefer clear keys over deep nesting.
3. If a user hint is provided, prioritize content that matches the hint and
   omit unrelated content. Do not refuse; best-effort always.
4. Preserve lists as JSON arrays. Preserve tables as arrays of row objects.
5. Preserve numbers, booleans, and dates as typed values where unambiguous.
   Otherwise keep them as strings.
6. Omit navigation, ads, cookie banners, author bios, related-post lists, and
   social-share widgets unless the user hint explicitly asks for them.
7. If the content is fundamentally unstructured prose (a blog post with no
   clear structure), return: { "title": "...", "summary": "...", "content": "..." }.
8. Include a "__meta" object with at least { "sourceUrl", "extractedAt" }.
```

This text is the canonical draft. Final polish happens in Stage 2.

---

## 6. Verification gates

At the end of each stage, the following must pass before the next stage starts:

1. `npm run lint` (prettier check) returns 0.
2. `npm run build` produces `dist/manifest.json` and loads in `chrome://extensions` without errors.
3. Cross-layer import rule: no `core/*` file imports from `providers`, `background`, `popup`, `content`.
4. No file exceeds 200 lines.
5. `PROGRESS.md` is updated with stage status, files touched, and model used.
6. Commit is made on `main` with a conventional-commit message.

---

## 7. Done = shipped

Project is complete when:

- `dist/` loads as an unpacked extension in Chrome 120+ without errors.
- Fresh install → open popup → paste Gemini key → extract a page → see JSON.
- `npm run package` produces a valid Chrome Web Store submission zip.
- README renders professionally on the GitHub repo page.
- Buy Me a Coffee and GitHub Sponsors links are reachable from both the repo and the extension popup footer.
