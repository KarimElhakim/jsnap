# Contributing to JSnap

Thanks for your interest. JSnap is a small, focused Chrome extension with a deliberately simple scope: one page, one click, one JSON. Contributions that preserve that simplicity are welcome.

## Ground rules

1. Read `PLAN.md` before writing code. It defines the architecture, interfaces, and acceptance criteria for every file.
2. No file exceeds 200 lines. If it grows past that, split it.
3. No cross-layer imports. `providers/*` never imports from `popup/*` or `background/*`. `core/*` never imports from `providers/*`.
4. No hidden state in `background/`. MV3 service workers are evicted aggressively; persist any non-trivial state to `chrome.storage`.
5. All user-facing strings go through `_locales/en/messages.json` and are retrieved via `chrome.i18n.getMessage`.
6. All errors are typed (`core/errors.js`). Never throw raw strings or plain `Error`.
7. Never log, serialize, or surface API keys. The redactor in `core/logger.js` must handle anything you want to log.

## Development

```bash
npm install
npm run dev       # HMR dev build into dist/
npm run build     # production build into dist/
npm run package   # zips dist/ for Chrome Web Store submission
```

Load the extension in Chrome:

1. Go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.

## Commit style

- Conventional-commit-ish: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`.
- Reference issues: `fix: retry on 429 (closes #42)`.
- One logical change per commit.

## Pull requests

- Fill out the PR template.
- Ensure `npm run lint` and `npm run build` pass locally.
- If your change adds a user-facing string, add it to `_locales/en/messages.json`. Other locales may be updated by maintainers or translators.
- Add a `CHANGELOG.md` entry under `## [Unreleased]`.

## Adding a new provider

1. Create `src/providers/<name>.js` extending `Provider` from `src/providers/base.js`.
2. Register it at the bottom of the file via `registerProvider(id, meta, ctor)`.
3. Add translations for the provider's display name and any new error codes.
4. Add a smoke test under `test/`.

No changes to `factory.js`, `extractor.js`, or the popup are required.

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
