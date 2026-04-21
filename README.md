# JSnap

One-click page-to-JSON. BYOK. Free forever.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](package.json)
[![CI](https://github.com/KarimElhakim/jsnap/actions/workflows/ci.yml/badge.svg)](https://github.com/KarimElhakim/jsnap/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-lightgrey)](https://github.com/KarimElhakim/jsnap)
[![GitHub Stars](https://img.shields.io/github/stars/KarimElhakim/jsnap?style=flat)](https://github.com/KarimElhakim/jsnap/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/KarimElhakim/jsnap?style=flat)](https://github.com/KarimElhakim/jsnap/network/members)

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML](https://img.shields.io/badge/HTML-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JSON](https://img.shields.io/badge/JSON-000000?logo=json&logoColor=white)](https://www.json.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Node >=20](https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/karimali)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-sponsor-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/KarimElhakim)

JSnap is a Chrome extension that extracts structured JSON from any web page using your own LLM API key — no backend, no account, no subscription.

---

## Screenshots

<!-- Add screenshots once captured. -->
<!-- ![Popup](docs/screenshots/popup.png) -->
<!-- ![Options page](docs/screenshots/options.png) -->

---

## Highlights

- **BYOK** — keys are stored only in `chrome.storage.local` and sent only to the provider you selected.
- **Free forever** — no subscription, no account, no backend.
- **Four providers** — Gemini, Groq, Ollama (local), and any OpenAI-compatible endpoint (OpenRouter, Together, LM Studio, LocalAI, self-hosted).
- **Five languages** — English, Arabic (RTL), Spanish, French, German.
- **Light and dark themes** — follows `prefers-color-scheme` with a manual override.
- **Manifest V3** — built for Chrome's current extension platform.
- **WCAG AA** — accessible color contrast across both themes.
- **Daily usage meter** — per-provider rolling counters so you can track free-tier consumption.
- **Optional extraction hint** — scope the output with a plain-English description.
- **Typed error handling** — every failure surfaces a machine-readable code, not a raw stack trace.

---

## Quick start

### Option A — Chrome Web Store (coming soon)

The extension has not been listed yet. Watch this repository for the announcement.

### Option B — Load unpacked from `dist/`

1. Install [Node.js 20+](https://nodejs.org/).
2. Clone the repository:
   ```
   git clone https://github.com/KarimElhakim/jsnap.git
   cd jsnap
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Build the extension:
   ```
   npm run build
   ```
5. Open Chrome and navigate to `chrome://extensions`.
6. Enable **Developer mode** (toggle in the top-right corner).
7. Click **Load unpacked** and select the `dist/` folder.
8. The JSnap icon appears in your toolbar. Click it to open the popup.
9. Open the options page, enter your API key for your chosen provider, and save.

---

## Get a free Gemini API key in 60 seconds

No credit card required.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Sign in with a Google account.
3. Click **Create API key**.
4. Copy the key.
5. Open the JSnap options page, select **Gemini**, paste the key, and save.

---

## Providers

| Provider          | Free tier           | Requires key | Documentation                                                    |
| ----------------- | ------------------- | ------------ | ---------------------------------------------------------------- |
| Google Gemini     | Yes                 | Yes          | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Groq              | Yes                 | Yes          | [console.groq.com/keys](https://console.groq.com/keys)           |
| Ollama (local)    | Yes — runs locally  | No           | [ollama.com/download](https://ollama.com/download)               |
| OpenAI-compatible | Depends on endpoint | Usually yes  | Varies by endpoint                                               |

---

## Languages

The extension ships with translations for the following locales:

- `en` — English (default)
- `ar` — Arabic (right-to-left)
- `es` — Spanish
- `fr` — French
- `de` — German

Chrome selects the locale automatically based on your browser language. PRs adding additional locales are welcome.

---

## How it works

When you click the extract button, the background service worker injects a content script that strips scripts, styles, ads, and boilerplate from the current page, then returns the cleaned text. The background worker builds a versioned extraction prompt from that text and any optional hint you provided, then sends a single `fetch` request to your chosen provider. The raw response is parsed and validated — with one automatic repair pass for common JSON formatting issues — and stamped with a `__meta` block containing the source URL and extraction timestamp. Your API key is read from `chrome.storage.local` inside the background service worker and is never exposed to the content script or the popup.

---

## Privacy

- No backend. No analytics. No telemetry.
- API keys are stored exclusively in `chrome.storage.local` on your device.
- Keys are transmitted only to the provider you selected, and only during an active extraction.
- The logger redacts any value matching the pattern `api_key`, `apikey`, `authorization`, or `bearer` before writing to the console.
- See [SECURITY.md](SECURITY.md) for the full disclosure policy.

---

## Development

**Prerequisites:** Node.js 20 or later.

```
npm install          # install dependencies
npm run dev          # start Vite in watch mode (outputs to dist/)
npm run build        # production build
npm run package      # create jsnap-0.1.0.zip for Chrome Web Store submission
npm run lint         # check formatting with Prettier
```

After running `npm run dev` or `npm run build`:

1. Go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. After each rebuild, click the reload icon next to JSnap in the extensions list.

---

## Architecture

The codebase is organized in four layers. `core/` contains pure, framework-agnostic modules: error types, storage, settings, logging, platform abstraction, the extraction prompt, the content chunker, the JSON validator, and the orchestration logic. `providers/` contains one file per LLM provider, each self-registering via a shared factory. `background/` contains the MV3 service worker, which is the only layer that reads API keys and calls providers. `popup/` and `options/` are Preact applications that communicate with the background worker exclusively through a versioned message protocol.

Cross-layer imports flow downward only — `popup` and `options` may import from `core`; `core` never imports from `providers`, `background`, or the UI. This rule is enforced in CI.

For the full interface specification — message schemas, provider contract, storage schema, prompt versioning — see [PLAN.md](PLAN.md).

---

## Roadmap

**v0.1.0** — shipped. Core extraction pipeline, four providers, five locales, light/dark themes, WCAG AA, options page.

**v0.2.0 ideas (not committed):**

- Export extracted JSON directly to Notion, Google Sheets, or Airtable.
- Saved extraction presets (reusable hints for common page types).
- Firefox port (the `src/core/platform.js` shim is the primary change point).
- Extraction history with local sync across devices.

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. By participating you agree to abide by the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Issues and pull requests are welcome. For significant changes, open an issue first to discuss the approach.

---

## Sponsorship

JSnap is free to use and will remain free. If it saves you time, consider supporting ongoing development:

- [Buy Me a Coffee](https://buymeacoffee.com/karimali)
- [GitHub Sponsors](https://github.com/sponsors/KarimElhakim)

---

## License

MIT License. Copyright 2026 Karim Elhakim. See [LICENSE](LICENSE) for the full text.

---

<div align="center">Made with care. No ads. No tracking.</div>
