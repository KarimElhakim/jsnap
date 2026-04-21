# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/KarimElhakim/jsnap/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/KarimElhakim/jsnap/releases/tag/v0.1.0
