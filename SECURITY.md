# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email **security@thox.ai** with:

- A description of the issue
- Reproduction steps (smallest reproducible case)
- Affected package(s) and version(s)
- Your suggested severity, if any

You will receive an acknowledgement within 48 hours. We aim to ship
fixes for confirmed vulnerabilities within 14 days for high severity
and 30 days for medium severity.

## Scope

In scope:

- `thoxcode`, `thoxcode-core`, `thoxcode-sandbox-runtime`, `thoxcode-daemon` packages
- The `apps/sandbox` Next.js app deployed to `sandbox.thox.ai`
- The web bridge code under `packages/web-bridge`

Out of scope:

- Third-party dependencies (`@anthropic-ai/claude-agent-sdk`,
  `@vercel/sandbox`, `hono`, `jose`, etc.) — please report those
  upstream.
- Issues that require physical access to a Jetson Orin device or
  ThoxOS host beyond the documented attack surface.
- DoS via resource exhaustion in user-controlled paths (e.g. very long
  prompts, very large files). We treat these as quality issues, not
  security issues.

## Trust model

See [docs/security.md](docs/security.md) for the full trust-boundary
write-up.

## Coordinated disclosure

We will credit reporters in the changelog unless they prefer to remain
anonymous. We do not currently run a paid bug bounty.
