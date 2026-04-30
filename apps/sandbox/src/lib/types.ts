// Mirrors thoxcode-core's ThoxEvent. We duplicate (rather than import) to
// keep the browser bundle free of any Node-targeted code.
export type ThoxEvent =
  | { type: "session_start"; sessionId: string; model: string; tools: string[] }
  | { type: "assistant_text"; sessionId: string; text: string }
  | {
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

export type AuthMode = "byok" | "managed";
