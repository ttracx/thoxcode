import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyResult,
} from "jose";
import { resolveAuth, ThoxAuthError, type AuthContext } from "thoxcode-core";

export interface BridgeAuthInput {
  /** Header value of `x-thoxcode-byok` (raw user-supplied Anthropic key) */
  byokHeader?: string | undefined;
  /** Bearer token from Authorization header (Supabase JWT, managed mode) */
  bearerToken?: string | undefined;
}

const SUPABASE_JWT_ALG = (process.env.SUPABASE_JWT_ALG ?? "HS256") as
  | "HS256"
  | "RS256"
  | "ES256";
const SUPABASE_JWT_ISSUER = process.env.SUPABASE_JWT_ISSUER; // e.g. https://xyz.supabase.co/auth/v1
const SUPABASE_JWT_AUDIENCE = process.env.SUPABASE_JWT_AUDIENCE ?? "authenticated";
const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL; // optional, for asymmetric algs

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function jwks() {
  if (!cachedJwks && SUPABASE_JWKS_URL) {
    cachedJwks = createRemoteJWKSet(new URL(SUPABASE_JWKS_URL));
  }
  return cachedJwks;
}

/**
 * Verify a Supabase JWT and return its payload. Supports HS256 (default,
 * uses SUPABASE_JWT_SECRET) and RS256/ES256 (via SUPABASE_JWKS_URL).
 */
async function verifySupabaseJwt(jwt: string): Promise<JWTPayload | null> {
  const verifyOpts = {
    audience: SUPABASE_JWT_AUDIENCE,
    ...(SUPABASE_JWT_ISSUER ? { issuer: SUPABASE_JWT_ISSUER } : {}),
  } as const;

  try {
    let result: JWTVerifyResult;
    if (SUPABASE_JWT_ALG === "HS256") {
      const secret = process.env.SUPABASE_JWT_SECRET;
      if (!secret) return null;
      const key = new TextEncoder().encode(secret);
      result = await jwtVerify(jwt, key, verifyOpts);
    } else {
      const keyset = jwks();
      if (!keyset) return null;
      result = await jwtVerify(jwt, keyset, verifyOpts);
    }
    return result.payload;
  } catch {
    return null;
  }
}

/**
 * Resolve auth for one bridge request. Validates Supabase JWTs against
 * SUPABASE_JWT_SECRET (or SUPABASE_JWKS_URL for asymmetric algs), falls
 * back to BYOK otherwise.
 */
export async function authenticateRequest(
  input: BridgeAuthInput,
): Promise<AuthContext> {
  if (input.byokHeader) {
    return resolveAuth({ byokKey: input.byokHeader });
  }

  if (input.bearerToken) {
    const payload = await verifySupabaseJwt(input.bearerToken);
    if (!payload || typeof payload.sub !== "string") {
      throw new ThoxAuthError(
        "Invalid Supabase JWT",
        "missing_managed_key",
      );
    }
    const managedKey = process.env.ANTHROPIC_API_KEY;
    return resolveAuth({ userId: payload.sub, managedKey });
  }

  throw new ThoxAuthError(
    "Missing auth: provide either x-thoxcode-byok header or Authorization bearer token",
    "missing_byok_key",
  );
}
