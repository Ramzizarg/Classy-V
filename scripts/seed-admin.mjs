/**
 * Upsert an admin into backoffice_users with a PBKDF2 password hash.
 *
 * Usage (do not commit passwords):
 *   node --env-file=.env.local scripts/seed-admin.mjs --email you@example.com --password '...'
 */
import { neon } from "@neondatabase/serverless";

const PBKDF2_ITERATIONS = 210_000;
const encoder = new TextEncoder();

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return String(process.argv[idx + 1] ?? "").trim();
}

function toHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = toHex(salt);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  const hashHex = toHex(new Uint8Array(bits));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hashHex}`;
}

const url = process.env.DATABASE_URL?.trim();
const email = arg("--email") || process.env.ADMIN_SEED_EMAIL?.trim() || "";
const password = arg("--password") || process.env.ADMIN_SEED_PASSWORD || "";

if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}
if (!email || !password) {
  console.error("Provide --email and --password (or ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD).");
  process.exit(1);
}

const sql = neon(url);

await sql.query(`
  CREATE TABLE IF NOT EXISTS backoffice_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`);

await sql.query(`
  CREATE INDEX IF NOT EXISTS backoffice_users_email_lower_idx
    ON backoffice_users (lower(trim(email)))
`);

const passwordHash = await hashPassword(password);
const normalized = email.toLowerCase();

await sql.query(
  `INSERT INTO backoffice_users (email, password_hash)
   VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         updated_at = now()`,
  [normalized, passwordHash],
);

console.log(`Admin ready: ${normalized} (password hashed with PBKDF2, ${PBKDF2_ITERATIONS} iterations)`);
