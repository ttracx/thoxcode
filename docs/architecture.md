# Architecture

ThoxCode is a single agent core wrapped by three frontends.

```
                ┌──────────────────────────────────────────┐
                │             thoxcode-core                │
                │  ┌────────────────────────────────────┐  │
                │  │  Claude Agent SDK                  │  │
                │  │  ─ systemPrompt: claude_code +     │  │
                │  │    THOXCODE_IDENTITY append        │  │
                │  │  ─ tools: Read/Glob/Grep/Bash/…    │  │
                │  │  ─ MCP: thox-quantum (default)     │  │
                │  └────────────────────────────────────┘  │
                │  Normalized event stream (ThoxEvent)     │
                └──────┬──────────────┬─────────────┬──────┘
                       │              │             │
                       ▼              ▼             ▼
                ┌─────────────┐ ┌──────────┐ ┌──────────────┐
                │  thoxcode   │ │ thoxcoded│ │ web-bridge   │
                │   (CLI)     │ │ (daemon) │ │ (Hono SSE)   │
                │   host fs   │ │ Unix sock│ │ Vercel Sandbox│
                └─────────────┘ └──────────┘ └────┬─────────┘
                                                  │
                                                  ▼
                                          ┌─────────────┐
                                          │ Next.js app │
                                          │ sandbox.thox│
                                          │     .ai     │
                                          └─────────────┘
```

## Why one core, three frontends

The Agent SDK's `query()` already gives us a clean async-iterable of
`SDKMessage`. `thoxcode-core` does just enough on top to:

1. **Brand** — append `THOXCODE_IDENTITY` to the SDK's `claude_code`
   preset system prompt. We get the engineering tool-use loop without
   mimicking Claude Code's chrome.
2. **Normalize** — flatten the SDK's message union into a small
   serializable `ThoxEvent` set so the wire format is identical across
   CLI rendering, Unix-socket framing, and SSE to the browser.
3. **Plug in MCP defaults** — the ThoxQuantum server is on by default;
   callers add their own (e.g. the sandbox-runtime's `sandbox_*` tools).

Everything else — chrome, transport, lifecycle — lives in a frontend
package.

## Auth layering

```
  user                 Bridge / Daemon / CLI                  Anthropic
  ────                 ─────────────────────                   ─────────
  byokKey ──┐
            ├──▶ resolveAuth() ──▶ AuthContext{ apiKey } ──▶ ANTHROPIC_API_KEY
  Supabase ─┘                                                 (per-call env)
   JWT
            │
            ▼
       jose.jwtVerify()
       ↓ payload.sub
       ↓
       userId ─▶ rate-limit / billing key in managed mode
```

The web bridge accepts `x-thoxcode-byok` (raw key, never logged) and
`Authorization: Bearer <jwt>` (Supabase JWT, validated against
`SUPABASE_JWT_SECRET` for HS256 or `SUPABASE_JWKS_URL` for RS256/ES256).
Whichever resolves, we hand the SDK an `env: { ANTHROPIC_API_KEY }`
scoped to that single call.

## Sandbox isolation (web mode)

When the bridge starts a session, it opens one Vercel Sandbox lease via
`@vercel/sandbox` and creates an in-process MCP server exposing
`sandbox_*` tools that route into that microVM. The SDK's host-execution
tools are **disallowed** (`Bash`, `Read`, `Write`, `Edit`, `Glob`,
`Grep`, `WebFetch`, `Monitor`) so the agent has no way to touch the
bridge host.

```
  browser ── SSE ──▶ web-bridge ── @vercel/sandbox ──▶ Firecracker microVM
                          │                              │
                          └─ MCP sdk:thox-sandbox ───────┘
```

Idle sessions are reaped every 60s; default lifetime is 15 minutes,
extendable via `sandbox.extendTimeout(ms)`.

## Daemon protocol (ThoxOS)

Newline-delimited JSON over Unix domain socket at `/run/thoxcode/sock`
(group `thoxcode`, mode `0660`). Bidirectional, multi-request,
cancellable. See `packages/daemon/src/protocol.ts` for the full schema.

The CLI's `--thoxos` flag opens a connection, sends a `hello` then a
`run`, streams `event` frames back into the same `ThoxEvent` render
path used in-process.
