# JSnap

One-click page-to-JSON. Free. Local-first.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-blue)](package.json)
[![CI](https://github.com/KarimElhakim/jsnap/actions/workflows/ci.yml/badge.svg)](https://github.com/KarimElhakim/jsnap/actions/workflows/ci.yml)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-lightgrey)](https://github.com/KarimElhakim/jsnap/releases)
[![GitHub stars](https://img.shields.io/github/stars/KarimElhakim/jsnap?style=flat)](https://github.com/KarimElhakim/jsnap/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/KarimElhakim/jsnap?style=flat)](https://github.com/KarimElhakim/jsnap/network/members)

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML](https://img.shields.io/badge/HTML-E34F26?logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS](https://img.shields.io/badge/CSS-1572B6?logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JSON](https://img.shields.io/badge/JSON-000000?logo=json&logoColor=white)](https://www.json.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Node >=20](https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://buymeacoffee.com/karimali)
[![GitHub Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-sponsor-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/KarimElhakim)

JSnap turns any web page into clean, typed JSON in one click. No account. No API key for the default mode. Nothing leaves your browser.

---

## Why I built this

I was working on a side project and needed to convert a long GameFAQs walkthrough into JSON so I could use it elsewhere. Obvious next step: find a Chrome extension that could do it. How hard could it be?

Turns out the Chrome Web Store is packed with scrapers — Visual Web Scraper, DataPick, Simplescraper, Data Scraper, Easy Scraper, Instant Data Scraper, plenty of others. They're all variations on the same pattern: click a field on a page, and the extension harvests that same field across many pages, exports a CSV. They exist for market research, price monitoring, lead generation, competitor analysis. Good tools for that work. Not what I needed.

I didn't want to pick fields. I didn't want to configure a sitemap, train a selector, or sign up for a plan. I wanted to point at one page, hit extract, and get the entire content of that page back as JSON — every paragraph, list, table, code block, and heading, with structure intact. Nothing more, nothing less.

I couldn't find that. So I built it.

## What JSnap actually does

One page. One click. Full content. As JSON.

JSnap walks the DOM directly. It strips the boilerplate (navigation, ads, scripts, cookie banners, footers), then emits a typed tree of sections and content blocks in document order. Every block has a stable `type` discriminator, so downstream code can `switch` on it without guessing:

- `paragraph`
- `list` (ordered or not)
- `table` (headers plus rows)
- `code` (preserved verbatim — walkthroughs, code snippets, ASCII art)
- `quote`
- `image` (src, alt, caption)

For old-school pages that dump their entire content into one big `<pre>` block — GameFAQs walkthroughs, man pages, FAQ documents — JSnap detects heading patterns (underlined titles, roman-numeral sections, numbered chapters) and restores the section hierarchy automatically.

## How JSnap is different

A lot of extensions in this space lean on one of two approaches:

1. **Visual scrapers** (Visual Web Scraper, Simplescraper, Data Scraper, the dozens on the Chrome Web Store). You click elements, configure selectors, maybe run across many pages, export CSV. Great for "extract prices across 500 product URLs." Not for "give me this whole article as JSON."
2. **AI-powered extractors** (DataPick, Web to JSON, most of the "AI web scraper" crowd). You describe what you want, the extension uploads the page to an LLM, the LLM returns JSON. Powerful when you need fuzzy extraction, but you're trading latency, API costs, truncation limits, quota management, and "send page to cloud" privacy for something that deterministic code can do instantly.

JSnap's default mode is neither. It's a deterministic DOM-to-JSON translator — 100 ms per page, no network, no key, no cost, same input always gives the same output. Feed it your page, get back a faithful representation. That's the whole product.

The LLM modes are there for when you actually want intelligence on top (summaries, specific-field extraction, etc.) — bring your own key for Gemini, Groq, Ollama, or any OpenAI-compatible endpoint. But they're optional. You never need them.

## Features

- **Raw mode (default):** deterministic, instant, free, local. No API key. Same input, same output, every time.
- **Optional LLM modes (BYOK):** Structure (LLM preserves full text), Summary (condensed digest), Data (tables and specs only).
- **Providers for LLM modes:** Google Gemini, Groq, Ollama (local), any OpenAI-compatible endpoint (OpenRouter, Together, LM Studio, vLLM, self-hosted).
- **Typed output schema:** every content block has a `type` discriminator so downstream code doesn't have to guess.
- **Works on stubborn pages:** heading detection inside `<pre>` blocks handles GameFAQs walkthroughs, man pages, ASCII-styled FAQs.
- **Five UI languages:** English, Arabic (RTL), Spanish, French, German. More welcome via PR.
- **Light and dark themes** with system preference detection.
- **Manifest V3**, targets Chrome 120+.
- **MIT licensed. No telemetry. No account. No cloud.**

---

## Install

### Chrome Web Store

Coming soon. The build is ready; paid developer listing is pending.

### Side-load (works today)

1. Download the latest `jsnap-<version>.zip` from the [Releases page](https://github.com/KarimElhakim/jsnap/releases).
2. Unzip it somewhere memorable.
3. Open `chrome://extensions`.
4. Turn on **Developer mode** (top-right toggle).
5. Click **Load unpacked** and pick the unzipped folder.

The JSnap icon will appear in your toolbar.

---

## Use it

1. Open any regular web page — an article, a Wikipedia entry, a walkthrough, a documentation page.
2. Click the JSnap icon.
3. Click **Extract JSON**.

That's the whole flow. No key, no signup, nothing to configure. You get clean JSON back in a second.

If you ever want the LLM modes (Structure / Summary / Data), open the JSnap options page and paste an API key. Good free options, no credit card required:

- **Google AI Studio** for Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Groq** for Llama: [console.groq.com/keys](https://console.groq.com/keys)
- **Ollama** for fully local models: [ollama.com/download](https://ollama.com/download)

Keys live only in `chrome.storage.local` on your device. They go to the provider you picked and nowhere else.

---

## Output shape

```json
{
  "title": "Mega Man Battle Network 2 - Guide and Walkthrough",
  "url": "https://gamefaqs.gamespot.com/...",
  "description": null,
  "language": "en",
  "sections": [
    {
      "heading": "I. INTRODUCTION",
      "level": 1,
      "blocks": [
        { "type": "paragraph", "text": "MegaMan Battle Network 2 was released..." },
        { "type": "paragraph", "text": "My guide aims to lead the player..." }
      ],
      "subsections": []
    },
    {
      "heading": "II. BASICS",
      "level": 1,
      "blocks": [],
      "subsections": [
        {
          "heading": "GENERAL CONTROLS",
          "level": 2,
          "blocks": [
            {
              "type": "code",
              "text": "Button:   Function:\nA         Accept/confirm...",
              "language": null
            }
          ],
          "subsections": []
        }
      ]
    }
  ],
  "__meta": {
    "mode": "raw",
    "extractorVersion": "2.0.0",
    "extractedAt": "2026-04-21T17:05:00.000Z",
    "stats": { "sections": 47, "blocks": 1240, "characters": 342105, "elapsedMs": 87 }
  }
}
```

The schema is stable across minor versions. Every block has a `type`. If you're writing a tool that consumes JSnap output, you can rely on the shape.

---

## Privacy

- No backend. No analytics. No telemetry. No account.
- **Raw mode never leaves your browser.** It's pure JavaScript walking the DOM you already loaded.
- **LLM modes** send the cleaned page content and your API key directly to the provider you picked (Gemini, Groq, Ollama, OpenAI-compatible). JSnap does not proxy, log, or intercept any of that traffic.
- API keys are stored in `chrome.storage.local` on your device, unencrypted, which is the standard pattern for browser extensions that handle keys. The realistic threats here are browser-profile compromise and local malware — full-disk encryption on your OS is the right mitigation, not an extension-level passphrase. See [SECURITY.md](SECURITY.md) for the full reasoning and disclosure policy.

---

## Development

Requirements: Node.js 20 or later.

```
npm install
npm run dev       # Vite in watch mode, writes to dist/
npm run build     # production build
npm run package   # creates jsnap-<version>.zip for submission
npm run format    # Prettier
```

Load the unpacked extension:

1. `npm run build`
2. `chrome://extensions` → enable Developer mode → **Load unpacked** → pick `dist/`.
3. After each rebuild, click the reload icon on the JSnap extension card.

Architecture, module boundaries, and the message contract between popup / options / content / background all live in [PLAN.md](PLAN.md). It's the binding spec — read it before you open a PR.

---

## Roadmap

Real candidates for the next few versions:

- Direct export to `.json` file (skip copy-paste).
- Saved presets (a hint plus mode combo you reuse often).
- "Extract selection" from the page context menu.
- Firefox port — the platform shim is already in place.
- More heading patterns for the `<pre>` fallback. If you find a page that fails, open an issue with the URL and I'll add a rule.

What won't ship:

- A cloud dashboard.
- A paid tier that gates core extraction.
- Telemetry of any kind.

---

## Contributing

Issues and PRs welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR — it's short. For significant changes, open an issue first so we can agree on the shape before you spend time on code.

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Support the project

JSnap is free to use and always will be. If it saves you time and you want to send a coffee my way, it's genuinely appreciated:

- [Buy Me a Coffee](https://buymeacoffee.com/karimali)
- [GitHub Sponsors](https://github.com/sponsors/KarimElhakim)

---

## License

MIT. Copyright 2026 Karim Elhakim. See [LICENSE](LICENSE) for the full text.

---

<div align="center">Built by <a href="https://github.com/KarimElhakim">Karim Elhakim</a>. No ads. No tracking. No cloud.</div>
