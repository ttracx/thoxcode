"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthBar } from "@/components/auth-bar";
import { EventLog } from "@/components/event-log";
import { PromptBar } from "@/components/prompt-bar";
import { WorkspaceBar, type GitSource } from "@/components/workspace-bar";
import { streamAgent } from "@/lib/stream";
import type { AuthMode, ThoxEvent } from "@/lib/types";

const BRIDGE_URL =
  process.env.NEXT_PUBLIC_THOXCODE_BRIDGE_URL ?? "http://localhost:8787";

export default function HomePage() {
  const [mode, setMode] = useState<AuthMode>("byok");
  const [byokKey, setByokKey] = useState("");
  const [bearerToken, setBearerToken] = useState<string | null>(null);
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [events, setEvents] = useState<ThoxEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [gitSource, setGitSource] = useState<GitSource | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // BYOK key persistence in localStorage. Never sent anywhere except the
  // bridge over TLS in the x-thoxcode-byok header.
  useEffect(() => {
    const stored = localStorage.getItem("thoxcode:byok");
    if (stored) setByokKey(stored);
  }, []);
  useEffect(() => {
    if (byokKey) localStorage.setItem("thoxcode:byok", byokKey);
    else localStorage.removeItem("thoxcode:byok");
  }, [byokKey]);

  const submit = useCallback(
    async (prompt: string) => {
      setBusy(true);
      setEvents((prev) => [
        ...prev,
        {
          type: "assistant_text",
          sessionId,
          text: `> ${prompt}`,
        },
      ]);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        // gitSource is forwarded only on the first prompt of a session;
        // the bridge ignores it for subsequent prompts (sandbox already cloned).
        const sendGit = !sessionStarted && gitSource ? gitSource : undefined;
        if (!sessionStarted) setSessionStarted(true);

        for await (const event of streamAgent({
          prompt,
          sessionId,
          bridgeUrl: BRIDGE_URL,
          signal: ac.signal,
          ...(mode === "byok" && byokKey ? { byokKey } : {}),
          ...(mode === "managed" && bearerToken ? { bearerToken } : {}),
          ...(sendGit ? { gitSource: sendGit } : {}),
        })) {
          setEvents((prev) => [...prev, event]);
        }
      } catch (e) {
        setEvents((prev) => [
          ...prev,
          {
            type: "error",
            sessionId,
            message: e instanceof Error ? e.message : String(e),
          },
        ]);
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [mode, byokKey, bearerToken, sessionId, gitSource, sessionStarted],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const signIn = useCallback(() => {
    // Stub — wire into Supabase OAuth in production. For now we just set
    // a developer token if SUPABASE_JWT_SECRET is configured server-side.
    const dev = window.prompt("Paste a Supabase JWT (dev only):");
    if (dev) {
      setBearerToken(dev);
      try {
        const payloadStr = dev.split(".")[1];
        if (payloadStr) {
          const payload = JSON.parse(atob(payloadStr));
          setSignedInAs(payload.email ?? payload.sub ?? "user");
        }
      } catch {
        setSignedInAs("user");
      }
    }
  }, []);

  const signOut = useCallback(() => {
    setBearerToken(null);
    setSignedInAs(null);
  }, []);

  return (
    <main className="flex flex-col h-screen bg-thox-bg">
      <AuthBar
        mode={mode}
        onModeChange={setMode}
        byokKey={byokKey}
        onByokKeyChange={setByokKey}
        signedInAs={signedInAs}
        onSignIn={signIn}
        onSignOut={signOut}
      />
      <WorkspaceBar
        locked={sessionStarted}
        value={gitSource}
        onChange={setGitSource}
      />
      <EventLog events={events} />
      <PromptBar onSubmit={submit} onCancel={cancel} busy={busy} />
    </main>
  );
}
