import { Sandbox } from "@vercel/sandbox";

export interface SandboxLeaseOptions {
  /** node24 (default), node22, or python3.13 */
  runtime?: "node24" | "node22" | "python3.13";
  /** Initial timeout in ms. Vercel default is 5min. */
  timeoutMs?: number;
  /** Ports to expose for sandbox.domain() preview URLs. */
  ports?: number[];
  /** Default env injected into every command. */
  env?: Record<string, string>;
  /** Initial git source to clone. */
  source?: {
    type: "git";
    url: string;
    revision?: string;
    username?: string;
    password?: string;
  };
}

/**
 * One-sandbox-per-session lease. The web bridge keeps a Map<sessionId, Lease>
 * and disposes on client disconnect or idle timeout.
 */
export class SandboxLease {
  private constructor(
    public readonly sandbox: Sandbox,
    public readonly id: string,
  ) {}

  static async open(opts: SandboxLeaseOptions = {}): Promise<SandboxLease> {
    const sandbox = await Sandbox.create({
      runtime: opts.runtime ?? "node24",
      timeout: opts.timeoutMs ?? 15 * 60_000,
      ...(opts.ports !== undefined ? { ports: opts.ports } : {}),
      ...(opts.env !== undefined ? { env: opts.env } : {}),
      ...(opts.source !== undefined
        ? {
            source: {
              type: "git",
              url: opts.source.url,
              ...(opts.source.revision !== undefined
                ? { revision: opts.source.revision }
                : {}),
              ...(opts.source.username !== undefined
                ? { username: opts.source.username }
                : {}),
              ...(opts.source.password !== undefined
                ? { password: opts.source.password }
                : {}),
            },
          }
        : {}),
    });
    return new SandboxLease(sandbox, sandbox.sandboxId);
  }

  async dispose(): Promise<void> {
    try {
      await this.sandbox.stop();
    } catch {
      // best-effort
    }
  }

  /** Public preview URL if a port was registered. Throws otherwise. */
  publicUrl(port: number): string {
    return this.sandbox.domain(port);
  }

  /** Extend the running timeout (ms). */
  async extend(ms: number): Promise<void> {
    await this.sandbox.extendTimeout(ms);
  }
}
