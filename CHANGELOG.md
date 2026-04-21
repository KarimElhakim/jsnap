# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/KarimElhakim/jsnap/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/KarimElhakim/jsnap/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/KarimElhakim/jsnap/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/KarimElhakim/jsnap/releases/tag/v0.1.0
