export type AuthMode = "byok" | "managed";

export interface AuthContext {
  mode: AuthMode;
  apiKey: string;
  /** Opaque user id used for rate limiting / billing in managed mode. */
  userId?: string;
}

export class ThoxAuthError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "missing_byok_key"
      | "missing_managed_key"
      | "invalid_key_format",
  ) {
    super(message);
    this.name = "ThoxAuthError";
  }
}

const ANTHROPIC_KEY_PREFIX = "sk-ant-";

function looksLikeAnthropicKey(value: string): boolean {
  return value.startsWith(ANTHROPIC_KEY_PREFIX) && value.length > 20;
}

/**
 * Resolve an API key for one agent run. The bridge calls this per request;
 * the CLI calls it once at startup. Never logs the resolved key.
 */
export function resolveAuth(input: {
  byokKey?: string | undefined;
  userId?: string | undefined;
  managedKey?: string | undefined;
}): AuthContext {
  if (input.byokKey) {
    if (!looksLikeAnthropicKey(input.byokKey)) {
      throw new ThoxAuthError(
        "BYOK key must start with sk-ant-",
        "invalid_key_format",
      );
    }
    return { mode: "byok", apiKey: input.byokKey };
  }

  if (input.userId) {
    if (!input.managedKey) {
      throw new ThoxAuthError(
        "Managed mode requires THOXCODE-side ANTHROPIC_API_KEY",
        "missing_managed_key",
      );
    }
    if (!looksLikeAnthropicKey(input.managedKey)) {
      throw new ThoxAuthError(
        "Managed key must start with sk-ant-",
        "invalid_key_format",
      );
    }
    return { mode: "managed", apiKey: input.managedKey, userId: input.userId };
  }

  throw new ThoxAuthError(
    "Provide either a user-supplied key (BYOK) or an authenticated userId",
    "missing_byok_key",
  );
}

/**
 * Build the env subset we hand the SDK. Excludes the rest of process.env
 * by default to avoid leaking unrelated secrets into the agent subprocess.
 */
export function authToSdkEnv(auth: AuthContext): Record<string, string> {
  return {
    ANTHROPIC_API_KEY: auth.apiKey,
  };
}
