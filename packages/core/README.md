# thoxcode-core

> ThoxCode agent runtime — Claude Agent SDK + Thox system prompt + ThoxQuantum MCP tools.

The reusable engine behind the `thoxcode` CLI, the `thoxcoded` ThoxOS
daemon, and `sandbox.thox.ai`. **Powered by Claude.**

## Install

```bash
npm i thoxcode-core
```

## Usage

```ts
import { runAgent, resolveAuth } from "thoxcode-core";

const auth = resolveAuth({ byokKey: process.env.ANTHROPIC_API_KEY });

for await (const event of runAgent({
  prompt: "Find all TODOs and summarize them",
  auth,
  cwd: process.cwd(),
  permissionMode: "default",
  allowedTools: ["Read", "Glob", "Grep"],
})) {
  console.log(event); // ThoxEvent — JSON-serializable
}
```

## What you get

- **Thox-branded system prompt** layered on top of the SDK's `claude_code`
  preset (per [Anthropic's Agent SDK branding guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines)).
- **ThoxQuantum MCP server** out of the box (`thox_quantum_run_circuit`,
  `thox_quantum_capacity`) hitting `THOX_QUANTUM_URL` (default
  `http://localhost:8200`).
- **Normalized event stream** (`ThoxEvent`) — assistant text, tool calls,
  tool results, partial deltas, and final result with cost/duration.
- **Dual-mode auth** — BYOK (user-supplied key) or managed (Thox-funded
  key bound to a userId).

## Event types

```ts
type ThoxEvent =
  | { type: "session_start"; sessionId; model; tools }
  | { type: "assistant_text"; sessionId; text }
  | { type: "assistant_text_delta"; sessionId; messageId; blockIndex; text }
  | { type: "tool_call"; sessionId; toolUseId; tool; input }
  | { type: "tool_result"; sessionId; toolUseId; ok; output }
  | { type: "thinking"; sessionId; text }
  | { type: "result"; sessionId; ok; durationMs; costUsd; summary? }
  | { type: "error"; sessionId; message; code? };
```

## License

MIT © Thox.ai
