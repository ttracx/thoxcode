# thoxcode-daemon

> ThoxCode daemon for ThoxOS — Unix socket service exposing the agent
> over JSONL framing. Includes systemd unit and install script.

Long-lived local agent service for Jetson Orin / ThoxOS. The CLI's
`--thoxos` flag connects here so multiple users on the same host share
one warm subprocess.

## Install (npm)

```bash
npm i thoxcode-daemon
```

The `thoxcoded` binary is exposed via `bin`. To install on a host as a
systemd service, see the bundled `scripts/install.sh`.

## System install (systemd)

```bash
git clone https://github.com/ttracx/thoxcode.git
cd thoxcode/packages/daemon
pnpm build
sudo ./scripts/install.sh
sudo $EDITOR /etc/thoxcode/environment   # set ANTHROPIC_API_KEY
sudo systemctl enable --now thoxcoded
journalctl -u thoxcoded -f
```

Then any user in the `thoxcode` group can drive it:

```bash
thoxcode --thoxos "look at /var/log/syslog and tell me what's noisy"
```

## Protocol

Newline-delimited JSON in both directions. Bidirectional, multi-request,
cancellable. See [`src/protocol.ts`](https://github.com/ttracx/thoxcode/blob/main/packages/daemon/src/protocol.ts)
for the full schema.

## Programmatic client

```ts
import { runViaDaemon } from "thoxcode-daemon";

for await (const event of runViaDaemon({
  prompt: "what processes are using the most memory?",
  yolo: true,
})) {
  console.log(event);
}
```

## License

MIT © THOX.ai
