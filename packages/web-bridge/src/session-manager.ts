import {
  SandboxLease,
  type SandboxLeaseOptions,
} from "@thoxcode/sandbox-runtime";

interface SessionEntry {
  lease: SandboxLease;
  lastUsedAt: number;
  userId?: string;
}

/**
 * Pool of one-sandbox-per-session leases. We dispose on idle to keep
 * Vercel Sandbox costs bounded.
 */
export class SessionManager {
  private sessions = new Map<string, SessionEntry>();
  private readonly idleTimeoutMs: number;
  private readonly sweeper: NodeJS.Timeout;

  constructor(opts: { idleTimeoutMs?: number } = {}) {
    this.idleTimeoutMs =
      opts.idleTimeoutMs ?? Number(process.env.THOXCODE_SESSION_TIMEOUT_MS ?? 15 * 60_000);
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref?.();
  }

  async acquire(
    sessionId: string,
    leaseOpts: SandboxLeaseOptions = {},
    userId?: string,
  ): Promise<SandboxLease> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastUsedAt = Date.now();
      return existing.lease;
    }
    const lease = await SandboxLease.open(leaseOpts);
    this.sessions.set(sessionId, {
      lease,
      lastUsedAt: Date.now(),
      ...(userId !== undefined ? { userId } : {}),
    });
    return lease;
  }

  async release(sessionId: string): Promise<void> {
    const entry = this.sessions.get(sessionId);
    if (!entry) return;
    this.sessions.delete(sessionId);
    await entry.lease.dispose();
  }

  private async sweep(): Promise<void> {
    const cutoff = Date.now() - this.idleTimeoutMs;
    const stale: string[] = [];
    for (const [id, entry] of this.sessions) {
      if (entry.lastUsedAt < cutoff) stale.push(id);
    }
    for (const id of stale) {
      await this.release(id);
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.sweeper);
    const all = Array.from(this.sessions.keys());
    await Promise.all(all.map((id) => this.release(id)));
  }
}
