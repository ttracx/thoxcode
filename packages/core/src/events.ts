/**
 * Wire format streamed from the bridge to the browser, and from the CLI
 * runtime to its own UI layer. Strictly serializable (JSON-clean) so it
 * crosses WebSocket / SSE / Unix-socket boundaries cleanly.
 */
export type ThoxEvent =
  | { type: "session_start"; sessionId: string; model: string; tools: string[] }
  | { type: "assistant_text"; sessionId: string; text: string }
  | {
      /**
       * Incremental text delta from streaming. Multiple deltas can target
       * the same `messageId` and `blockIndex`; consumers concatenate them
       * to build the live message. Followed by a final `assistant_text`
       * once the block closes.
       */
      type: "assistant_text_delta";
      sessionId: string;
      messageId: string;
      blockIndex: number;
      text: string;
    }
  | {
      type: "tool_call";
      sessionId: string;
      toolUseId: string;
      tool: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      sessionId: string;
      toolUseId: string;
      ok: boolean;
      output: string;
    }
  | { type: "thinking"; sessionId: string; text: string }
  | {
      type: "result";
      sessionId: string;
      ok: boolean;
      durationMs: number;
      costUsd: number;
      summary?: string;
    }
  | { type: "error"; sessionId: string; message: string; code?: string };

export type ThoxEventType = ThoxEvent["type"];
