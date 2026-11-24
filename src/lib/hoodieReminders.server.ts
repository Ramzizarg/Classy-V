import { neonQuery } from "@/lib/neon-db";
import { getResend } from "@/lib/resendClient";
import { SITE } from "@/lib/site";
import {
  formatDropWhen,
  hoodieScoreMark,
  isHoodieLeadMinutes,
  isHoodieSize,
  normalizeHoodieSize,
  type HoodieNoteIntent,
  type HoodieReminderAdminRow,
} from "@/lib/hoodieReminders";

export type { HoodieReminderAdminRow };

export type HoodieReminderInput = {
  email: string;
  productId: number;
  productSlug: string;
  productName: string;
  releaseAt: string;
  leadMinutes: number;
  size: string;
  note: string;
  score: number;
  intent: HoodieNoteIntent;
};

type ReminderRow = {
  id: number;
  email: string;
  product_slug: string;
  product_name: string;
  release_at: string | Date;
  remind_at: string | Date;
  lead_minutes: number;
  size: string | null;
  note: string | null;
  score: number | null;
  intent: string | null;
};

let tableReady: Promise<void> | null = null;

function ensureTable() {
  tableReady ??= neonQuery(`
    CREATE TABLE IF NOT EXISTS hoodie_drop_reminders (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL,
      product_id    INTEGER NOT NULL,
      product_slug  TEXT NOT NULL,
      product_name  TEXT NOT NULL,
      release_at    TIMESTAMPTZ NOT NULL,
      remind_at     TIMESTAMPTZ NOT NULL,
      lead_minutes  INTEGER NOT NULL,
      note          TEXT,
      sent_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
    .then(() => neonQuery(`ALTER TABLE hoodie_drop_reminders ADD COLUMN IF NOT EXISTS score SMALLINT`))
    .then(() => neonQuery(`ALTER TABLE hoodie_drop_reminders ADD COLUMN IF NOT EXISTS intent TEXT`))
    .then(() => neonQuery(`ALTER TABLE hoodie_drop_reminders ADD COLUMN IF NOT EXISTS size TEXT`))
    .then(() => neonQuery(`UPDATE hoodie_drop_reminders SET size = '' WHERE size IS NULL`))
    .then(() => neonQuery(`ALTER TABLE hoodie_drop_reminders ALTER COLUMN size SET DEFAULT ''`))
    .then(() => neonQuery(`DROP INDEX IF EXISTS hoodie_drop_reminders_unique`))
    .then(() =>
      neonQuery(`
        DELETE FROM hoodie_drop_reminders a
        USING hoodie_drop_reminders b
        WHERE a.id < b.id
          AND a.email = b.email
          AND a.product_id = b.product_id
          AND COALESCE(a.size, '') = COALESCE(b.size, '')
      `),
    )
    .then(() =>
      neonQuery(`
        CREATE UNIQUE INDEX IF NOT EXISTS hoodie_drop_reminders_unique_size
          ON hoodie_drop_reminders (email, product_id, size)
      `),
    )
    .then(() => undefined);
  return tableReady;
}

function toIso(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export async function saveHoodieReminder(input: HoodieReminderInput) {
  if (!isHoodieLeadMinutes(input.leadMinutes)) {
    throw new Error("Choose when you want the email.");
  }
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 10) {
    throw new Error("Choose a score from 0 to 10.");
  }
  if (input.intent !== "change" && input.intent !== "new") {
    throw new Error("Choose a note type.");
  }
  const size = normalizeHoodieSize(input.size);
  if (!isHoodieSize(size)) {
    throw new Error("Choose a size.");
  }
  const release = Date.parse(input.releaseAt);
  if (!Number.isFinite(release) || release <= Date.now()) {
    throw new Error("This hoodie drop has already started.");
  }
  const remindAt = new Date(release - input.leadMinutes * 60_000);
  await ensureTable();
  await neonQuery(
    `INSERT INTO hoodie_drop_reminders
       (email, product_id, product_slug, product_name, release_at, remind_at, lead_minutes, note, score, intent, size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (email, product_id, size)
     DO UPDATE SET
       product_slug = EXCLUDED.product_slug,
       product_name = EXCLUDED.product_name,
       release_at = EXCLUDED.release_at,
       remind_at = EXCLUDED.remind_at,
       lead_minutes = EXCLUDED.lead_minutes,
       note = EXCLUDED.note,
       score = EXCLUDED.score,
       intent = EXCLUDED.intent,
       sent_at = NULL
     WHERE hoodie_drop_reminders.sent_at IS NOT NULL
        OR hoodie_drop_reminders.note IS DISTINCT FROM EXCLUDED.note
        OR hoodie_drop_reminders.remind_at IS DISTINCT FROM EXCLUDED.remind_at
        OR hoodie_drop_reminders.lead_minutes IS DISTINCT FROM EXCLUDED.lead_minutes
        OR hoodie_drop_reminders.score IS DISTINCT FROM EXCLUDED.score
        OR hoodie_drop_reminders.intent IS DISTINCT FROM EXCLUDED.intent`,
    [
      input.email,
      input.productId,
      input.productSlug,
      input.productName,
      new Date(release).toISOString(),
      remindAt.toISOString(),
      input.leadMinutes,
      input.note || null,
      input.score,
      input.intent,
      size,
    ],
  );
  return remindAt.toISOString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leadPhrase(minutes: number) {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

async function sendReminder(row: ReminderRow) {
  const resend = getResend();
  if (!resend) return false;
  const releaseIso = toIso(row.release_at);
  const when = formatDropWhen(releaseIso);
  const href = `${SITE.url}/collection/${row.product_slug}`;
  const note = row.note?.trim() ?? "";
  const size = normalizeHoodieSize(row.size ?? "");
  const soon = leadPhrase(row.lead_minutes);
  const mark = hoodieScoreMark(row.score ?? 0);
  const ask = row.intent === "new" ? "New product like this" : "Change this hoodie";
  const from = process.env.RESEND_FROM_EMAIL?.trim() || `${SITE.name} <onboarding@resend.dev>`;
  const { error } = await resend.emails.send({
    from,
    to: row.email,
    subject: `${row.product_name} drops ${soon}`,
    text: [
      `${row.product_name} drops ${soon}.`,
      when ? `Drop time: ${when} (Tunisia).` : "",
      size ? `Your size: ${size}` : "",
      note ? `Your note (${ask}, ${mark.emoji} ${row.score ?? 0}/10): ${note}` : `${ask} · ${mark.emoji} ${row.score ?? 0}/10`,
      href,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: `<div style="background:#000;color:#fff;padding:32px 24px;font-family:Helvetica,Arial,sans-serif">
      <p style="margin:0 0 18px;letter-spacing:.22em;font-size:11px">${escapeHtml(SITE.name)}</p>
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700">${escapeHtml(row.product_name)}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">Drops ${escapeHtml(soon)}.${when ? ` ${escapeHtml(when)}.` : ""}</p>
      ${size ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.5">Size ${escapeHtml(size)}</p>` : ""}
      <p style="margin:0 0 18px;font-size:15px;line-height:1.5">${escapeHtml(mark.emoji)} ${row.score ?? 0}/10 · ${escapeHtml(ask)}</p>
      ${note ? `<p style="margin:0 0 18px;padding:12px 14px;border-left:2px solid #fff;font-size:14px;line-height:1.5">${escapeHtml(note)}</p>` : ""}
      <a href="${escapeHtml(href)}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;padding:12px 18px;font-size:12px;letter-spacing:.14em;text-transform:uppercase">Open the hoodie</a>
    </div>`,
  });
  return !error;
}

type AdminDbRow = {
  id: number;
  email: string;
  product_id: number;
  product_slug: string;
  product_name: string;
  release_at: string | Date;
  remind_at: string | Date;
  lead_minutes: number;
  size: string | null;
  note: string | null;
  score: number | null;
  intent: string | null;
  sent_at: string | Date | null;
  created_at: string | Date;
};

/** All notify-me reminders for the back office, newest first. */
export async function listHoodieReminders(): Promise<HoodieReminderAdminRow[]> {
  await ensureTable();
  const { rows } = await neonQuery<AdminDbRow>(
    `SELECT id, email, product_id, product_slug, product_name, release_at, remind_at,
            lead_minutes, size, note, score, intent, sent_at, created_at
     FROM hoodie_drop_reminders
     ORDER BY created_at DESC, id DESC
     LIMIT 2000`,
  );
  return (rows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    productId: Number(row.product_id),
    productSlug: row.product_slug,
    productName: row.product_name,
    releaseAt: toIso(row.release_at),
    remindAt: toIso(row.remind_at),
    leadMinutes: Number(row.lead_minutes),
    size: normalizeHoodieSize(row.size ?? ""),
    note: row.note,
    score: row.score == null ? null : Number(row.score),
    intent: row.intent === "change" || row.intent === "new" ? row.intent : null,
    sentAt: row.sent_at ? toIso(row.sent_at) : null,
    createdAt: toIso(row.created_at),
  }));
}

/** Send every hoodie reminder whose chosen time has arrived. */
export async function dispatchDueHoodieReminders() {
  await ensureTable();
  const { rows } = await neonQuery<ReminderRow>(
    `SELECT id, email, product_slug, product_name, release_at, remind_at, lead_minutes, size, note, score, intent
     FROM hoodie_drop_reminders
     WHERE sent_at IS NULL AND remind_at <= now()
     ORDER BY remind_at ASC
     LIMIT 20`,
  );
  let sent = 0;
  for (const row of rows) {
    const ok = await sendReminder(row);
    if (!ok) continue;
    await neonQuery(`UPDATE hoodie_drop_reminders SET sent_at = now() WHERE id = $1 AND sent_at IS NULL`, [
      row.id,
    ]);
    sent += 1;
  }
  return sent;
}
