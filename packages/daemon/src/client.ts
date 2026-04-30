import { createConnection, type Socket } from "node:net";
import type { ThoxEvent } from "@thoxcode/core";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "./protocol.js";

export interface DaemonRunInput {
  socketPath?: string;
  prompt: string;
  cwd?: string;
  yolo?: boolean;
  apiKey?: string;
  systemContext?: string;
  signal?: AbortSignal;
}

const DEFAULT_SOCKET = process.env.THOXCODE_DAEMON_SOCKET ?? "/run/thoxcode/sock";

/**
 * Connect to the local ThoxOS daemon and stream a single agent run.
 *
 * Used by the CLI's --thoxos flag. Yields the same ThoxEvent values as
 * core's runAgent(), so the CLI render path is identical.
 */
export async function* runViaDaemon(
  input: DaemonRunInput,
): AsyncGenerator<ThoxEvent> {
  const path = input.socketPath ?? DEFAULT_SOCKET;
  const socket: Socket = createConnection(path);
  const requestId = crypto.randomUUID();

  let buffer = "";
  const queue: ServerMessage[] = [];
  let closed = false;
  let resume: (() => void) | null = null;

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        queue.push(JSON.parse(line) as ServerMessage);
      } catch {
        // skip malformed
      }
    }
    resume?.();
  });

  socket.on("error", (e) => {
    queue.push({ type: "error", message: `socket: ${e.message}` });
    closed = true;
    resume?.();
  });

  socket.on("close", () => {
    closed = true;
    resume?.();
  });

  if (input.signal) {
    input.signal.addEventListener(
      "abort",
      () => {
        socket.write(
          JSON.stringify({ type: "cancel", requestId } satisfies ClientMessage) +
            "\n",
        );
        socket.end();
      },
      { once: true },
    );
  }

  // Wait for ready
  await new Promise<void>((res) => {
    socket.once("connect", res);
  });

  const hello: ClientMessage = { type: "hello", protocol: PROTOCOL_VERSION };
  socket.write(JSON.stringify(hello) + "\n");
  const run: ClientMessage = {
    type: "run",
    requestId,
    prompt: input.prompt,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.yolo !== undefined ? { yolo: input.yolo } : {}),
    ...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
    ...(input.systemContext !== undefined
      ? { systemContext: input.systemContext }
      : {}),
  };
  socket.write(JSON.stringify(run) + "\n");

  while (true) {
    if (queue.length === 0) {
      if (closed) break;
      await new Promise<void>((res) => {
        resume = res;
      });
      resume = null;
      continue;
    }
    const next = queue.shift();
    if (!next) continue;

    if (next.type === "ready") continue;
    if (next.type === "event" && next.requestId === requestId) {
      yield next.event;
      continue;
    }
    if (next.type === "done" && next.requestId === requestId) {
      socket.end();
      return;
    }
    if (next.type === "error") {
      yield {
        type: "error",
        sessionId: "daemon",
        message: next.message,
      };
      socket.end();
      return;
    }
  }
}
