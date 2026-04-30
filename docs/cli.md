# CLI Reference — `thoxcode`

`npm i -g thoxcode` — installs the `thoxcode` binary.

## Synopsis

```
thoxcode <prompt>
thoxcode [--cwd <dir>] [--yolo] [--thoxos [--socket <path>]] <prompt>
thoxcode --help
```

## Flags

| Flag | Description |
| --- | --- |
| `--cwd <dir>` | Working directory the agent treats as project root. Defaults to `process.cwd()`. |
| `--yolo` | Run in `acceptEdits` permission mode — auto-accepts file edits. Use with care. |
| `--thoxos` | Connect to a local `thoxcoded` daemon (see `thoxcode-daemon`) instead of spawning a fresh subprocess. Useful when many users share one host. |
| `--socket <path>` | Override the daemon socket path. Defaults to `/run/thoxcode/sock` or the value of `$THOXCODE_DAEMON_SOCKET`. |
| `--help`, `-h` | Print usage. |

## Auth

Set `ANTHROPIC_API_KEY` in your shell:

```bash
export ANTHROPIC_API_KEY=sk-ant-…
```

ThoxCode forwards this to the Agent SDK as a per-call env var. It is
never written to disk and never logged.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | API key used for the run | (required) |
| `THOXCODE_DEFAULT_MODEL` | Override the model | `claude-opus-4-7` |
| `THOX_QUANTUM_URL` | ThoxQuantum runtime base URL | `http://localhost:8200` |
| `THOXCODE_DAEMON_SOCKET` | Daemon socket path used by `--thoxos` | `/run/thoxcode/sock` |

## Tools available to the agent

In CLI mode the agent gets the host filesystem tools (`Read`, `Glob`,
`Grep`, `Bash`, `Edit`, `Write`) plus the `thox_quantum_*` MCP tools
from `thoxcode-core`.

## Exit codes

- `0` — agent finished successfully
- `1` — fatal runtime error (uncaught exception)
- `2` — auth error (missing or malformed `ANTHROPIC_API_KEY`)

## Examples

```bash
# Quick task
thoxcode "list the slowest test cases in this project"

# YOLO refactor
thoxcode --yolo "convert all CommonJS requires in src/ to ESM imports"

# Run from another directory
thoxcode --cwd ~/projects/foo "add tests for the new auth module"

# Drive the ThoxOS daemon (faster cold-start when invoked repeatedly)
thoxcode --thoxos "tail /var/log/syslog and tell me what's noisy"

# Custom socket (e.g. user-mode daemon)
thoxcode --thoxos --socket /tmp/thoxcode.sock "look at the project layout"
```

## Output format

The CLI renders normalized `ThoxEvent` values one line at a time:

- Session header — `· session abc12345 · claude-opus-4-7`
- Assistant text — printed as-is
- Tool calls — `→ Read {"file_path":"src/index.ts"}`
- Tool results — `✓` (success) or `✗` (error) followed by truncated output
- Thinking — italic dim, prefixed `thinking…`
- Result — `· done in 4.2s · $0.0234`
