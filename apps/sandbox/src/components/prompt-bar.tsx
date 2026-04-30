"use client";

import { useState } from "react";

export interface PromptBarProps {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  busy: boolean;
}

export function PromptBar({ onSubmit, onCancel, busy }: PromptBarProps) {
  const [value, setValue] = useState("");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="border-t border-thox-border bg-thox-surface p-3">
      <div className="flex gap-2 items-end">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask ThoxCode to scaffold, refactor, run tests, simulate a quantum circuit…  (⌘/Ctrl+Enter)"
          rows={2}
          disabled={busy}
          className="flex-1 bg-thox-bg border border-thox-border rounded-md px-3 py-2 text-sm text-thox-text font-mono resize-y focus:outline-none focus:border-thox-cyan disabled:opacity-50"
        />
        {busy ? (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!value.trim()}
            className="px-4 py-2 rounded-md bg-thox-cyan/20 text-thox-cyan text-sm hover:bg-thox-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
