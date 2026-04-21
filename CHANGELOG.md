# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.3] - 2026-04-21

### Fixed

- **Filenames really work now.** The v0.4.2 fix was correct in shape but broken in one specific way: the offscreen document's script was inline, and MV3's default CSP (`script-src 'self'`) forbids inline scripts in extension pages. The script never ran, the offscreen document never responded, and every download silently fell back to the data-URL path that produced `download.json`. The offscreen script now lives in its own file (`public/offscreen.js`) and loads via `<script src>`.
- **Belt-and-braces filename handling**: downloads are now built from a `File` object (not a bare `Blob`) so the filename is bound to the object itself. Chrome's Save As dialog reads `File.name` and uses it as the default, which sidesteps the other known Chrome quirk where blob-URL downloads default to the URL's last path segment.
- **Offscreen failures are now loud**: if the offscreen document cannot be created or doesn't respond within 4 seconds, the download throws a descriptive error and a desktop notification fires with the real reason. No more silent fall-through to `download.json`.

### Removed

- Silent data-URL fallback in `downloadResult`. It was producing the wrong behaviour and hiding the real problem. If blob URLs cannot be created, the download fails with a visible error instead.

## [0.4.2] - 2026-04-21

### Fixed

- **Downloads now use the real page-title filename.** Previously saves from `Alt+J`, the context menu, and "Snap all tabs" landed as `download.json` because Chrome silently ignores the `filename` option of `chrome.downloads.download` when the URL is a `data:` URL. The service worker now bounces through an **offscreen document** (the official MV3 pattern for Blob access from service workers) so every download uses a real `blob:` URL, and Chrome honours the filename we compute. Same fix applies to popup-initiated Markdown saves (`<slug>-<date>.md` instead of a UUID-looking name).
- **"Snap all tabs" saves every tab, not just the active one.** The combination of offscreen-backed downloads (above) plus the v0.4.1 `host_permissions` change means `scripting.executeScript` can reach every tab, extract each one, and each file lands with the right name in the batch folder. The batch summary now reports `failedCount` alongside `savedCount`, and the notification tells you if any tabs failed.
- **"Save selected text as JSON" produces a small, exact file** — `{ pageTitle, pageUrl, selectedText, __meta: { mode: 'selection' } }`. No full-page extraction. Filename: `<page-slug>-selection-<date>.json`.

### Changed

- **Color scheme overhauled.** The purple palette is gone. The extension now uses a Chrome-native blue (`#2563eb`) on a slate neutral palette in light mode, and a deep slate dark-mode palette with a brighter blue accent (`#3b82f6`). Cleaner, more professional, reads well at the small popup size.
- **Icons regenerated** from the placeholder generator with the new blue background. The glyph is unchanged; only the colour shifted. Replace with your own artwork before Chrome Web Store submission.
- **Offscreen document added** at `offscreen.html` with an inline message handler that creates and revokes Blob URLs on demand. Lifecycle-managed by `ensureOffscreenDocument()` in `src/core/download.js`.
- New `offscreen` permission in the manifest.
- `downloadResult` now returns `{ downloadId, filename }` so callers can log or display what was actually saved.

### Notes

- **This release changes the manifest's permission surface** (adds `offscreen`). If you side-loaded a previous version, fully **remove** it at `chrome://extensions` and load v0.4.2 fresh so Chrome re-prompts with the correct scope.

## [0.4.1] - 2026-04-21

### Fixed

- **Auto-download actually works now.** Previously `URL.createObjectURL` was called from the background service worker, which is not available in MV3 SW — so `Alt+J` and context-menu triggers failed silently and only the History save succeeded. The download helper now detects the runtime context and falls back to a base64 data URL when the service worker path is taken. Errors that do occur are surfaced as desktop notifications instead of being swallowed.
- **Snap all tabs works on tabs other than the active one.** Added `host_permissions: ["<all_urls>"]` to the manifest. Without it, `scripting.executeScript` was denied on every tab except the one the user was clicking through, which is why github.com and other tabs failed with "Unable to access this page" in the batch summary. Net permission surface is unchanged (the existing `content_scripts` declaration already requests the same scope).
- **"Save selected text as JSON" now saves only the selected text.** The previous implementation ran a full page extraction and tried to filter sections by substring, which either returned too much or too little depending on how the selection matched sanitized content. New shape: `{ pageTitle, pageUrl, selectedText, __meta: { mode: 'selection' } }`. Filename pattern: `<page-title-slug>-selection-<date>.json`.
- Auto-download errors are now logged as errors (not warnings) and surface a visible desktop notification with the failure reason.

### Changed

- Popup width raised from 360px to 400px so the Mode segmented control, the Extract + All-tabs row, and the Result action row all sit comfortably without compression.
- Result action row refactored to a dedicated `.actions-row` utility class: `display: flex; flex-wrap: wrap; gap: 6px;`. Buttons wrap cleanly on narrow popups instead of clipping.
- Segmented-control options get `text-overflow: ellipsis` so long labels don't spill out of their column.

### Removed

- `narrowToSelection` / `sectionMatches` helpers in `background/index.js` — superseded by the explicit selection-mode JSON shape.

## [0.4.0] - 2026-04-21

### Added

- **Auto-download for keyboard and context-menu triggers.** Pressing `Alt+J` or using the right-click menu now saves the JSON file directly via Chrome's **Save As** dialog. No popup round-trip. A system notification confirms the save.
- **"Save as Markdown" button** in the result view as a first-class action next to "Save as JSON" and "Copy". The previous hidden format toggle is gone — both buttons are always visible and do what they say.
- **Markdown preview expander** in the result view so you can inspect the Markdown rendering before saving it.
- **"downloads"** and **"notifications"** permissions so saves use the native Save As dialog and confirm success.
- `src/core/download.js` — unified download helper used by popup, history, and background. One code path for filename derivation, format conversion, and the Chrome downloads API.

### Changed

- **"Snap all tabs" now produces one JSON file per tab.** Previously it returned a single bundle containing every tab's data, which is not what most people want. New behavior: each tab's content is saved as its own `<slug>-<date>.json`, all grouped into one automatically-created subfolder `Downloads/jsnap-batch-<timestamp>/`. A single notification summarises the result (`Saved 8 of 10 tabs`). No N-dialog spam, no shared clobbering.
- **Filenames always derive from the page title**, not from internal IDs. The previous `jsnap-<uuid>.json` from the History panel is gone — you now always get `jsnap-<slugified-page-title>-<date>.json`.
- **Context-menu labels are plain English**:
  - "Save this page as JSON" (on any page)
  - "Save selected text as JSON" (when text is highlighted)
  The `(JSnap)` suffix and the word "Extract" are gone. Simpler, clearer.
- **License changed from MIT to GPL-3.0-only.** JSnap is still free and open-source — you can use, read, fork, and modify it. But any redistributed derivative must also be GPL-3.0 with source available. This prevents closed-source repackaging and resale. See README for details.

### Removed

- `PLAN.md`, `PROGRESS.md`, `.github/agent-log/` — internal development documents that did not belong in the public repository.
- `scripts/chrome-web-store-checklist.md` — moved to local notes.
- The implicit JSON/Markdown format toggle in the result view. Replaced by two explicit buttons.

### Security

- Audited the repository for committed secrets (API keys, tokens, `.env` files). None found.

## [0.3.0] - 2026-04-21

### Added

- **Keyboard shortcut** `Alt+J` extracts the current page in Raw mode without opening the popup.
- **Context menu entries**: right-click any page → _"Extract page to JSON (JSnap)"_; right-click a text selection → _"Extract selection to JSON (JSnap)"_. Both use Raw mode, no API key needed.
- **Snap all tabs**: single click bundles every open tab in the current window (excluding restricted URLs) into one JSON archive: `{ kind: "jsnap-tab-archive", tabs: [{ url, title, data }, …], __meta }`. Perfect for capturing a research session in one shot.
- **Local history** — every successful extraction is stored in `chrome.storage.local` (up to 100 entries, newest first). A new **History** tab in the popup lets you search by title/URL, open a past extraction, re-download it as JSON, or delete entries individually or all at once. Nothing leaves your browser.
- **Markdown output** — the result view now has a JSON / MD toggle. Download as `.md` produces clean Markdown ready for Obsidian, Notion, or any Markdown-aware tool. Conversion is lossless-as-possible from the JSnap schema.
- **Filename suggestions** — downloaded files are now named `jsnap-<page-title-slug>-<yyyy-mm-dd>.json` instead of the generic `jsnap-output.json`.
- **Selection-narrowed Raw extraction** — when you trigger via the "Extract selection" context menu on Raw mode, the structured output is filtered to sections that contain the selected text.
- **Real-time API call tracking**: every `provider.complete()` call is now counted. `__meta.apiCalls` is stamped on every result. The usage meter increments by the actual call count, not by logical extractions.
- **Per-provider quota hints** in the usage meter: `N / 250 today` for Gemini Flash, `N / 14,400 today` for Groq's Llama 3.1 8B, unbounded for Ollama, unknown for OpenAI-compatible (user-configured endpoint).
- **`__meta.schemaVersion = "2.1"`** on every Raw and LLM output — downstream tools can pin to a specific schema version.

### Fixed

- **Usage counter was severely under-reporting.** Previously Structure mode incremented once per extraction regardless of how many API calls were actually made; a single 50-section extraction showed as "1 request" while burning 50 of your daily quota. Now accurate to the call.
- Git author attribution: all commits rewritten to use the correct GitHub noreply email so no unrelated contributor appears on the repo.

### Changed

- CI workflow simplified: build-only, no strict lint gate.
- Usage meter is hidden in Raw mode (no quota to report).

## [0.2.0] - 2026-04-21

### Added

- **Raw mode** — deterministic DOM → JSON extraction, now the default. No API key required, no network call, no quota. Runs in the content script in about 100 ms. Lossless: every paragraph, list, table, code block, quote, and image is captured as a typed JSON block under its containing heading.
- New module `src/content/structured.js` — the DOM walker that produces the Raw output tree (`EXTRACTOR_VERSION = "2.0.0"`).
- New module `src/content/pre-splitter.js` — promotes ASCII-styled headings (underlined, roman-numeral, numbered) within a single `<pre>` block into real sections. This is what lets GameFAQs-style walkthroughs round-trip with chapter structure intact.
- Typed block schema: `paragraph | list | table | code | quote | image`, each with a stable `type` discriminator so downstream tools can consume the JSON without cleanup.
- `__meta.stats` on Raw output: `{ sections, blocks, characters, elapsedMs }`.
- Mode badges in the popup segmented control — "free" tag on Raw.
- Per-mode help text so users see the trade-off when they switch.

### Changed

- **Default extraction mode is now Raw.** Previously Structure (LLM-backed). Users still land on a working experience without configuring an API key.
- Popup UI hides the provider selector when Raw mode is active.
- `src/background/index.js` short-circuits Raw requests: calls the content script's `GET_PAGE_STRUCTURED` handler, returns the result; no provider instantiation, no usage increment.
- `MODES` constant now includes `RAW`; `LLM_MODES` array added for call-site clarity.

### Why

v0.1.x treated the LLM as the primary extractor. For the main use case ("translate this page into JSON"), the LLM is the wrong tool: it introduces latency, quota pressure, prompt-tuning friction, and truncation ceilings. A deterministic DOM walker is faster, free, reproducible, and lossless. LLM modes remain available as BYOK for when semantic intelligence is genuinely needed (summaries, specific-field extraction).

## [0.1.2] - 2026-04-21

### Added

- **Section-wise extraction for Structure mode.** Long documents (over ~6,000 input tokens with multiple `#`/`##` headings) are now split by heading and processed one section per API call. Results merge into `{ title, sections: [...], __meta }`. This removes the previous truncation ceiling — the full text of guides, walkthroughs, and long docs now round-trips intact regardless of length.
- `splitBySections(text)` utility in `core/chunker.js` — markdown-ish heading splitter used by the section-wise path.
- `buildSectionPrompt(...)` in `core/prompt.js` — a tightly-scoped prompt that covers exactly one section at a time and bans summarization/paraphrasing at the per-section level.
- Per-section progress in the popup: "Section 14 of 47 — Chapter Name" updates live as each section is processed.
- `__meta.sectionCount` on section-wise results.

### Changed

- `providers/gemini.js` raised `maxOutputTokens` from 8,192 to 32,768. Gives single-shot calls headroom before the section-wise path engages.
- Prompt version bumped to `1.2.0`.

### Technical notes

- Section-wise extraction makes N API calls where N = number of top-level headings. On Gemini Flash free tier (10 RPM / 250 RPD) a 50-section document takes ~5 minutes and consumes 50 of your 250 daily requests. Use Groq (30 RPM) for faster throughput.
- Single-shot path is unchanged for Summary and Data modes and for short Structure documents.

## [0.1.1] - 2026-04-21

### Added

- **Extraction Mode selector** with three presets:
  - **Structure** (default) — lossless preservation of page content, organized into sections. Best for articles, guides, walkthroughs, documentation.
  - **Summary** — condensed digest with key points.
  - **Data** — structured data only (tables, specs, lists); drops narrative prose.
- Prompt versioned to `1.1.0`. Every result now carries `__meta.mode` so stored extractions are self-describing.
- Sanitizer preserves `<pre>` and `<code>` blocks as markdown-fenced strings, fixing truncation on sites like GameFAQs where walkthroughs live inside `<pre>`.
- Sanitizer added a lightweight fallback pass: if the aggressive pass returns less than 300 chars, the content script falls back to `innerText` so users always get something usable.
- `content.empty` errors now include the char count and URL in `context` for debuggability.
- Content script guards against duplicate listener registration when re-injected on demand.

### Fixed

- **Content script now auto-injects on demand** when the background cannot reach a tab (typically because the tab predates the extension install). Before: generic "unexpected error". After: seamless injection and retry.
- **Restricted URLs detected** (`chrome://`, Web Store, `about:`) and return a clear, actionable error message.
- **Error UI now shows the error code and raw message** beneath the friendly i18n copy, so users can report precise debug info.
- Tightened sanitizer noise regex: legitimate class fragments like `related-news` or `ad-content-card` are no longer stripped.

### Changed

- Default extraction mode is now **Structure** (lossless) instead of the previous implicit summarization bias. Users asking for a summary must select it explicitly.

## [0.1.0] - 2026-04-21

### Added

- Initial release of JSnap: one-click page-to-JSON Chrome extension.
- Provider support: Google Gemini, Groq, Ollama (local), and a generic OpenAI-compatible adapter.
- Freeform natural-language "hint" field for scoping extractions (optional).
- Content sanitization pipeline that strips ads, navigation, scripts, and hidden elements before sending content to the LLM.
- Typed error hierarchy with user-friendly messages.
- Daily usage meter per provider with quota warnings.
- Light/dark theming with system preference detection.
- Internationalization via `chrome.i18n`: English, Arabic (RTL), Spanish, French, German.
- Settings page for provider selection, model selection, and API-key management.
- MIT license, Buy Me a Coffee and GitHub Sponsors support links.

[Unreleased]: https://github.com/KarimElhakim/jsnap/compare/v0.4.3...HEAD
[0.4.3]: https://github.com/KarimElhakim/jsnap/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/KarimElhakim/jsnap/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/KarimElhakim/jsnap/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/KarimElhakim/jsnap/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/KarimElhakim/jsnap/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/KarimElhakim/jsnap/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/KarimElhakim/jsnap/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/KarimElhakim/jsnap/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/KarimElhakim/jsnap/releases/tag/v0.1.0
