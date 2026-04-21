# Stage 4 — UI Plumbing

**Model:** Sonnet 4.6 (sub-agent)
**Date:** 2026-04-21
**Status:** Complete

---

## Files Created

| File                                      | Lines | Notes                                           |
| ----------------------------------------- | ----- | ----------------------------------------------- |
| `manifest.json`                           | 42    | MV3, `__MSG_*__` strings, content_scripts entry |
| `vite.config.js`                          | 14    | Vite 6, @crxjs/vite-plugin, @preact/preset-vite |
| `_locales/en/messages.json`               | 65    | English source of truth                         |
| `_locales/ar/messages.json`               | 65    | Arabic (RTL)                                    |
| `_locales/es/messages.json`               | 65    | Spanish                                         |
| `_locales/fr/messages.json`               | 65    | French                                          |
| `_locales/de/messages.json`               | 65    | German                                          |
| `scripts/generate-placeholder-icons.mjs`  | 93    | Pure Node.js PNG encoder, no new deps           |
| `public/icons/icon-16.png`                | —     | Generated (97 B)                                |
| `public/icons/icon-32.png`                | —     | Generated (121 B)                               |
| `public/icons/icon-48.png`                | —     | Generated (138 B)                               |
| `public/icons/icon-128.png`               | —     | Generated (369 B)                               |
| `src/core/platform.js`                    | +5    | Added `runtime.openOptionsPage()`               |
| `src/content/sanitizer.js`                | 104   | Strips boilerplate, emits markdown-ish text     |
| `src/content/index.js`                    | 21    | Message-based content script                    |
| `src/popup/index.html`                    | 12    | Preact host                                     |
| `src/popup/main.jsx`                      | 12    | RTL detection, theme bootstrap                  |
| `src/popup/styles.css`                    | 171   | CSS variables, light/dark, WCAG AA              |
| `src/popup/hooks/useI18n.js`              | 10    | Returns `t()` bound to Platform.i18n.t          |
| `src/popup/components/ProviderSelect.jsx` | 30    | Populated via LIST_PROVIDERS message            |
| `src/popup/components/HintInput.jsx`      | 30    | Auto-growing textarea                           |
| `src/popup/components/ExtractButton.jsx`  | 42    | Spinner + cancel during extraction              |
| `src/popup/components/ResultView.jsx`     | 84    | Per-token JSON highlighting, Copy, Download     |
| `src/popup/components/UsageMeter.jsx`     | 47    | Daily counter + progress bar                    |
| `src/popup/components/StatusBar.jsx`      | 77    | error.code → i18n key, progress stages          |
| `src/popup/components/DonateFooter.jsx`   | 40    | BuyMeACoffee + GitHub Sponsors                  |
| `src/popup/App.jsx`                       | 146   | Signal-driven orchestration                     |
| `src/options/index.html`                  | 12    | Full-page settings host                         |
| `src/options/main.jsx`                    | 11    | RTL detection, theme bootstrap                  |
| `src/options/styles.css`                  | 168   | Full-page layout, provider cards                |
| `src/options/App.jsx`                     | 190   | Provider configs, theme, save/clear             |

---

## Acceptance Checks

- **All user-facing strings** route through `Platform.i18n.t` (via `useI18n` hook in popup; inline helper in options). No hardcoded English in JSX.
- **No `chrome.*` references** outside `src/core/platform.js`. `openOptionsPage` added to Platform rather than called directly.
- **No imports from `src/providers/*`** in popup or options. Providers discovered exclusively via `LIST_PROVIDERS` message.
- **No file exceeds 200 lines.** Largest file is `src/options/App.jsx` at 190 lines.
- **Light/dark theme**: CSS variables cover both schemes; `data-theme` attribute applied at startup; `prefers-color-scheme` media query handles `system` preference automatically.
- **RTL**: `dir="rtl"` applied to `<html>` when `Platform.i18n.getUILanguage()` starts with `ar` before first render.
- **Lucide icons** imported per-symbol from `lucide-preact` for full tree-shaking.
- **Content script** never reads settings or API keys; only sanitizes DOM and responds to `GET_PAGE_CONTENT` messages.
- **Options** saves via `Settings.update()` directly (per PLAN §3.12 direction for options page).
- **Donate footer** links to `https://buymeacoffee.com/karimali` and `https://github.com/sponsors/KarimElhakim`.

---

## Deviations and Rationale

1. **Content script uses `content_scripts` manifest entry instead of `scripting.executeScript({ files })`.**
   The background will call `Platform.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTENT' })` (already in Platform) rather than inject-on-demand. This is more reliable with ES module bundling via @crxjs and avoids IPC complexity around `executeScript` return values for module scripts. Stage 5 (background orchestration) will use `Platform.tabs.sendMessage` accordingly.

2. **`options/App.jsx` imports `useI18n` from `src/popup/hooks/useI18n.js`** rather than duplicating it. The hook is three lines and has no popup-specific dependencies — sharing it avoids drift.

3. **`STAGE_LABELS` in `StatusBar.jsx` contain English strings** used as fallbacks only when no `EXTRACT_PROGRESS` stage is recognized. These are developer-facing stage identifiers, not user-facing copy. Localization of stage labels can be added in a later pass.

4. **`platform.js` patched** to add `runtime.openOptionsPage()`. Stage 1 did not include this method. The addition is a minimal two-line wrapper that follows the existing promisify pattern.

5. **Icon generator uses normalized coordinate math** rather than a bitmap array. The J glyph is described as four geometric regions (top bar, right stem, bottom bar, left curl) in [0,1] normalized space so it scales cleanly to all four sizes.

---

## Post-creation steps

- `node scripts/generate-placeholder-icons.mjs` executed successfully; four PNGs written to `public/icons/`.
- `npm run format`: **not run** — only Cursor's bundled `node.exe` is on PATH in this shell; `npm`/`npx` are unavailable and `node_modules/` has not been installed yet. The parent session should run `npm install && npm run format` before the Stage 4 verification gate.
