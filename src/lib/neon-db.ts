import { neon, neonConfig } from "@neondatabase/serverless";
import type { QueryResultRow } from "@neondatabase/serverless";
import { Agent, fetch as undiciFetch } from "undici";

/** Neon / Postgres URL: primary env + common alternates; strips wrapping quotes from `.env`. */
export function resolveDatabaseUrl(): string | null {
  const raw =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim();
  if (!raw) return null;
  let s = raw;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s || null;
}

/**
 * Some networks silently drop the first TCP handshake to Neon; the default 10s connect
 * timeout then fails the request. A short connect timeout plus retry recovers in ~3s.
 * Only connect-phase errors are retried: the request never reached the server, so
 * retrying an INSERT cannot create a duplicate.
 */
const CONNECT_TIMEOUT_MS = 2500;
const CONNECT_ATTEMPTS = 3;
const CONNECT_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

const dbAgent = new Agent({
  connect: { timeout: CONNECT_TIMEOUT_MS },
  keepAliveTimeout: 30_000,
});

function errorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.cause?.code ?? e?.code;
}

neonConfig.fetchFunction = async (input: string, init?: Record<string, unknown>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await undiciFetch(input, { ...init, dispatcher: dbAgent });
    } catch (err) {
      if (attempt >= CONNECT_ATTEMPTS || !CONNECT_ERROR_CODES.has(errorCode(err) ?? "")) throw err;
    }
  }
};

let cached: { url: string; sql: ReturnType<typeof neon> } | null = null;

function getSql() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  if (cached?.url !== connectionString) {
    cached = { url: connectionString, sql: neon(connectionString) };
  }
  return cached.sql;
}

export async function neonQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const sql = getSql();
  const result = await sql.query(text, params);
  const rows = Array.isArray(result)
    ? (result as T[])
    : Array.isArray((result as { rows?: T[] })?.rows)
      ? ((result as { rows: T[] }).rows as T[])
      : [];
  return { rows };
}
