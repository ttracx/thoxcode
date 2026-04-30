/**
 * Wire protocol for the ThoxOS Unix-socket daemon. Newline-delimited JSON
 * (JSONL) in both directions. The CLI writes one ClientMessage per line;
 * the daemon writes one ServerMessage per line.
 *
 * Versioning: bump PROTOCOL_VERSION on any breaking change.
 */
export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | {
      type: "hello";
      protocol: typeof PROTOCOL_VERSION;
    }
  | {
      type: "run";
      requestId: string;
      prompt: string;
      cwd?: string;
      yolo?: boolean;
      apiKey?: string; // BYOK; daemon's own ANTHROPIC_API_KEY is used if absent
      systemContext?: string;
    }
  | { type: "cancel"; requestId: string };

export type ServerMessage =
  | {
      type: "ready";
      protocol: typeof PROTOCOL_VERSION;
      version: string; // semver of the daemon
      pid: number;
      ssAvailable: boolean; // is sandbox-runtime usable
    }
  | {
      type: "event";
      requestId: string;
      event: import("@thoxcode/core").ThoxEvent;
    }
  | { type: "done"; requestId: string }
  | { type: "error"; requestId?: string; message: string };
