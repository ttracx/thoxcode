# `thoxcoded` — ThoxOS daemon

The daemon is a long-lived local agent service. It listens on a Unix
domain socket and accepts JSONL-framed run requests. The `thoxcode`
CLI's `--thoxos` flag and `thoxcode-daemon`'s programmatic client both
speak this protocol.

Use it when:

- Many users on one host need to drive the agent (Jetson Orin, ThoxOS
  device, shared dev box).
- You want to amortize Claude Agent SDK subprocess startup across many
  short prompts.
- You want centralized logging via `journalctl -u thoxcoded`.

## Install

The published `thoxcode-daemon` package puts a `thoxcoded` binary on
`$PATH`. The recommended deployment path on a Linux host:

```bash
# From a working ThoxCode checkout:
git clone https://github.com/ttracx/thoxcode.git
cd thoxcode/packages/daemon
pnpm build
sudo ./scripts/install.sh
sudo $EDITOR /etc/thoxcode/environment   # set ANTHROPIC_API_KEY
sudo systemctl enable --now thoxcoded
journalctl -u thoxcoded -f
```

`install.sh` does:

- Creates the `thoxcode` user and group
- Installs files into `/opt/thoxcode/`
- Drops a default env template at `/etc/thoxcode/environment` (mode `0640`)
- Installs the systemd unit at `/etc/systemd/system/thoxcoded.service`
- `systemctl daemon-reload`

## Filesystem layout

| Path | Purpose |
| --- | --- |
| `/opt/thoxcode/dist/` | Compiled JS |
| `/etc/thoxcode/environment` | env file consumed by systemd unit |
| `/run/thoxcode/sock` | the Unix socket (mode `0660`, group `thoxcode`) |
| `/var/log/thoxcode/` | reserved for future on-disk logs |

## Granting access

Add a user to the `thoxcode` group so they can write to the socket:

```bash
sudo usermod -aG thoxcode $USER
# log out / back in for the group change to take effect
```

## Wire protocol

```
CLIENT                                            SERVER
──────                                            ──────
                          ◀─── { type:"ready", protocol:1, version:"…", pid:…, ssAvailable:false }
{ type:"hello", protocol:1 } ───▶
{ type:"run", requestId:"…", prompt:"…", cwd?, yolo?, apiKey? } ───▶
                          ◀─── { type:"event", requestId:"…", event:<ThoxEvent> }
                          ◀─── …
                          ◀─── { type:"done", requestId:"…" }

# Cancellation:
{ type:"cancel", requestId:"…" } ───▶
                          ◀─── { type:"event", … type:"error" }
                          ◀─── { type:"done", requestId:"…" }
```

The server supports multiple inflight `run`s per connection, each
identified by `requestId`. Closing the socket aborts everything inflight
on it.

## Programmatic client

```ts
import { runViaDaemon } from "thoxcode-daemon";

for await (const event of runViaDaemon({
  prompt: "list the largest files in /var/log",
  yolo: false,
  socketPath: "/run/thoxcode/sock", // optional; default
})) {
  console.log(event);
}
```

Pass an `AbortSignal` to support cancellation:

```ts
const ac = new AbortController();
setTimeout(() => ac.abort(), 30_000);

for await (const e of runViaDaemon({ prompt: "…", signal: ac.signal })) {
  …
}
```

## Security notes

- The daemon runs as the unprivileged `thoxcode` user with
  `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=true`,
  `PrivateTmp=true`.
- The socket is mode `0660` group `thoxcode`. Only members of that group
  can connect.
- The daemon's API key (in `/etc/thoxcode/environment`) is the *only*
  fallback; clients can always override per-request via `apiKey`.
- The socket is **not** authenticated beyond Unix permissions. Don't
  expose it over TCP or to untrusted users.
