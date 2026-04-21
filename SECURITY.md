# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in JSnap, please **do not** open a public GitHub issue. Instead, report it privately:

- Use GitHub's [private vulnerability reporting](https://github.com/KarimElhakim/jsnap/security/advisories/new), or
- Email the maintainer via the contact link on the [project homepage](https://github.com/KarimElhakim/jsnap).

Please include:

- A description of the issue and its impact
- Steps to reproduce
- Any suggested mitigation

You will receive an acknowledgement within 72 hours.

## Scope

JSnap is a browser extension that runs entirely in the user's browser and sends requests directly to the LLM provider's API using the user's own key. It has no backend.

Security-relevant areas:

- Handling and storage of user-provided API keys
- Content script sanitization of untrusted page content
- Message passing between popup, content, and background contexts
- Outbound fetch requests to provider APIs

Out of scope:

- Security of third-party LLM providers
- Security of the user's operating system or browser profile

## Supported versions

Only the latest minor release on the `main` branch receives security fixes.
