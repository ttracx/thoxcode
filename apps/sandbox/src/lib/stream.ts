import type { ThoxEvent } from "./types";

export interface StreamRequest {
  prompt: string;
  sessionId?: string;
  byokKey?: string;
  bearerToken?: string;
  bridgeUrl: string;
  signal?: AbortSignal;
  gitSource?: { url: string; revision?: string };
}

/**
 * POST to /v1/agent/stream and consume the SSE stream as a typed
 * AsyncIterable. The bridge sends one SSE message per ThoxEvent.
 */
export async function* streamAgent(
  req: StreamRequest,
): AsyncGenerator<ThoxEvent> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  if (req.byokKey) headers["x-thoxcode-byok"] = req.byokKey;
  if (req.bearerToken) headers["authorization"] = `Bearer ${req.bearerToken}`;
  if (req.sessionId) headers["x-thoxcode-session"] = req.sessionId;

  const res = await fetch(`${req.bridgeUrl}/v1/agent/stream`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      prompt: req.prompt,
      sessionId: req.sessionId,
      gitSource: req.gitSource,
    }),
    ...(req.signal !== undefined ? { signal: req.signal } : {}),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bridge ${res.status}: ${body || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames separated by \n\n
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (dataLines.length === 0) continue;

      try {
        const parsed = JSON.parse(dataLines.join("\n")) as ThoxEvent;
        yield parsed;
      } catch {
        // Ignore malformed frames rather than killing the stream
      }
    }
  }
}
