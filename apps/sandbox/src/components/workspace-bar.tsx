"use client";

import { useState } from "react";

const GIT_URL_RE =
  /^(https:\/\/[^\s]+\.git|git@[^\s:]+:[^\s]+\.git|https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/?)$/;

export interface GitSource {
  url: string;
  revision?: string;
}

export interface WorkspaceBarProps {
  /** Locked once the first prompt is sent in a session. */
  locked: boolean;
  value: GitSource | null;
  onChange: (next: GitSource | null) => void;
}

export function WorkspaceBar({ locked, value, onChange }: WorkspaceBarProps) {
  const [draftUrl, setDraftUrl] = useState(value?.url ?? "");
  const [draftRev, setDraftRev] = useState(value?.revision ?? "");
  const [editing, setEditing] = useState(value === null);
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const trimmed = draftUrl.trim();
    if (!trimmed) {
      onChange(null);
      setEditing(false);
      setError(null);
      return;
    }
    if (!GIT_URL_RE.test(trimmed)) {
      setError("Expected an https://… .git URL or github.com/owner/repo");
      return;
    }
    onChange({
      url: trimmed,
      ...(draftRev.trim() ? { revision: draftRev.trim() } : {}),
    });
    setEditing(false);
    setError(null);
  };

  if (!editing && value) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-thox-border bg-thox-bg/50 text-xs">
        <span className="text-thox-muted">workspace</span>
        <code className="text-thox-cyan font-mono truncate max-w-[40ch]">
          {value.url}
        </code>
        {value.revision && (
          <code className="text-thox-muted font-mono">@ {value.revision}</code>
        )}
        {!locked && (
          <button
            onClick={() => setEditing(true)}
            className="text-thox-muted hover:text-thox-text ml-2"
          >
            change
          </button>
        )}
        {locked && (
          <span className="text-thox-muted ml-2">
            (locked — start a new session to change)
          </span>
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-thox-border bg-thox-bg/50 text-xs">
        <span className="text-thox-muted">workspace</span>
        <span className="text-thox-muted italic">empty sandbox</span>
        {!locked && (
          <button
            onClick={() => setEditing(true)}
            className="text-thox-cyan hover:underline ml-2"
          >
            clone a repo
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-thox-border bg-thox-bg/50 text-xs">
      <span className="text-thox-muted shrink-0">git</span>
      <input
        value={draftUrl}
        onChange={(e) => setDraftUrl(e.target.value)}
        placeholder="https://github.com/you/repo.git"
        className="flex-1 font-mono px-2 py-1 rounded bg-thox-bg border border-thox-border focus:outline-none focus:border-thox-cyan"
      />
      <input
        value={draftRev}
        onChange={(e) => setDraftRev(e.target.value)}
        placeholder="rev (branch/tag/sha)"
        className="w-40 font-mono px-2 py-1 rounded bg-thox-bg border border-thox-border focus:outline-none focus:border-thox-cyan"
      />
      <button
        onClick={apply}
        className="px-3 py-1 rounded bg-thox-cyan/20 text-thox-cyan hover:bg-thox-cyan/30"
      >
        apply
      </button>
      <button
        onClick={() => {
          setDraftUrl("");
          setDraftRev("");
          onChange(null);
          setEditing(false);
          setError(null);
        }}
        className="text-thox-muted hover:text-thox-text"
      >
        clear
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
