# Security model

ThoxCode runs untrusted code. This document explains the trust
boundaries and the controls at each one.

## Trust boundaries

```
  ┌────────────────┐
  │ user's browser │   trust: untrusted (web)
  └───────┬────────┘
          │ TLS + auth header (BYOK key OR Supabase JWT)
          ▼
  ┌────────────────────┐
  │ thoxcode-web-bridge│   trust: TRUSTED component
  │  (Hono / Node)     │   role: auth, rate-limit, session pool
  └───────┬────────────┘
          │ Vercel Sandbox SDK (OIDC)
          ▼
  ┌────────────────────┐
  │ Vercel Sandbox     │   trust: untrusted (microVM)
  │ Firecracker microVM│   role: untrusted code execution
  └────────────────────┘
```

The bridge is the only place we hold a Thox-funded `ANTHROPIC_API_KEY`.
The browser never sees it. The microVM never sees it directly — the
SDK runs *inside* the bridge process and forwards only what's needed
to the model API.

## Auth

### BYOK

User pastes their own `sk-ant-…` key. The browser stores it in
`localStorage` and sends it on every request as `x-thoxcode-byok`. The
bridge:

1. Validates format (`sk-ant-` prefix, sane length).
2. Hands it to `thoxcode-core`'s `resolveAuth` and then into the SDK's
   `env` for that single call.
3. Never logs, persists, or echoes it.

If the bridge crashes, only the in-flight call is affected. There's no
disk persistence of the key.

### Managed

User signs in to Supabase from the browser. The browser receives a JWT
and sends it as `Authorization: Bearer …`. The bridge verifies the JWT
with `jose`:

- HS256 against `SUPABASE_JWT_SECRET` (default), or
- RS256 / ES256 against a JWKS pulled from `SUPABASE_JWKS_URL`.

On success, the bridge uses its own server-side `ANTHROPIC_API_KEY` and
attaches `payload.sub` as `userId` for rate-limiting / billing.

JWT verification is mandatory: a missing `SUPABASE_JWT_SECRET` causes
managed-mode requests to fail closed.

## Tool isolation in web mode

When the bridge runs the agent against a Vercel Sandbox lease, the
agent is given **only** the `sandbox_*` MCP tools:

- `sandbox_bash`
- `sandbox_read`, `sandbox_write`, `sandbox_edit`, `sandbox_ls`
- `sandbox_preview_url`

The host-execution tools (`Bash`, `Read`, `Write`, `Edit`, `Glob`,
`Grep`, `WebFetch`, `Monitor`) are explicitly disallowed via
`disallowedTools`. The agent has no way to touch the bridge host
filesystem or shell.

## CLI / daemon mode

In CLI and daemon modes the agent **does** have host access. This is
intentional — that's the user's machine. The trust model is:

- The user runs the agent on their own machine with their own key.
- They are responsible for the prompts they send.
- `--yolo` (`acceptEdits`) is opt-in; default mode prompts before edits.

The daemon runs as a non-root `thoxcode` user with systemd hardening
(`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=true`,
`PrivateTmp=true`). The Unix socket is mode `0660` group `thoxcode` —
only members of that group can drive the daemon.

## Network policy on Vercel Sandbox

The default network policy is `allow-all` (full Internet). For
high-risk workflows (running user-supplied code against secrets) we
recommend updating the policy after sandbox creation:

```ts
await lease.sandbox.updateNetworkPolicy({
  allow: ["api.anthropic.com", "registry.npmjs.org", "github.com"],
  subnets: { deny: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"] },
});
```

This is not yet wired through the bridge UI; track in the issue tracker.

## Reporting a vulnerability

If you find a security issue, please **do not** open a public GitHub
issue. Email security@thox.ai with a description and reproduction
steps. We'll acknowledge within 48 hours.
