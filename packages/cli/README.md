# thoxcode

> THOX.ai's branded coding agent. **Powered by Claude.**

[![npm](https://img.shields.io/npm/v/thoxcode.svg)](https://www.npmjs.com/package/thoxcode)
[![license](https://img.shields.io/npm/l/thoxcode.svg)](https://github.com/ttracx/thoxcode/blob/main/LICENSE)

ThoxCode is a TypeScript-first agentic coding runtime built on the
[Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview).
Same agent core powers the CLI here, the ThoxOS daemon
([`thoxcode-daemon`](https://www.npmjs.com/package/thoxcode-daemon)),
and [sandbox.thox.ai](https://sandbox.thox.ai).

## Install

```bash
npm i -g thoxcode
```

## Usage

```bash
export ANTHROPIC_API_KEY=sk-ant-…

thoxcode "summarize the failing tests in this project"
thoxcode --yolo "refactor utils.ts to use top-level await"
thoxcode --cwd ~/projects/foo "add tests for the new auth module"

# Drive a long-running ThoxOS daemon instead of spawning fresh subprocess
thoxcode --thoxos "what processes are using the most memory?"
```

## Flags

```
thoxcode <prompt>            Run a one-shot task (in-process)
thoxcode --thoxos <prompt>   Run via the local thoxcoded socket
thoxcode --socket <path>     Override daemon socket path
thoxcode --cwd <dir> ...     Override working directory
thoxcode --yolo ...          Auto-accept edits (acceptEdits mode)
```

## Auth

Set `ANTHROPIC_API_KEY` in your shell. ThoxCode passes it through to
Claude as a BYOK key — never logged or persisted.

## Tools available out of the box

- `Read`, `Glob`, `Grep`, `Bash`, `Edit`, `Write` — host filesystem
- `thox_quantum_run_circuit` — execute OpenQASM 2.0 on cuStateVec /
  cuTensorNet / PennyLane GPU / NumPy via the ThoxQuantum runtime at
  `THOX_QUANTUM_URL` (default `http://localhost:8200`)
- `thox_quantum_capacity` — qubit-count lookup for Jetson Orin variants
  and MagStack clusters

## Library usage

If you want to embed ThoxCode programmatically rather than shell out to
the CLI, install [`thoxcode-core`](https://www.npmjs.com/package/thoxcode-core)
directly.

## Branding

ThoxCode is "Powered by Claude" per [Anthropic's Agent SDK branding
guidelines](https://code.claude.com/docs/en/agent-sdk/overview#branding-guidelines).
We deliberately do not mimic Claude Code's chrome, ASCII, or colors —
all UI is Thox-native (Nova Space Gray on Quantum Cyan accents).

## License

MIT © THOX.ai
