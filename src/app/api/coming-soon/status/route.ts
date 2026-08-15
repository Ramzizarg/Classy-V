import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import { createHmac, timingSafeEqual } from "crypto";
import { COMING_SOON_COOKIE } from "@/lib/comingSoonCookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCookieSecret() {
  return process.env.COMING_SOON_COOKIE_SECRET || "dev-cookie-secret";
}

function signToken(payloadB64: string) {
  return createHmac("sha256", getCookieSecret()).update(payloadB64, "utf8").digest("base64url");
}

/** Returns true when the visitor holds a valid, unexpired unlock cookie. */
function hasValidAccessCookie(token: string | undefined): boolean {
  if (!token || !token.includes(".")) return false;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return false;
  try {
    const expected = signToken(payloadB64);
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as { exp?: number };
    if (!payload?.exp || typeof payload.exp !== "number") return false;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function gateEndPassed(endAt: string | null): boolean {
  if (!endAt) return false;
  const end = Date.parse(endAt);
  return !Number.isNaN(end) && end <= Date.now();
}

const IDLE = {
  blocking: false,
  heroImageUrl: "",
  endAt: "",
  requirePassword: false,
  hasPassword: false,
};

export async function GET() {
  if (!resolveDatabaseUrl()) {
    return NextResponse.json(IDLE);
  }

  try {
    const { rows } = await neonQuery(
      "SELECT enabled, hero_image_url, end_at, require_password, password_hash FROM coming_soon_settings WHERE id = $1 LIMIT 1",
      ["default"]
    );
    const row = rows[0] as
      | {
          enabled: boolean;
          hero_image_url: string | null;
          end_at: string | null;
          require_password: boolean;
          password_hash: string | null;
        }
      | undefined;

    if (!row || !row.enabled || gateEndPassed(row.end_at ?? null)) {
      return NextResponse.json(IDLE);
    }

    const jar = await cookies();
    const unlocked = hasValidAccessCookie(jar.get(COMING_SOON_COOKIE)?.value);

    return NextResponse.json({
      blocking: !unlocked,
      heroImageUrl: String(row.hero_image_url ?? ""),
      endAt: String(row.end_at ?? ""),
      requirePassword: Boolean(row.require_password),
      hasPassword: Boolean(row.password_hash),
    });
  } catch {
    return NextResponse.json(IDLE);
  }
}
