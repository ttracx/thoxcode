"use client";

import type { AuthMode } from "@/lib/types";

export interface AuthBarProps {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  byokKey: string;
  onByokKeyChange: (k: string) => void;
  signedInAs: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function AuthBar(props: AuthBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-thox-border bg-thox-surface text-sm">
      <span className="text-thox-cyan font-semibold">ThoxCode</span>
      <span className="text-thox-muted">·</span>
      <span className="text-thox-muted text-xs">Powered by Claude</span>

      <div className="flex-1" />

      <div className="flex items-center gap-2 rounded-lg border border-thox-border p-0.5">
        <button
          onClick={() => props.onModeChange("byok")}
          className={`px-3 py-1 rounded-md text-xs transition ${
            props.mode === "byok"
              ? "bg-thox-cyan/20 text-thox-cyan"
              : "text-thox-muted hover:text-thox-text"
          }`}
        >
          BYOK
        </button>
        <button
          onClick={() => props.onModeChange("managed")}
          className={`px-3 py-1 rounded-md text-xs transition ${
            props.mode === "managed"
              ? "bg-thox-cyan/20 text-thox-cyan"
              : "text-thox-muted hover:text-thox-text"
          }`}
        >
          Thox-managed
        </button>
      </div>

      {props.mode === "byok" ? (
        <input
          type="password"
          spellCheck={false}
          autoComplete="off"
          placeholder="sk-ant-…"
          value={props.byokKey}
          onChange={(e) => props.onByokKeyChange(e.target.value)}
          className="font-mono text-xs px-3 py-1.5 w-72 rounded-md bg-thox-bg border border-thox-border focus:outline-none focus:border-thox-cyan"
        />
      ) : props.signedInAs ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-thox-muted">{props.signedInAs}</span>
          <button
            onClick={props.onSignOut}
            className="text-xs text-thox-muted hover:text-thox-text"
          >
            Sign out
          </button>
        </div>
      ) : (
        <button
          onClick={props.onSignIn}
          className="text-xs px-3 py-1.5 rounded-md bg-thox-cyan/20 text-thox-cyan hover:bg-thox-cyan/30"
        >
          Sign in with Supabase
        </button>
      )}
    </div>
  );
}
