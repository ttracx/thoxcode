# Web Bridge — `thoxcode-web-bridge`

The web bridge is a Hono server that exposes the agent over Server-Sent
Events for `sandbox.thox.ai`. Each session opens its own Vercel Sandbox
microVM, and the agent's tool calls route into that sandbox via
`thoxcode-sandbox-runtime`.

## Endpoints

### `GET /health`

Liveness probe. Returns `{ ok: true, version, service }`.

### `POST /v1/agent/stream`

Run one prompt, stream `ThoxEvent`s back as SSE. Each SSE message has
`event: <type>` and `data: <JSON>`.

**Headers**

| Header | When | Purpose |
| --- | --- | --- |
| `x-thoxcode-byok` | BYOK mode | Raw `sk-ant-…` key from the user. Never logged. |
| `Authorization: Bearer <jwt>` | Managed mode | Supabase JWT. Verified with `jose`. |
| `x-thoxcode-session` | Optional | Existing session id to resume an open sandbox lease. |

**Body**

```json
{
  "prompt": "…",
  "sessionId": "uuid (optional)",
  "gitSource": { "url": "https://…/repo.git", "revision": "main" }
}
```

`gitSource` is honored only on the *first* request for a given session
(the sandbox is cloned at create time).

**Response**

`text/event-stream`. Each frame is one `ThoxEvent` (see
`thoxcode-core` README for the union).

### `DELETE /v1/sessions/:id`

Forcibly dispose of a session's sandbox lease. Idempotent.

## Auth modes

### BYOK

Frontend sends `x-thoxcode-byok: sk-ant-…`. The bridge resolves it via
`thoxcode-core`'s `resolveAuth({ byokKey })` and forwards into the SDK
as a per-call `env` value. Never written to disk.

### Managed (Supabase)

Frontend sends `Authorization: Bearer <jwt>`. The bridge verifies the
JWT with `jose`:

- Default: HS256 against `SUPABASE_JWT_SECRET`
- Asymmetric: set `SUPABASE_JWT_ALG=RS256` (or `ES256`) and
  `SUPABASE_JWKS_URL=https://<project>.supabase.co/auth/v1/jwks`

On success, the bridge calls `resolveAuth({ userId: payload.sub, managedKey: $ANTHROPIC_API_KEY })`.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Thox-funded key for managed-mode requests | (required for managed) |
| `THOXCODE_BRIDGE_PORT` | HTTP port | `8787` |
| `THOXCODE_BRIDGE_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `THOXCODE_SESSION_TIMEOUT_MS` | Idle timeout per session | `900000` (15 min) |
| `SUPABASE_JWT_SECRET` | HS256 secret for managed mode | — |
| `SUPABASE_JWT_ALG` | `HS256` / `RS256` / `ES256` | `HS256` |
| `SUPABASE_JWT_ISSUER` | Optional issuer claim check | — |
| `SUPABASE_JWT_AUDIENCE` | Required audience claim | `authenticated` |
| `SUPABASE_JWKS_URL` | JWKS endpoint for asymmetric algs | — |
| `VERCEL_OIDC_TOKEN` | Vercel Sandbox auth | (required) |

## Session lifecycle

1. Client posts to `/v1/agent/stream`.
2. Bridge auths the request.
3. Bridge looks up `sessionId` in the in-memory `SessionManager`.
   - Hit → reuse the existing `SandboxLease`, bump `lastUsedAt`.
   - Miss → call `SandboxLease.open(...)`, optionally cloning `gitSource`.
4. Bridge constructs an in-process MCP server with the sandbox
   tools (`createSandboxToolServer`) and runs the agent with
   `allowedTools: SANDBOX_TOOL_NAMES` and the host tools disallowed.
5. Every yielded `ThoxEvent` is written as one SSE frame.
6. When the request ends (success, error, abort, or `DELETE`), the
   sandbox lease is either kept (for the next prompt) or disposed.
7. Sweeper interval (60s) reaps any session whose `lastUsedAt` is older
   than the configured idle timeout.

## Local development

```bash
git clone https://github.com/ttracx/thoxcode.git && cd thoxcode
pnpm install
vercel link && vercel env pull .env       # for VERCEL_OIDC_TOKEN
echo "ANTHROPIC_API_KEY=sk-ant-…" >> .env
pnpm dev:bridge                            # :8787
pnpm dev:sandbox                           # :3000 (Next.js client)
```
