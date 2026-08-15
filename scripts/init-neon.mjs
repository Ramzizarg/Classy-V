/**
 * Apply scripts/schema.sql against DATABASE_URL from .env.local / .env
 * Usage: node --env-file=.env.local scripts/init-neon.mjs
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.error("DATABASE_URL is missing. Create .env.local from .env.example.");
  process.exit(1);
}

const sql = neon(url);
const schemaPath = join(__dirname, "schema.sql");
const schema = await readFile(schemaPath, "utf8");

// Split on semicolons that end statements (simple split is fine for this file).
const statements = schema
  .split(";")
  .map((s) => s.replace(/--[^\n]*/g, "").trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
  console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " ") + "…");
}

console.log("Neon schema ready.");
