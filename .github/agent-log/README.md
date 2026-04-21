# Agent Log

This folder contains per-stage markdown logs for every AI-assisted contribution to JSnap.

Each log records:

- Stage number and description
- Agent type (parent session / dispatched sub-agent)
- Model used (e.g. `opus-4.7`, `sonnet-4.5`)
- Files created or modified
- Acceptance criteria from `PLAN.md` and whether they were met
- Any deviations from `PLAN.md` with justification

The log format is:

```
<stage>-<short-description>.md
```

Example: `stage-01-foundation.md`, `stage-06a-groq-provider.md`.

These logs are not runtime code. They exist for audit, reproducibility, and to help future contributors understand why decisions were made.
