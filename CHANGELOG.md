# Changelog

All notable changes to ThoxCode are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] — 2026-04-30

### Fixed

- **Install bug** — `npm i thoxcode` was failing with
  `EUNSUPPORTEDPROTOCOL: Unsupported URL Type "workspace:": workspace:*`.
  Root cause: I used `npm publish` from inside each package, which
  ignores `pnpm`'s workspace-protocol rewrite hook. Switching to
  `pnpm publish --no-git-checks --access public` fixes it.
- All `0.1.0` and `0.1.1` versions deprecated on npm with a pointer to
  `0.1.2+`. `thoxcode-core@0.1.0` was technically functional (no
  workspace deps) but is deprecated for version-suite consistency.

### Process change

- The contributor docs and any future automation will use
  `pnpm publish` exclusively, never `npm publish`, until/unless we
  switch to a release script that explicitly resolves workspace deps
  before invoking npm.

## [thoxcode 0.1.1] — 2026-04-30

### Added

- **Postinstall welcome** — `npm i -g thoxcode` now prints a short
  next-steps panel (set `ANTHROPIC_API_KEY`, sample command, links to
  README / ROADMAP / issues). Quiet in CI, non-TTY, `--silent`, or
  when `THOXCODE_DISABLE_POSTINSTALL=1`.
- **`ROADMAP.md`** — concrete plan through v1.0: CI/CD via Trusted
  Publishers, web-bridge npm release, real Supabase OAuth,
  `thoxcode-sandthox-runtime` execution backend, file-tree pane,
  MagStack distributed quantum tools.

### Notes

- CLI-only release. `thoxcode-core`, `thoxcode-sandbox-runtime`, and
  `thoxcode-daemon` remain at `0.1.0`.

## [0.1.0] — 2026-04-30

First public release. Published to npm, sources at
https://github.com/ttracx/thoxcode.

### Added

- **`thoxcode`** CLI — `npm i -g thoxcode`. Run agentic coding tasks from
  your terminal against the host filesystem.
- **`thoxcode-core`** — agent runtime built on the
  [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview).
  Exposes `runAgent(...)`, `resolveAuth(...)`, `THOXCODE_IDENTITY`,
  `thoxSystemPrompt(...)`, and the `ThoxQuantum` MCP server.
- **`thoxcode-sandbox-runtime`** — Vercel Sandbox tool adapters
  (`sandbox_bash`, `sandbox_read`, `sandbox_write`, `sandbox_edit`,
  `sandbox_ls`, `sandbox_preview_url`) and the `SandboxLease` lifecycle
  helper.
- **`thoxcode-daemon`** — `thoxcoded` Unix-socket service for
  ThoxOS / Jetson hosts. Includes systemd unit, install script, and
  programmatic client (`runViaDaemon`).
- **`apps/sandbox`** — Next.js 15 web playground for `sandbox.thox.ai`,
  with Thox-native chrome (Nova Space Gray + Quantum Cyan), live
  delta-rendered messages, and a workspace bar for git-clone bootstrap.
- Dual auth: BYOK (user-supplied `sk-ant-…` header) and managed
  (Supabase JWT verified via `jose`, HS256/RS256/ES256 + JWKS support).
- Streaming partial messages (`assistant_text_delta`) via the SDK's
  `includePartialMessages` flag.

### Notes

- Anthropic Agent SDK 0.2.123. Opus 4.7 (`claude-opus-4-7`) is the
  default model — requires SDK ≥ 0.2.111.
- ThoxCode is "Powered by Claude" per the
  [Agent SDK branding guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines)
  and deliberately does not mimic Claude Code's chrome.
