# thoxcode-sandbox-runtime

> Vercel Sandbox MCP tool adapters for ThoxCode — `Bash`/`Read`/`Write`/
> `Edit`/`Ls`/`PreviewURL` executed inside per-session Firecracker microVMs.

Use this with [`thoxcode-core`](https://www.npmjs.com/package/thoxcode-core)
when you want the agent to operate against an isolated cloud sandbox
instead of the local host.

## Install

```bash
npm i thoxcode-sandbox-runtime thoxcode-core
```

## Usage

```ts
import { runAgent } from "thoxcode-core";
import {
  SandboxLease,
  createSandboxToolServer,
  SANDBOX_TOOL_NAMES,
} from "thoxcode-sandbox-runtime";

const lease = await SandboxLease.open({
  runtime: "node24",
  timeoutMs: 15 * 60_000,
  source: { type: "git", url: "https://github.com/you/repo.git" },
});

const sandboxServer = createSandboxToolServer(lease.sandbox);

for await (const event of runAgent({
  prompt: "Run the test suite and tell me what's failing",
  auth: { mode: "byok", apiKey: process.env.ANTHROPIC_API_KEY! },
  cwd: "/vercel/sandbox",
  permissionMode: "acceptEdits",
  allowedTools: SANDBOX_TOOL_NAMES,
  extraMcpServers: {
    "thox-sandbox": {
      type: "sdk",
      name: "thox-sandbox",
      instance: sandboxServer.instance,
    },
  },
})) {
  console.log(event);
}

await lease.dispose();
```

## Auth

Set `VERCEL_OIDC_TOKEN` (recommended, automatic when running on Vercel)
or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` for external
hosts. See [Vercel Sandbox auth](https://vercel.com/docs/vercel-sandbox/concepts/authentication).

## License

MIT © Thox.ai
