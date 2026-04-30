#!/usr/bin/env node
import { createServer, type Socket } from "node:net";
import { mkdir, unlink, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { runAgent, resolveAuth, ThoxAuthError } from "thoxcode-core";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "./protocol.js";

const VERSION = "0.1.0";

const SOCKET_PATH =
  process.env.THOXCODE_DAEMON_SOCKET ?? "/run/thoxcode/sock";

interface ConnectionState {
  socket: Socket;
  buffer: string;
  inflight: Map<string, AbortController>;
}

function send(socket: Socket, msg: ServerMessage): void {
  socket.write(JSON.stringify(msg) + "\n");
}

async function handleRun(
  conn: ConnectionState,
  msg: Extract<ClientMessage, { type: "run" }>,
): Promise<void> {
  const ac = new AbortController();
  conn.inflight.set(msg.requestId, ac);
  try {
    const auth = resolveAuth({
      byokKey: msg.apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
    for await (const event of runAgent({
      prompt: msg.prompt,
      auth,
      ...(msg.cwd !== undefined ? { cwd: msg.cwd } : {}),
      permissionMode: msg.yolo ? "acceptEdits" : "default",
      allowedTools: ["Read", "Glob", "Grep", "Bash", "Edit", "Write"],
      signal: ac.signal,
      ...(msg.systemContext !== undefined
        ? { systemContext: msg.systemContext }
        : {}),
    })) {
      send(conn.socket, {
        type: "event",
        requestId: msg.requestId,
        event,
      });
    }
    send(conn.socket, { type: "done", requestId: msg.requestId });
  } catch (e) {
    if (e instanceof ThoxAuthError) {
      send(conn.socket, {
        type: "error",
        requestId: msg.requestId,
        message: `auth: ${e.message}`,
      });
    } else {
      send(conn.socket, {
        type: "error",
        requestId: msg.requestId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  } finally {
    conn.inflight.delete(msg.requestId);
  }
}

function handleConnection(socket: Socket): void {
  const conn: ConnectionState = {
    socket,
    buffer: "",
    inflight: new Map(),
  };

  send(socket, {
    type: "ready",
    protocol: PROTOCOL_VERSION,
    version: VERSION,
    pid: process.pid,
    ssAvailable: false, // daemon mode runs on host, not Vercel Sandbox
  });

  socket.on("data", (chunk) => {
    conn.buffer += chunk.toString("utf8");
    let nl;
    while ((nl = conn.buffer.indexOf("\n")) !== -1) {
      const line = conn.buffer.slice(0, nl).trim();
      conn.buffer = conn.buffer.slice(nl + 1);
      if (!line) continue;

      let msg: ClientMessage;
      try {
        msg = JSON.parse(line) as ClientMessage;
      } catch {
        send(socket, { type: "error", message: "invalid JSON frame" });
        continue;
      }

      if (msg.type === "hello") {
        if (msg.protocol !== PROTOCOL_VERSION) {
          send(socket, {
            type: "error",
            message: `protocol mismatch: server=${PROTOCOL_VERSION} client=${msg.protocol}`,
          });
        }
        continue;
      }
      if (msg.type === "run") {
        void handleRun(conn, msg);
        continue;
      }
      if (msg.type === "cancel") {
        const ac = conn.inflight.get(msg.requestId);
        if (ac) ac.abort();
        continue;
      }
    }
  });

  socket.on("close", () => {
    for (const ac of conn.inflight.values()) ac.abort();
    conn.inflight.clear();
  });

  socket.on("error", (e) => {
    console.error("[thoxcoded] socket error:", e.message);
  });
}

async function main(): Promise<void> {
  await mkdir(dirname(SOCKET_PATH), { recursive: true });
  await unlink(SOCKET_PATH).catch(() => {
    /* ignore — socket may not exist */
  });

  const server = createServer(handleConnection);

  server.on("error", (err) => {
    console.error(`[thoxcoded] fatal: ${err.message}`);
    process.exit(1);
  });

  server.listen(SOCKET_PATH, async () => {
    // chmod 0660 so only thoxcode group can talk to it
    try {
      await chmod(SOCKET_PATH, 0o660);
    } catch {
      // best effort
    }
    console.log(
      `[thoxcoded] listening on ${SOCKET_PATH} (protocol v${PROTOCOL_VERSION})`,
    );
  });

  const shutdown = async (sig: string) => {
    console.log(`[thoxcoded] ${sig} received, shutting down`);
    server.close();
    await unlink(SOCKET_PATH).catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e: unknown) => {
  console.error(`[thoxcoded] startup error:`, e);
  process.exit(1);
});
