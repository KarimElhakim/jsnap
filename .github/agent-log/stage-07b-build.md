# Stage 7b — Build / Package Toolchain

**Date:** 2026-04-21
**Model:** Claude Sonnet 4.6

---

## Files created

| File                                    | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| `scripts/package.mjs`                   | Node ESM packaging script; produces `jsnap-<version>.zip` |
| `scripts/chrome-web-store-checklist.md` | Pre-submission checklist for CWS upload                   |
| `.github/agent-log/stage-07b-build.md`  | This document                                             |

## Files modified

| File            | Change                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| `manifest.json` | Added `short_name`, `minimum_chrome_version`, removed static `content_scripts` |
| `package.json`  | Added `precheck` script                                                        |

---

## Acceptance criteria status

| Criterion                                                       | Status | Notes                                                                            |
| --------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `npm run package` produces `jsnap-<version>.zip`                | Met    | `scripts/package.mjs` writes `jsnap-0.1.0.zip` at project root                   |
| Zip excludes `.map` files, `.DS_Store`, `Thumbs.db`, empty dirs | Met    | Filtered in `collectFiles()` via `EXCLUDED_NAMES` set and `.map` extension check |
| Prints final path and SHA-256 hash                              | Met    | Output section of script                                                         |
| Exits non-zero on any error with a clear message                | Met    | `die()` helper writes to stderr and calls `process.exit(1)`                      |
| Chrome Web Store checklist created                              | Met    | `scripts/chrome-web-store-checklist.md`                                          |
| `manifest.json` `minimum_chrome_version: "120"`                 | Met    | Added                                                                            |
| `manifest.json` `short_name: "JSnap"`                           | Met    | Added                                                                            |
| `manifest.json` no `host_permissions`                           | Met    | Was absent; remains absent                                                       |
| `manifest.json` no restrictive CSP                              | Met    | No `content_security_policy` key; MV3 default applies                            |
| `package.json` `precheck` script                                | Met    | `npm run lint && npm run build`                                                  |
| No new runtime dependencies                                     | Met    | `scripts/package.mjs` uses only Node built-ins                                   |

---

## Deviations

### No `archiver` devDependency added

The instructions offered `archiver` as an option. A pure built-ins approach was chosen instead (`node:zlib` deflate + manual ZIP32 header writing). This avoids adding any dependency, keeps the install size smaller, and requires no `npm install` step to use the packaging script. The implementation covers everything a Chrome extension zip needs: deflate compression, CRC-32 checksums, correct local file headers, central directory, and end-of-central-directory record.

The ZIP32 format is sufficient; Chrome extensions do not approach the 4 GB per-file or 65,535-file limits where ZIP64 would be needed.

### `content_scripts` removed from `manifest.json`

The previous manifest declared the content script at `src/content/index.js` as a static content script matching `<all_urls>`. This contradicts the architecture (Stage 5 background injects the script on demand via `chrome.scripting.executeScript`) and would cause the script to run on every page load rather than only on user-triggered extractions.

Removing this entry:

- Eliminates the implicit broad host-permission request that `<all_urls>` introduces.
- Aligns the manifest with the on-demand injection pattern described in `PLAN.md §3.11`.
- Reduces the permissions surface visible to CWS reviewers.

The `scripting` permission already declared in `permissions[]` covers dynamic injection. The `@crxjs/vite-plugin` will bundle the content script file as long as it is referenced from the background entry point (which it is via `chrome.scripting.executeScript`). If the plugin does not auto-detect the reference, adding the file path to `web_accessible_resources` is the standard fallback — that change can be made if a build error surfaces.

---

## Verification steps

After running `npm install` and `npm run build`:

```sh
# Verify packaging script
node scripts/package.mjs

# Confirm zip was created
ls -lh jsnap-0.1.0.zip

# Confirm source maps are excluded
unzip -l jsnap-0.1.0.zip | grep "\.map"  # should return nothing

# Confirm .DS_Store is excluded
unzip -l jsnap-0.1.0.zip | grep "DS_Store"  # should return nothing
```
