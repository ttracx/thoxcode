# ThoxCode

> THOX.ai's branded coding agent. **Powered by Claude.**

[![CLI on npm](https://img.shields.io/npm/v/thoxcode.svg?label=thoxcode&color=22d3ee)](https://www.npmjs.com/package/thoxcode)
[![core on npm](https://img.shields.io/npm/v/thoxcode-core.svg?label=thoxcode-core&color=22d3ee)](https://www.npmjs.com/package/thoxcode-core)
[![sandbox-runtime on npm](https://img.shields.io/npm/v/thoxcode-sandbox-runtime.svg?label=thoxcode-sandbox-runtime&color=22d3ee)](https://www.npmjs.com/package/thoxcode-sandbox-runtime)
[![daemon on npm](https://img.shields.io/npm/v/thoxcode-daemon.svg?label=thoxcode-daemon&color=22d3ee)](https://www.npmjs.com/package/thoxcode-daemon)
[![license: MIT](https://img.shields.io/npm/l/thoxcode.svg)](LICENSE)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude-a78bfa)](https://claude.com)

ThoxCode is a TypeScript-first agentic coding runtime built on the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview).
One core, three frontends.

| Frontend | Where it runs | Package |
| --- | --- | --- |
| `thoxcode` CLI | Your terminal | [`thoxcode`](https://www.npmjs.com/package/thoxcode) |
| `thoxcoded` daemon | ThoxOS / Jetson (systemd) | [`thoxcode-daemon`](https://www.npmjs.com/package/thoxcode-daemon) |
| `sandbox.thox.ai` | Browser → Vercel Sandbox | [`apps/sandbox`](apps/sandbox) |

## Install (CLI)

```bash
npm i -g thoxcode
export ANTHROPIC_API_KEY=sk-ant-…
thoxcode "find the slowest tests in this project"
```

## Install (library)

```bash
npm i thoxcode-core
```

```ts
import { runAgent, resolveAuth } from "thoxcode-core";

const auth = resolveAuth({ byokKey: process.env.ANTHROPIC_API_KEY });

for await (const event of runAgent({
  prompt: "Find all TODOs and summarize them",
  auth,
  cwd: process.cwd(),
  permissionMode: "default",
})) {
  console.log(event); // ThoxEvent — JSON-serializable
}
```

## Repo layout

```
packages/
  core/             thoxcode-core              Agent runtime, system prompt, ThoxQuantum MCP
  sandbox-runtime/  thoxcode-sandbox-runtime   Vercel Sandbox tool adapters
  daemon/           thoxcode-daemon            Unix-socket service for ThoxOS
  cli/              thoxcode                   `thoxcode` binary
  web-bridge/       (private)                  Hono SSE server for sandbox.thox.ai
apps/
  sandbox/          (private)                  Next.js 15 app deployed to sandbox.thox.ai
docs/
  architecture.md
  cli.md
  daemon.md
  web-bridge.md
  security.md
```

## Quick starts

### CLI (host execution)

```bash
npm i -g thoxcode
thoxcode --yolo "convert all CommonJS requires in src/ to ESM imports"
```

See [docs/cli.md](docs/cli.md) for the full reference.

### ThoxOS daemon (systemd)

```bash
git clone https://github.com/ttracx/thoxcode.git
cd thoxcode/packages/daemon
pnpm build
sudo ./scripts/install.sh
sudo $EDITOR /etc/thoxcode/environment   # set ANTHROPIC_API_KEY
sudo systemctl enable --now thoxcoded
```

Then any user in the `thoxcode` group can drive it:

```bash
thoxcode --thoxos "what processes are using the most memory?"
```

See [docs/daemon.md](docs/daemon.md) for protocol + security notes.

### sandbox.thox.ai (browser, remote execution)

```bash
git clone https://github.com/ttracx/thoxcode.git && cd thoxcode
pnpm install
vercel link && vercel env pull .env
echo "ANTHROPIC_API_KEY=sk-ant-…" >> .env
pnpm dev:bridge        # :8787
pnpm dev:sandbox       # :3000 (Next.js client)
```

The browser app supports two auth modes:

- **BYOK** — paste your own `sk-ant-…` key. Stored in `localStorage`,
  forwarded to the bridge per request, never persisted server-side.
- **Managed** — sign in with Supabase. The bridge validates the JWT
  with `jose` (HS256 against `SUPABASE_JWT_SECRET`, or RS256/ES256 via
  `SUPABASE_JWKS_URL`) and uses the Thox-funded `ANTHROPIC_API_KEY`.

The workspace bar accepts a git URL + revision to clone the repo into
the sandbox before the first prompt.

See [docs/web-bridge.md](docs/web-bridge.md) for full details.

## Streaming behaviour

The runtime sets `includePartialMessages: true` and emits two event
types for the same message:

- `assistant_text_delta` — incremental token chunks (`messageId` + `blockIndex`)
- `assistant_text` — final block on close

The sandbox UI coalesces deltas into a live bubble with a blinking
cursor and replaces it with the final text on block close.

## Tools

### Built-in (`thoxcode-core`)

The `ThoxQuantum` MCP server is on by default and hits `THOX_QUANTUM_URL`
(default `http://localhost:8200`):

- `thox_quantum_run_circuit` — execute OpenQASM 2.0 on cuStateVec /
  cuTensorNet / PennyLane GPU / NumPy
- `thox_quantum_capacity` — qubit-count lookup for Orin NX / AGX Orin /
  MagStack 8x

### Sandbox (`thoxcode-sandbox-runtime`)

In web mode the agent gets `sandbox_*` tools that route all shell +
filesystem operations into the per-session microVM. The host's `Bash`,
`Read`, `Write`, `Edit`, `Glob`, `Grep`, `WebFetch`, `Monitor` are
disallowed.

## Branding

ThoxCode is "Powered by Claude" per [Anthropic's Agent SDK branding
guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines).
We deliberately do not mimic Claude Code's chrome, ASCII, or colors —
all UI is Thox-native (Nova Space Gray on Quantum Cyan accents).

## Contributing

```bash
git clone https://github.com/ttracx/thoxcode.git
cd thoxcode
pnpm install
pnpm -r typecheck
pnpm -r build
```

Issues and PRs welcome at https://github.com/ttracx/thoxcode/issues.

## Related projects

- [SandThox](https://github.com/ttracx/sandthox) — secure sandbox
  infrastructure (FastAPI server, multi-language SDKs,
  gVisor/Kata/Firecracker adapters). ThoxCode currently uses Vercel
  Sandbox for its web mode; future versions may target SandThox as an
  alternative execution backend.
- [ThoxQuantum](https://github.com/ttracx/THOX.ai) — quantum circuit
  emulation runtime (cuStateVec / cuTensorNet on Jetson Orin) that
  ThoxCode's MCP tools target by default.

## License

MIT © THOX.ai. See [LICENSE](LICENSE).
