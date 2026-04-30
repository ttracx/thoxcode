import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import { runAgent, ThoxAuthError } from "thoxcode-core";
import {
  createSandboxToolServer,
  HOST_TOOLS_TO_DISALLOW,
  SANDBOX_TOOL_NAMES,
} from "thoxcode-sandbox-runtime";
import { authenticateRequest } from "./auth.js";
import { SessionManager } from "./session-manager.js";

const app = new Hono();
const sessions = new SessionManager();

const allowedOrigin =
  process.env.THOXCODE_BRIDGE_ORIGIN ?? "http://localhost:3000";

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return allowedOrigin;
      // Allow localhost for dev, the configured origin for prod.
      if (origin.startsWith("http://localhost")) return origin;
      return origin === allowedOrigin ? origin : null;
    },
    allowHeaders: [
      "content-type",
      "authorization",
      "x-thoxcode-byok",
      "x-thoxcode-session",
    ],
    credentials: false,
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, version: "0.1.0", service: "thoxcode-web-bridge" }),
);

app.post("/v1/agent/stream", async (c) => {
  let auth;
  try {
    auth = await authenticateRequest({
      byokHeader: c.req.header("x-thoxcode-byok"),
      bearerToken: c.req.header("authorization")?.replace(/^Bearer\s+/i, ""),
    });
  } catch (e) {
    const status = e instanceof ThoxAuthError ? 401 : 500;
    return c.json(
      { error: e instanceof Error ? e.message : "auth failed" },
      status,
    );
  }

  const body = (await c.req.json().catch(() => null)) as
    | {
        prompt?: string;
        sessionId?: string;
        gitSource?: { url: string; revision?: string };
      }
    | null;
  if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return c.json({ error: "prompt is required" }, 400);
  }

  const prompt: string = body.prompt;
  const gitSource = body.gitSource;
  const sessionId =
    body.sessionId ?? c.req.header("x-thoxcode-session") ?? crypto.randomUUID();

  return streamSSE(c, async (stream) => {
    const send = async (event: { type: string; [k: string]: unknown }) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    };

    const lease = await sessions.acquire(
      sessionId,
      gitSource ? { source: { type: "git", ...gitSource } } : {},
      auth.userId,
    );

    const sandboxServer = createSandboxToolServer(lease.sandbox);

    try {
      for await (const event of runAgent({
        prompt,
        auth,
        permissionMode: "acceptEdits",
        cwd: "/vercel/sandbox",
        allowedTools: SANDBOX_TOOL_NAMES,
        extraMcpServers: {
          "thox-sandbox": {
            type: "sdk",
            name: "thox-sandbox",
            instance: sandboxServer.instance,
          },
        },
        systemContext: [
          `Sandbox: ${lease.id} (Vercel Firecracker microVM, Amazon Linux 2023, node24).`,
          `Working dir: /vercel/sandbox`,
          `Use sandbox_* tools for all filesystem and shell operations.`,
          HOST_TOOLS_TO_DISALLOW.length
            ? `Host tools (${HOST_TOOLS_TO_DISALLOW.join(", ")}) are unavailable.`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      })) {
        await send(event);
      }
    } catch (e) {
      await send({
        type: "error",
        sessionId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
});

app.delete("/v1/sessions/:id", async (c) => {
  const id = c.req.param("id");
  await sessions.release(id);
  return c.json({ ok: true });
});

const port = Number(process.env.THOXCODE_BRIDGE_PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[thoxcode-bridge] listening on :${info.port}`);
});

const shutdown = async (sig: string) => {
  console.log(`[thoxcode-bridge] ${sig} — disposing ${0} sessions`);
  await sessions.shutdown();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export default app;
