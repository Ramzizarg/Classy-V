import { cookies } from "next/headers";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";

export const ADMIN_COOKIE = "classyv_admin";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12h
const PBKDF2_ITERATIONS = 210_000;
const encoder = new TextEncoder();

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Dev-only defaults; production never falls back to a publicly known value. */
function getEnv(name: string, devFallback: string): string | null {
  const value = process.env[name]?.trim();
  if (value) return value;
  return IS_PRODUCTION ? null : devFallback;
}

export function getAdminCredentials(): { email: string; password: string } | null {
  const email = getEnv("ADMIN_LOGIN_EMAIL", "admin@classyv.local");
  const password = getEnv("ADMIN_PASSWORD", "classyv");
  return email && password ? { email, password } : null;
}

function getSessionSecret(): string | null {
  const secret = getEnv("ADMIN_SESSION_SECRET", "classyv-dev-secret-change-this-in-env");
  if (!secret) {
    console.error("[adminAuth] ADMIN_SESSION_SECRET is not set; admin sessions are disabled.");
    return null;
  }
  return secret;
}

async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string) {
  if (!hex || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

function timingSafeEqualString(a: string, b: string) {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

async function pbkdf2Hex(password: string, saltHex: string, iterations: number) {
  const saltBytes = fromHex(saltHex);
  if (!saltBytes || !Number.isFinite(iterations) || iterations < 10_000) {
    return null;
  }
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/** Format: `pbkdf2$<iter>$<saltHex>$<hashHex>` */
export async function hashAdminPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);
  const hashHex = await pbkdf2Hex(password, saltHex, PBKDF2_ITERATIONS);
  if (!hashHex) throw new Error("Failed to hash password");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

export async function verifyPasswordStoredHash(
  candidatePassword: string,
  storedHash: string,
): Promise<boolean> {
  const trimmed = storedHash.trim();
  if (!trimmed.startsWith("pbkdf2$")) return false;
  const [, iterRaw, saltHex, expectedHex] = trimmed.split("$");
  const iterations = Number.parseInt(iterRaw ?? "", 10);
  const derivedHex = await pbkdf2Hex(candidatePassword, saltHex ?? "", iterations);
  return !!derivedHex && timingSafeEqualString(derivedHex, expectedHex ?? "");
}

export function verifyAdminEnvCredentials(email: string, password: string): boolean {
  const expected = getAdminCredentials();
  if (!expected) return false;
  const emailOk = timingSafeEqualString(email.trim().toLowerCase(), expected.email.toLowerCase());
  const passwordOk = timingSafeEqualString(password, expected.password);
  return emailOk && passwordOk;
}

export type AdminDbLoginResult = "ok" | "fail" | "skip";

/**
 * If `backoffice_users` has a row for this email, password must match (DB wins).
 * If no row / no DATABASE_URL / table missing, returns `skip` for env fallback.
 */
export async function tryAdminDbLogin(
  email: string,
  password: string,
): Promise<AdminDbLoginResult> {
  if (!resolveDatabaseUrl()) return "skip";
  const normalized = email.trim();
  if (!normalized) return "skip";

  try {
    const { rows } = await neonQuery<{ password_hash: string }>(
      `SELECT password_hash::text AS password_hash
       FROM backoffice_users
       WHERE lower(trim(email)) = lower(trim($1))
       LIMIT 1`,
      [normalized],
    );
    const row = rows[0];
    if (!row?.password_hash?.trim()) return "skip";
    const ok = await verifyPasswordStoredHash(password, row.password_hash);
    return ok ? "ok" : "fail";
  } catch {
    return "skip";
  }
}

export async function authenticateAdmin(email: string, password: string): Promise<boolean> {
  const dbLogin = await tryAdminDbLogin(email, password);
  if (dbLogin === "ok") return true;
  if (dbLogin === "fail") return false;
  return verifyAdminEnvCredentials(email, password);
}

export async function createAdminSessionToken() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = nowSeconds + SESSION_DURATION_SECONDS;
  const nonce = crypto.randomUUID();
  const payload = `${expiresAt}.${nowSeconds}.${nonce}`;
  const secret = getSessionSecret();
  if (!secret) throw new Error("Admin sessions are not configured.");
  const signature = await hmacHex(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyAdminSessionToken(token?: string | null) {
  if (!token) return false;

  const [expiresAtRaw, issuedAtRaw, nonce, signature] = token.split(".");
  const expiresAt = Number.parseInt(expiresAtRaw ?? "", 10);
  const issuedAt = Number.parseInt(issuedAtRaw ?? "", 10);

  if (!Number.isFinite(expiresAt) || !Number.isFinite(issuedAt) || !nonce || !signature) {
    return false;
  }
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
  if (issuedAt > Math.floor(Date.now() / 1000) + 60) return false;
  if (expiresAt - issuedAt > SESSION_DURATION_SECONDS + 60) return false;

  const secret = getSessionSecret();
  if (!secret) return false;
  const payload = `${expiresAtRaw}.${issuedAtRaw}.${nonce}`;
  const expected = await hmacHex(payload, secret);
  return timingSafeEqualString(expected, signature);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminSessionToken(store.get(ADMIN_COOKIE)?.value);
}

const RESET_TTL_SECONDS = 30 * 60; // 30 min

/** True when email matches the env admin or an existing backoffice_users row. */
export async function isKnownAdminEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const envCreds = getAdminCredentials();
  if (envCreds && timingSafeEqualString(normalized, envCreds.email.toLowerCase())) {
    return true;
  }

  if (!resolveDatabaseUrl()) return false;
  try {
    const { rows } = await neonQuery<{ email: string }>(
      `SELECT email::text AS email
       FROM backoffice_users
       WHERE lower(trim(email)) = $1
       LIMIT 1`,
      [normalized],
    );
    return Boolean(rows[0]?.email);
  } catch {
    return false;
  }
}

export async function createPasswordResetToken(email: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("Admin sessions are not configured.");
  const expiresAt = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS;
  const nonce = crypto.randomUUID();
  const normalized = email.trim().toLowerCase();
  const payload = `${expiresAt}.${encodeURIComponent(normalized)}.${nonce}`;
  const signature = await hmacHex(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifyPasswordResetToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [expiresAtRaw, emailEncoded, nonce, signature] = parts;
  const expiresAt = Number.parseInt(expiresAtRaw ?? "", 10);
  if (!Number.isFinite(expiresAt) || !emailEncoded || !nonce || !signature) return null;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const secret = getSessionSecret();
  if (!secret) return null;
  const payload = `${expiresAtRaw}.${emailEncoded}.${nonce}`;
  const expected = await hmacHex(payload, secret);
  if (!timingSafeEqualString(expected, signature)) return null;

  try {
    const email = decodeURIComponent(emailEncoded).trim().toLowerCase();
    if (!email || !email.includes("@")) return null;
    return email;
  } catch {
    return null;
  }
}

/** Ensures the admin table exists, then upserts a hashed password (no plaintext). */
export async function upsertAdminPassword(email: string, password: string): Promise<void> {
  if (!resolveDatabaseUrl()) {
    throw new Error("DATABASE_URL is missing; cannot store a new password.");
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashAdminPassword(password);

  await neonQuery(
    `CREATE TABLE IF NOT EXISTS backoffice_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
  );
  await neonQuery(
    `CREATE INDEX IF NOT EXISTS backoffice_users_email_lower_idx
     ON backoffice_users (lower(trim(email)))`,
  );
  await neonQuery(
    `INSERT INTO backoffice_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           updated_at = now()`,
    [normalized, passwordHash],
  );
}
