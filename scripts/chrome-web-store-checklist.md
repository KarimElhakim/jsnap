# Chrome Web Store Submission Checklist

Run through this list before uploading `jsnap-<version>.zip` to the Chrome Web Store Developer Dashboard.

---

## 1. Zip file

- [ ] `npm run build` completes with zero errors.
- [ ] `npm run package` produces `jsnap-<version>.zip` at the project root.
- [ ] Load the unpacked `dist/` folder in `chrome://extensions` (Developer mode) and verify the popup opens, options page opens, and extraction works on at least one page.
- [ ] Zip size is under the 10 MB CWS limit.

---

## 2. Promotional images

All images must be PNG or JPEG, sRGB color space, no alpha transparency.

| Asset                  | Required size | Notes                                                         |
| ---------------------- | ------------- | ------------------------------------------------------------- |
| Small promotional tile | 440 × 280 px  | Used in search results and category pages                     |
| Large promotional tile | 920 × 680 px  | Featured placement                                            |
| Marquee banner         | 1400 × 560 px | Required for featuring; submit even if not initially featured |

- [ ] Small promotional tile (440 × 280) created and ready.
- [ ] Large promotional tile (920 × 680) created and ready.
- [ ] Marquee banner (1400 × 560) created and ready.

---

## 3. Screenshots

- [ ] 1–5 screenshots provided (at least 1 is required).
- [ ] Each screenshot is exactly **1280 × 800** or **640 × 400** pixels, PNG.
- [ ] Screenshots show the real extension UI — the popup extracting a real page and the options page with a provider configured.
- [ ] No placeholder or lorem-ipsum content visible in any screenshot.

---

## 4. Store listing text

### Short description (132 character max)

Suggested text (125 chars):

> Extract structured JSON from any web page with one click. Bring your own LLM key — Gemini, Groq, Ollama, or any OpenAI-compatible API.

- [ ] Short description is 132 characters or fewer.
- [ ] Short description does not begin with "A" or "An" (CWS guideline).

### Detailed description (16,000 character max)

- [ ] Detailed description is under 16,000 characters.
- [ ] Description explains what the extension does, what data it accesses, and why.
- [ ] No keyword stuffing. CWS auto-rejects listings with excessive repetition.

---

## 5. Permissions justification

The extension declares three permissions. Use the exact justification strings below when the CWS review form asks for them.

### `storage`

> JSnap stores API keys and user preferences (selected provider, model, theme, locale, and daily usage counters) in `chrome.storage.local`. No data leaves the device. Storage is necessary to persist configuration across browser sessions without requiring the user to re-enter their API key on every use.

### `activeTab`

> JSnap reads the text content of the current active tab when the user clicks the extension action button. Access is strictly on-demand; the extension never reads any tab the user has not explicitly triggered an extraction on. `activeTab` grants this scoped, user-initiated access without requiring broad host permissions.

### `scripting`

> JSnap injects a small content script into the active tab to extract and sanitize page text. Injection happens only when the user clicks the extension action button. `scripting` is required because MV3 prohibits registering content scripts at runtime without this permission. The injected script reads `document.body` text only; it never modifies the page.

- [ ] All three justification strings are entered in the Developer Dashboard permissions section.

---

## 6. Single-purpose description

The CWS single-purpose policy requires every extension to have one clearly stated purpose.

**JSnap's single purpose:** Extract structured JSON from the current web page using a user-supplied LLM API key.

- [ ] Store listing clearly states this single purpose in the first sentence of the detailed description.
- [ ] No unrelated features are bundled (no bookmarks manager, no tab organiser, no newsfeed, etc.).

---

## 7. Category

- [ ] Primary category set to **Developer Tools**.
- [ ] Secondary category (optional): **Productivity**.

---

## 8. Remote code policy

Chrome Web Store prohibits extensions that load or execute remote code.

JSnap bundles all JavaScript at build time via Vite. There is no:

- `eval()` or `new Function()` call anywhere in the codebase.
- Remotely fetched script (`<script src="https://...">` or dynamic `import(url)`).
- `chrome.scripting.executeScript` called with `func` sourced from a remote URL.

All LLM API calls are outbound `fetch()` requests that return data (JSON text). The response data is parsed — never executed.

- [ ] Confirm no remote code execution by running `grep -r "eval(" dist/` and `grep -r "new Function(" dist/` — both should return empty.
- [ ] Note this explicitly in the privacy practices section of the listing: "This extension does not load or execute any remote code."

---

## 9. Privacy policy

CWS requires a privacy policy URL for extensions that handle user data. JSnap stores API keys locally and transmits them to the user's chosen provider.

**Recommended approach:** Host a minimal policy on GitHub Pages from the same repository.

1. Create `docs/privacy-policy.md` in the repo.
2. Enable GitHub Pages for the `docs/` folder on the `main` branch.
3. Privacy policy URL: `https://karimali.github.io/jsnap/privacy-policy`

**Minimum required content for the privacy policy:**

- What data is collected: API keys and usage counters (stored locally only).
- What data is transmitted: API keys and page text are sent to the provider URL the user configured, and nowhere else.
- No data is sent to the extension developer.
- No analytics, no telemetry, no third-party tracking.
- Data retention: data is stored in `chrome.storage.local` and deleted when the extension is uninstalled or when the user clears it from the options page.

- [ ] Privacy policy page is live and publicly reachable before submission.
- [ ] Privacy policy URL is entered in the Developer Dashboard.

---

## 10. Content rating / audience

- [ ] Audience set to **Everyone** (no mature content).
- [ ] Content rating questionnaire completed in the Developer Dashboard.

---

## 11. Final review checklist

- [ ] Extension version in `manifest.json` matches `package.json` version.
- [ ] `manifest.json` includes `"minimum_chrome_version": "120"`.
- [ ] All icon sizes (16, 32, 48, 128) are present in the zip under `icons/`.
- [ ] `_locales/en/messages.json` is present (required when `default_locale` is set).
- [ ] No `console.log` calls left in production bundle (verify: `grep -r "console.log" dist/`).
- [ ] No hardcoded API keys anywhere in `dist/` (verify: `grep -rE "AIza|gsk_|sk-" dist/`).
- [ ] Developer Dashboard: contact email is set.
- [ ] Developer Dashboard: developer name/display name is set.
