# Roadmap

ThoxCode follows semver from `0.1.0` onward. Anything below `1.0.0` may
break minor-to-minor; we'll call out breaking changes in the
[CHANGELOG](CHANGELOG.md).

## v0.1.x — current

Live on npm:

- ✅ `thoxcode` CLI (host execution)
- ✅ `thoxcode-core` library
- ✅ `thoxcode-sandbox-runtime` (Vercel Sandbox adapters)
- ✅ `thoxcode-daemon` (`thoxcoded` Unix-socket service)
- ✅ Streaming partial messages (`assistant_text_delta`)
- ✅ Dual auth: BYOK + Supabase JWT (HS256/RS256/ES256, `jose`)
- ✅ Git-clone bootstrap of sandbox workspace

Patch-level work expected here: bug fixes, small UX polish, docs.

## v0.2 — operational hardening

Target: ship to a real production deployment of `sandbox.thox.ai`.

- [ ] **CI/CD** — `.github/workflows/{ci,publish,e2e}.yml`
  - `ci.yml`: pnpm install + `-r typecheck` + `-r build` on every PR
  - `publish.yml`: tag-driven (`v*`) npm publish via Trusted Publishers
    (OIDC) — no long-lived `NPM_TOKEN`
  - `e2e.yml`: spin up the bridge + sandbox app in a workflow runner,
    drive a smoke test against a sandboxed prompt
- [ ] **`thoxcode-web-bridge` published** to npm so others can host their
      own bridge (same auth, same SSE protocol). Currently kept private
      while the auth surface settles.
- [ ] **Real Supabase OAuth flow** in `apps/sandbox` (replace the
      "paste a JWT" dev stub with `@supabase/auth-helpers-nextjs`)
- [ ] **Bridge deployment template** — `infra/vercel.json` + minimal
      `Dockerfile` for self-hosting
- [ ] **Rate limiting** in managed mode (per-user via `userId`,
      Redis-backed) — currently relies entirely on Anthropic's limits
- [ ] **Audit log** — append-only JSONL of `(userId, sessionId, prompt
      hash, tool_call counts, costUsd)` for cost attribution

## v0.3 — execution backends

Today the only sandboxed runtime is Vercel Sandbox. v0.3 makes it
pluggable.

- [ ] **`thoxcode-sandthox-runtime`** — alternative adapter targeting
      [SandThox](https://github.com/ttracx/sandthox). Same MCP shape as
      `thoxcode-sandbox-runtime`, drop-in for the bridge.
- [ ] **Local Docker runtime** — `thoxcode-docker-runtime` for offline
      / on-prem usage. Useful for ThoxOS development without internet
      egress.
- [ ] **Runtime selection per session** — bridge accepts
      `runtime: "vercel" | "sandthox" | "docker"` in the request body
- [ ] **Snapshot reuse** — for repeat sessions on the same repo, reuse
      Vercel Sandbox snapshots to skip `pnpm install`/`npm install`

## v0.4 — UX

Target: `sandbox.thox.ai` is genuinely pleasant for a 30-minute
exploratory session.

- [ ] **File tree pane** — live view of the sandbox filesystem,
      click-to-open in a side editor (CodeMirror or Monaco)
- [ ] **Tool-call streaming** — render incremental tool input as it
      arrives (currently we wait for the full block)
- [ ] **Persistent sessions** — drop-in for Vercel Sandbox's persistent
      sandbox beta so closing the tab doesn't kill the lease
- [ ] **Session history** — list past sessions with cost + duration,
      one-click resume via `Options.resume`
- [ ] **Prompt suggestions** — surface the SDK's `promptSuggestions`
      output as chips above the prompt bar
- [ ] **Dark/Light theme** — currently dark-only; add a light variant
      that still feels Thox-native

## v0.5 — quantum + edge

Target: ThoxCode is the agent of choice for cuQuantum / Jetson work.

- [ ] **MagStack distributed quantum tools** — wrap `cusvaer` cluster
      execution as MCP tools (`magstack_run_distributed`, etc.)
- [ ] **Jetson power-mode awareness** — surface current `nvpmodel`
      profile in the system context so the agent knows whether it's
      running on 15W or MAXN
- [ ] **ThoxOS service introspection** — read `systemctl` state,
      `journalctl` excerpts, current GPU temp/util — bundled as MCP
      tools instead of bare `Bash` calls
- [ ] **Ollama tool-calling adapter** — alternate path for agents that
      want to drive a local Ollama model with ThoxCode's tool surface
      instead of Claude

## v1.0 — stable

Pre-condition: `v0.x` API has been stable for at least one minor
release with no breaking changes.

- [ ] Public commitment to semver. No breaking changes in minors.
- [ ] Documented stability tiers per package
- [ ] OpenAPI spec for the bridge HTTP surface
- [ ] Migration guide from `0.x`
- [ ] Long-term-support policy (which versions get security fixes)

---

## Want something listed here?

Open an issue at <https://github.com/ttracx/thoxcode/issues>. Pull
requests are very welcome — start with a quick design comment on the
issue before implementing anything large.
