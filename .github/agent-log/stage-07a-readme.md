# Stage 7a — README

**Date:** 2026-04-21
**Agent:** Sonnet 4.6 (subagent, Stage 7a)
**Task:** Write the production README for JSnap v0.1.0.

---

## Word count

Approximately 1,040 words (shell: `($content -split '\s+' | Where-Object { $_ -ne '' }).Count`).

---

## Sections (in order)

1. Title and tagline
2. Badges row 1 — License, Version, CI, Chrome Web Store placeholder, Stars, Forks
3. Badges row 2 — JavaScript, HTML, CSS, JSON, Manifest V3, Node >=20
4. Badges row 3 — Buy Me a Coffee, GitHub Sponsors
5. One-sentence pitch paragraph
6. Screenshots (placeholder comments with relative paths)
7. Highlights
8. Quick start (two paths: Chrome Web Store and Load unpacked)
9. Get a free Gemini API key in 60 seconds
10. Providers table
11. Languages
12. How it works
13. Privacy
14. Development
15. Architecture
16. Roadmap
17. Contributing
18. Sponsorship
19. License
20. Centered footer

---

## Badges used

| Badge            | Shield URL pattern                                                  | Notes                                     |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| License MIT      | `img.shields.io/badge/License-MIT-blue.svg`                         | Links to LICENSE                          |
| Version 0.1.0    | `img.shields.io/badge/version-0.1.0-blue`                           | Links to package.json                     |
| CI               | `github.com/KarimElhakim/jsnap/actions/workflows/ci.yml/badge.svg`  | Links to Actions                          |
| Chrome Web Store | `img.shields.io/badge/Chrome%20Web%20Store-coming%20soon-lightgrey` | Placeholder; links to repo                |
| GitHub Stars     | `img.shields.io/github/stars/KarimElhakim/jsnap`                    | Links to stargazers                       |
| GitHub Forks     | `img.shields.io/github/forks/KarimElhakim/jsnap`                    | Links to forks                            |
| JavaScript       | `img.shields.io/badge/JavaScript-F7DF1E` with black text            | Language color convention                 |
| HTML             | `img.shields.io/badge/HTML-E34F26` with white text                  | Language color convention                 |
| CSS              | `img.shields.io/badge/CSS-1572B6` with white text                   | Language color convention                 |
| JSON             | `img.shields.io/badge/JSON-000000` with white text                  | Language color convention                 |
| Manifest V3      | `img.shields.io/badge/Manifest-V3-4285F4`                           | Google Chrome blue                        |
| Node >=20        | `img.shields.io/badge/Node-%3E%3D20-339933`                         | Node.js green                             |
| Buy Me a Coffee  | `img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00`         | Links to buymeacoffee.com/karimali        |
| GitHub Sponsors  | `img.shields.io/badge/GitHub%20Sponsors-sponsor-EA4AAA`             | Links to github.com/sponsors/KarimElhakim |

Total badges: 14.

---

## Deviations from spec

- **`<50ms cold start` claim omitted.** The PLAN.md spec says "Popup loads in <100ms on cold start" (acceptance criterion for Stage 4). The `<50ms` figure in the task brief had no corresponding evidence in the codebase or plan, so the more conservative `<100ms` figure from the spec was used instead. The Highlights section references "WCAG AA" and a "daily usage meter" which are confirmed in the plan and code.
- **Screenshots section uses HTML comments** rather than broken image links, per the task instruction ("no need to create the images; use the `alt="..."` and relative path as commented placeholders").
- **SECURITY.md and CONTRIBUTING.md referenced** in Privacy and Contributing sections respectively. These files do not exist yet in the codebase; they are referenced as forward-declared artifacts consistent with how a mature open-source project structures its governance.
- **`<50ms` cold start** was listed in the task brief Highlights. The manifest and Vite build target are designed for performance but no benchmark was run. Replaced with the spec's stated acceptance criterion of `<100ms` to remain honest about what is verified.

---

## Files modified

- `README.md` — overwritten (was a placeholder).

## Files created

- `.github/agent-log/stage-07a-readme.md` — this file.

## Files NOT modified

All other files in the repository were left untouched. No commits made.
