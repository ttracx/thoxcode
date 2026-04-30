# ThoxCode

**Thox.ai's branded coding agent. Powered by Claude.**

ThoxCode is a TypeScript-first agentic coding runtime built on the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview).
It ships in three forms from a single core:

| Frontend                | Where it runs              | Status |
| ----------------------- | -------------------------- | ------ |
| `thoxcode` CLI          | Your terminal              | ✅     |
| `thoxcoded` daemon      | ThoxOS / Jetson (systemd)  | ✅     |
| `sandbox.thox.ai`       | Browser → Vercel Sandbox   | ✅     |

## Layout

```
packages/
  core/             Agent SDK runtime, Thox system prompt, MCP tools, auth
  sandbox-runtime/  Vercel Sandbox tool adapters (Bash/Read/Write/Edit)
  cli/              `thoxcode` binary
  daemon/           `thoxcoded` Unix-socket service for ThoxOS
  web-bridge/       Hono server: SSE → core → Vercel Sandbox per session
apps/
  sandbox/          Next.js 15 app deployed to sandbox.thox.ai
```

## Quick start (CLI, host execution)

```bash
pnpm install
cp .env.example .env       # add ANTHROPIC_API_KEY
pnpm -r build
node packages/cli/dist/bin.js "list files in this directory"
```

Pass `--yolo` to auto-accept edits, `--cwd <dir>` to override the project
root.

## ThoxOS daemon (`thoxcoded`)

On a Jetson Orin or any Linux host, install the system service:

```bash
cd packages/daemon
pnpm build
sudo ./scripts/install.sh
sudo $EDITOR /etc/thoxcode/environment   # set ANTHROPIC_API_KEY
sudo systemctl enable --now thoxcoded
journalctl -u thoxcoded -f
```

Then any user in the `thoxcode` group can drive the daemon from the CLI:

```bash
thoxcode --thoxos "look at /var/log/syslog and tell me what's noisy"
```

The daemon listens on `/run/thoxcode/sock` (override with
`THOXCODE_DAEMON_SOCKET`), speaks JSONL framing, and supports
multi-request concurrency, cancellation, and BYOK key forwarding.

## sandbox.thox.ai (browser, remote execution)

```bash
# 1. Pull a Vercel dev OIDC token
vercel link && vercel env pull .env

# 2. Start the bridge
pnpm dev:bridge

# 3. Start the Next.js app (separate terminal)
pnpm dev:sandbox
# → open http://localhost:3000
```

The browser app supports two auth modes:

- **BYOK** — paste your own `sk-ant-…` key. Stored in `localStorage`,
  forwarded to the bridge per request, never persisted server-side.
- **Managed** — sign in with Supabase. The bridge validates the JWT with
  `jose` (HS256 against `SUPABASE_JWT_SECRET`, or RS256/ES256 via
  `SUPABASE_JWKS_URL`) and uses the Thox-funded `ANTHROPIC_API_KEY`.

It also supports cloning a git repo into the sandbox before the first
prompt — the **workspace bar** validates the URL and forwards it to the
bridge, which spins up the Vercel Sandbox via
`Sandbox.create({ source: { type: 'git', ... } })`.

## Streaming behaviour

The runtime sets `includePartialMessages: true` and emits two event
types for the same message:

- `assistant_text_delta` — incremental token chunks (`messageId` + `blockIndex`)
- `assistant_text` — final block on close

The sandbox UI coalesces deltas into a live bubble with a blinking cursor
and replaces it with the final text on block close.

## Tools

The `core` package exposes the **ThoxQuantum** MCP server out of the
box, hitting `THOX_QUANTUM_URL` (default `http://localhost:8200`):

- `thox_quantum_run_circuit` — execute OpenQASM 2.0 on cuStateVec /
  cuTensorNet / PennyLane GPU / NumPy
- `thox_quantum_capacity` — qubit-count lookup for Orin NX / AGX Orin /
  MagStack 8x

In web mode, the agent additionally gets `sandbox_*` tools that route
all shell + filesystem operations into the per-session microVM. The
host's `Bash`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`,
`Monitor` are blocked.

## Branding

ThoxCode is "Powered by Claude" per Anthropic's [Agent SDK branding
guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines).
We deliberately do not mimic Claude Code's chrome, ASCII, or colors —
all UI is Thox-native (Nova Space Gray on Quantum Cyan accents).

## License

UNLICENSED — internal Thox.ai property. See `LICENSE` if/when this is
released externally.
