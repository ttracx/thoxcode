"use client";

import { useMemo } from "react";
import type { ThoxEvent } from "@/lib/types";

function jsonOneLine(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 280 ? s.slice(0, 277) + "…" : s;
  } catch {
    return String(v);
  }
}

/**
 * Coalesce streamed deltas into a single live row per (messageId, blockIndex).
 * The final assistant_text overwrites the live row when it arrives.
 */
type DisplayRow =
  | { kind: "session_start"; sessionId: string; model: string }
  | { kind: "live_text"; key: string; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool_call"; tool: string; input: unknown }
  | { kind: "tool_result"; ok: boolean; output: string }
  | { kind: "thinking"; text: string }
  | { kind: "result"; durationMs: number; costUsd: number; ok: boolean }
  | { kind: "error"; message: string };

function coalesce(events: ThoxEvent[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  const liveIndex = new Map<string, number>(); // (messageId:blockIndex) -> rows idx

  for (const e of events) {
    if (e.type === "session_start") {
      rows.push({ kind: "session_start", sessionId: e.sessionId, model: e.model });
    } else if (e.type === "assistant_text_delta") {
      const key = `${e.messageId}:${e.blockIndex}`;
      const idx = liveIndex.get(key);
      if (idx !== undefined) {
        const existing = rows[idx];
        if (existing && existing.kind === "live_text") {
          rows[idx] = { kind: "live_text", key, text: existing.text + e.text };
        }
      } else {
        liveIndex.set(key, rows.length);
        rows.push({ kind: "live_text", key, text: e.text });
      }
    } else if (e.type === "assistant_text") {
      // Drop the most recent live row for this turn if present, push final.
      // (Multiple finals per turn just append.)
      const last = rows[rows.length - 1];
      if (last && last.kind === "live_text") {
        rows[rows.length - 1] = { kind: "text", text: e.text };
        liveIndex.clear();
      } else {
        rows.push({ kind: "text", text: e.text });
      }
    } else if (e.type === "tool_call") {
      rows.push({ kind: "tool_call", tool: e.tool, input: e.input });
    } else if (e.type === "tool_result") {
      rows.push({ kind: "tool_result", ok: e.ok, output: e.output });
    } else if (e.type === "thinking") {
      rows.push({ kind: "thinking", text: e.text });
    } else if (e.type === "result") {
      rows.push({
        kind: "result",
        durationMs: e.durationMs,
        costUsd: e.costUsd,
        ok: e.ok,
      });
    } else if (e.type === "error") {
      rows.push({ kind: "error", message: e.message });
    }
  }
  return rows;
}

function Row({ row }: { row: DisplayRow }) {
  switch (row.kind) {
    case "session_start":
      return (
        <div className="text-xs text-thox-muted">
          ▸ session{" "}
          <span className="font-mono">{row.sessionId.slice(0, 8)}</span> ·{" "}
          {row.model}
        </div>
      );
    case "live_text":
      return (
        <div className="whitespace-pre-wrap text-thox-text leading-relaxed">
          {row.text}
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-thox-cyan animate-pulse align-middle" />
        </div>
      );
    case "text":
      if (row.text.startsWith("> ")) {
        return (
          <div className="whitespace-pre-wrap text-thox-cyan font-mono text-sm">
            {row.text}
          </div>
        );
      }
      return (
        <div className="whitespace-pre-wrap text-thox-text leading-relaxed">
          {row.text}
        </div>
      );
    case "tool_call":
      return (
        <div className="font-mono text-xs">
          <span className="text-thox-cyan">→ {row.tool}</span>{" "}
          <span className="text-thox-muted">{jsonOneLine(row.input)}</span>
        </div>
      );
    case "tool_result": {
      const head = row.ok ? (
        <span className="text-emerald-400">✓</span>
      ) : (
        <span className="text-red-400">✗</span>
      );
      return (
        <pre className="font-mono text-xs text-thox-muted whitespace-pre-wrap pl-4 border-l-2 border-thox-border">
          {head} {row.output.split("\n").slice(0, 12).join("\n")}
        </pre>
      );
    }
    case "thinking":
      return (
        <div className="italic text-xs text-thox-muted">
          thinking… {row.text.slice(0, 160)}
        </div>
      );
    case "result":
      return (
        <div className="text-xs text-thox-muted border-t border-thox-border pt-2 mt-2">
          ▸ done in {(row.durationMs / 1000).toFixed(1)}s · $
          {row.costUsd.toFixed(4)}
        </div>
      );
    case "error":
      return (
        <div className="text-xs text-red-400 font-mono">
          error: {row.message}
        </div>
      );
  }
}

export function EventLog({ events }: { events: ThoxEvent[] }) {
  const rows = useMemo(() => coalesce(events), [events]);
  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {rows.length === 0 ? (
        <div className="text-thox-muted text-sm">
          Send a prompt below — ThoxCode will run inside an isolated Vercel
          Sandbox microVM, with ThoxQuantum tools available for cuQuantum
          circuit work.
        </div>
      ) : (
        rows.map((r, i) => <Row key={i} row={r} />)
      )}
    </div>
  );
}
