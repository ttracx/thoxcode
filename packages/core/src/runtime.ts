import {
  query,
  type Options,
  type SDKMessage,
  type SDKUserMessage,
  type McpServerConfig,
  type CanUseTool,
} from "@anthropic-ai/claude-agent-sdk";
import { thoxSystemPrompt } from "./system-prompt.js";
import { authToSdkEnv, type AuthContext } from "./auth.js";
import { createThoxQuantumMcpServer } from "./tools/thox-quantum.js";
import type { ThoxEvent } from "./events.js";

export interface RunAgentInput {
  prompt: string;
  auth: AuthContext;
  /** Override default model. Defaults to claude-opus-4-7. */
  model?: string;
  /** Working directory the agent should treat as project root. */
  cwd?: string;
  /** Limit how many agentic turns. Default 30. */
  maxTurns?: number;
  /** Permission mode. CLI usually 'default'; web sandbox usually 'acceptEdits'. */
  permissionMode?: Options["permissionMode"];
  /** Caller-supplied MCP servers (e.g. sandbox-runtime tools). */
  extraMcpServers?: Record<string, McpServerConfig>;
  /** Names of tools to allow without prompting. Defaults to read-only set. */
  allowedTools?: string[];
  /** Resume a previous session id. */
  resumeSessionId?: string;
  /** Optional context appended to the system prompt. */
  systemContext?: string;
  /** AbortController to cancel mid-run. */
  signal?: AbortSignal;
  /**
   * If true, emit assistant_text_delta events as the model streams. The
   * final assistant_text is still emitted on block close. Defaults true.
   */
  streamDeltas?: boolean;
}

const DEFAULT_MODEL =
  process.env.THOXCODE_DEFAULT_MODEL ?? "claude-opus-4-7";

const DEFAULT_ALLOWED_TOOLS = ["Read", "Glob", "Grep"];

/**
 * Run the agent and yield normalized ThoxEvent values. The bridge pipes
 * these straight to the browser; the CLI renders them in-terminal.
 */
export async function* runAgent(input: RunAgentInput): AsyncGenerator<ThoxEvent> {
  let internalSessionId: string = crypto.randomUUID();
  const abort = new AbortController();
  if (input.signal) {
    input.signal.addEventListener("abort", () => abort.abort(), { once: true });
  }

  const mcpServers: Record<string, McpServerConfig> = {
    "thox-quantum": {
      type: "sdk",
      name: "thox-quantum",
      instance: createThoxQuantumMcpServer().instance,
    },
    ...(input.extraMcpServers ?? {}),
  };

  const streamDeltas = input.streamDeltas ?? true;

  const options: Options = {
    model: input.model ?? DEFAULT_MODEL,
    systemPrompt: thoxSystemPrompt(input.systemContext),
    permissionMode: input.permissionMode ?? "default",
    maxTurns: input.maxTurns ?? 30,
    allowedTools: input.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
    mcpServers,
    env: authToSdkEnv(input.auth),
    abortController: abort,
    settingSources: [],
    includePartialMessages: streamDeltas,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.resumeSessionId !== undefined
      ? { resume: input.resumeSessionId }
      : {}),
  };

  try {
    for await (const message of query({ prompt: input.prompt, options })) {
      for (const event of mapSdkMessage(message, internalSessionId)) {
        if (event.type === "session_start") {
          internalSessionId = event.sessionId;
        }
        yield event;
      }
    }
  } catch (err) {
    yield {
      type: "error",
      sessionId: internalSessionId,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

interface ContentBlockText {
  type: "text";
  text: string;
}
interface ContentBlockToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
interface ContentBlockThinking {
  type: "thinking";
  thinking: string;
}
interface ContentBlockToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}

function isText(b: unknown): b is ContentBlockText {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "text" &&
    typeof (b as { text?: unknown }).text === "string"
  );
}
function isToolUse(b: unknown): b is ContentBlockToolUse {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "tool_use" &&
    typeof (b as { id?: unknown }).id === "string" &&
    typeof (b as { name?: unknown }).name === "string"
  );
}
function isThinking(b: unknown): b is ContentBlockThinking {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "thinking" &&
    typeof (b as { thinking?: unknown }).thinking === "string"
  );
}
function isToolResult(b: unknown): b is ContentBlockToolResult {
  return (
    typeof b === "object" &&
    b !== null &&
    (b as { type?: unknown }).type === "tool_result" &&
    typeof (b as { tool_use_id?: unknown }).tool_use_id === "string"
  );
}

function flattenToolResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (
          typeof c === "object" &&
          c !== null &&
          (c as { type?: unknown }).type === "text" &&
          typeof (c as { text?: unknown }).text === "string"
        ) {
          return (c as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  return "";
}

/** Map a raw SDKMessage to zero-or-more normalized ThoxEvents. */
function mapSdkMessage(
  msg: SDKMessage,
  fallbackSessionId: string,
): ThoxEvent[] {
  const events: ThoxEvent[] = [];

  if (msg.type === "system" && "subtype" in msg && msg.subtype === "init") {
    events.push({
      type: "session_start",
      sessionId: msg.session_id ?? fallbackSessionId,
      model: msg.model,
      tools: msg.tools,
    });
    return events;
  }

  if (msg.type === "stream_event") {
    const sessionId = msg.session_id ?? fallbackSessionId;
    const ev = msg.event as {
      type?: string;
      index?: number;
      delta?: { type?: string; text?: string };
    };
    if (
      ev.type === "content_block_delta" &&
      ev.delta?.type === "text_delta" &&
      typeof ev.delta.text === "string" &&
      ev.delta.text.length > 0
    ) {
      events.push({
        type: "assistant_text_delta",
        sessionId,
        messageId: msg.uuid,
        blockIndex: typeof ev.index === "number" ? ev.index : 0,
        text: ev.delta.text,
      });
    }
    return events;
  }

  if (msg.type === "assistant") {
    const content = msg.message.content;
    const sessionId = msg.session_id ?? fallbackSessionId;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (isText(block)) {
          events.push({
            type: "assistant_text",
            sessionId,
            text: block.text,
          });
        } else if (isToolUse(block)) {
          events.push({
            type: "tool_call",
            sessionId,
            toolUseId: block.id,
            tool: block.name,
            input: block.input,
          });
        } else if (isThinking(block)) {
          events.push({
            type: "thinking",
            sessionId,
            text: block.thinking,
          });
        }
      }
    }
    return events;
  }

  if (msg.type === "user") {
    const sessionId = msg.session_id ?? fallbackSessionId;
    const content = msg.message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (isToolResult(block)) {
          events.push({
            type: "tool_result",
            sessionId,
            toolUseId: block.tool_use_id,
            ok: !block.is_error,
            output: flattenToolResultContent(block.content),
          });
        }
      }
    }
    return events;
  }

  if (msg.type === "result") {
    const sessionId = msg.session_id ?? fallbackSessionId;
    if (msg.subtype === "success") {
      events.push({
        type: "result",
        sessionId,
        ok: true,
        durationMs: msg.duration_ms,
        costUsd: msg.total_cost_usd,
        summary: msg.result,
      });
    } else {
      events.push({
        type: "result",
        sessionId,
        ok: false,
        durationMs: msg.duration_ms,
        costUsd: msg.total_cost_usd,
        ...(Array.isArray(msg.errors) && msg.errors.length > 0
          ? { summary: msg.errors.join("\n") }
          : {}),
      });
    }
    return events;
  }

  return events;
}

// ─── Interactive (multi-turn streaming-input) session ──────────────────────

/**
 * Async queue feeding SDKUserMessage values into a streaming-input query().
 * Producers call push(text); the consumer (the SDK) iterates via for-await.
 */
class UserMessageQueue implements AsyncIterable<SDKUserMessage> {
  private buf: SDKUserMessage[] = [];
  private resolvers: Array<(r: IteratorResult<SDKUserMessage>) => void> = [];
  private closed = false;

  push(text: string): void {
    if (this.closed) return;
    const msg: SDKUserMessage = {
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
    };
    const r = this.resolvers.shift();
    if (r) r({ value: msg, done: false });
    else this.buf.push(msg);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    while (this.resolvers.length > 0) {
      const r = this.resolvers.shift();
      r?.({ value: undefined as unknown as SDKUserMessage, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    const self = this;
    return {
      next(): Promise<IteratorResult<SDKUserMessage>> {
        const v = self.buf.shift();
        if (v) return Promise.resolve({ value: v, done: false });
        if (self.closed) {
          return Promise.resolve({
            value: undefined as unknown as SDKUserMessage,
            done: true,
          });
        }
        return new Promise((resolve) => self.resolvers.push(resolve));
      },
      return(): Promise<IteratorResult<SDKUserMessage>> {
        self.close();
        return Promise.resolve({
          value: undefined as unknown as SDKUserMessage,
          done: true,
        });
      },
    };
  }
}

export interface RunInteractiveInput {
  auth: AuthContext;
  /** Override default model. Defaults to claude-opus-4-7. */
  model?: string;
  /** Working directory the agent should treat as project root. */
  cwd?: string;
  /** Permission mode. Interactive callers usually set bypassPermissions or supply canUseTool. */
  permissionMode?: Options["permissionMode"];
  /** Caller-supplied MCP servers (e.g. sandbox-runtime tools). */
  extraMcpServers?: Record<string, McpServerConfig>;
  /** Names of tools to allow without prompting. Defaults to read-only set. */
  allowedTools?: string[];
  /** Resume a previous session id. */
  resumeSessionId?: string;
  /** Optional context appended to the system prompt. */
  systemContext?: string;
  /** AbortController to cancel the whole session. */
  signal?: AbortSignal;
  /** Stream partial text deltas (default true). */
  streamDeltas?: boolean;
  /** Optional permission gate; required if permissionMode is 'default'. */
  canUseTool?: CanUseTool;
}

export interface InteractiveSession {
  /** Async stream of normalized events. The REPL renders these. */
  events: AsyncGenerator<ThoxEvent>;
  /** Send a user prompt into the running session. */
  send(text: string): void;
  /** Cancel the current turn. The session stays open for the next prompt. */
  interrupt(): Promise<void>;
  /** End the session: closes input, ends event stream, aborts. */
  close(): void;
}

/**
 * Open a multi-turn streaming-input session against the Claude Agent SDK.
 * The CLI REPL calls send() per user line and renders events as they arrive.
 */
export function runInteractive(input: RunInteractiveInput): InteractiveSession {
  const queue = new UserMessageQueue();
  let internalSessionId: string = crypto.randomUUID();
  const abort = new AbortController();
  if (input.signal) {
    input.signal.addEventListener("abort", () => abort.abort(), { once: true });
  }

  const mcpServers: Record<string, McpServerConfig> = {
    "thox-quantum": {
      type: "sdk",
      name: "thox-quantum",
      instance: createThoxQuantumMcpServer().instance,
    },
    ...(input.extraMcpServers ?? {}),
  };

  const streamDeltas = input.streamDeltas ?? true;

  const options: Options = {
    model: input.model ?? DEFAULT_MODEL,
    systemPrompt: thoxSystemPrompt(input.systemContext),
    permissionMode: input.permissionMode ?? "default",
    allowedTools: input.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
    mcpServers,
    env: authToSdkEnv(input.auth),
    abortController: abort,
    settingSources: [],
    includePartialMessages: streamDeltas,
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.canUseTool !== undefined ? { canUseTool: input.canUseTool } : {}),
    ...(input.resumeSessionId !== undefined
      ? { resume: input.resumeSessionId }
      : {}),
  };

  const q = query({ prompt: queue, options });

  async function* eventStream(): AsyncGenerator<ThoxEvent> {
    try {
      for await (const message of q) {
        for (const event of mapSdkMessage(message, internalSessionId)) {
          if (event.type === "session_start") {
            internalSessionId = event.sessionId;
          }
          yield event;
        }
      }
    } catch (err) {
      yield {
        type: "error",
        sessionId: internalSessionId,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return {
    events: eventStream(),
    send(text: string): void {
      queue.push(text);
    },
    async interrupt(): Promise<void> {
      try {
        await q.interrupt();
      } catch {
        // interrupt() is only valid mid-turn; ignore "no active turn" errors.
      }
    },
    close(): void {
      queue.close();
      abort.abort();
    },
  };
}
