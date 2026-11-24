/** How early a hoodie-drop email can go out. 10 minutes is the default. */
export const HOODIE_REMIND_LEADS = [
  { minutes: 10, label: "10 min", detail: "Before it drops" },
  { minutes: 60, label: "1 hour", detail: "Before" },
  { minutes: 1440, label: "1 day", detail: "Before" },
  { minutes: 0, label: "At drop", detail: "The minute it opens" },
] as const;

export type HoodieRemindLead = (typeof HOODIE_REMIND_LEADS)[number]["minutes"];

export const HOODIE_NOTE_MAX = 160;
export const HOODIE_LEAD_MAX = 7 * 24 * 60;
export const HOODIE_SIZE_MAX = 16;
/** Used when a coming-soon product has no size rows yet. */
export const HOODIE_FALLBACK_SIZES = ["S", "M", "L", "XL", "XXL"] as const;

export const HOODIE_SCORE_MARKS = [
  { score: 0, emoji: "😡", label: "Bad" },
  { score: 2, emoji: "🙁", label: "Weak" },
  { score: 4, emoji: "😐", label: "Ok" },
  { score: 6, emoji: "🙂", label: "Good" },
  { score: 8, emoji: "😍", label: "Love" },
  { score: 10, emoji: "🤩", label: "Super" },
] as const;

export type HoodieNoteIntent = "change" | "new";

/** Shape used by the back-office notify-me list (safe for client components). */
export type HoodieReminderAdminRow = {
  id: number;
  email: string;
  productId: number;
  productSlug: string;
  productName: string;
  releaseAt: string;
  remindAt: string;
  leadMinutes: number;
  size: string;
  note: string | null;
  score: number | null;
  intent: HoodieNoteIntent | null;
  sentAt: string | null;
  createdAt: string;
};

export function isHoodieLeadMinutes(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= HOODIE_LEAD_MAX;
}

export function normalizeHoodieSize(value: string): string {
  return value.trim().toUpperCase().slice(0, HOODIE_SIZE_MAX);
}

export function isHoodieSize(value: string): boolean {
  return /^[A-Z0-9][A-Z0-9 /-]{0,15}$/.test(normalizeHoodieSize(value));
}

export function hoodieScoreMark(score: number) {
  const step = Math.max(0, Math.min(10, Math.round(score / 2) * 2));
  return HOODIE_SCORE_MARKS.find((mark) => mark.score === step) ?? HOODIE_SCORE_MARKS[0];
}

export function hoodieRemindAt(releaseAtIso: string, leadMinutes: number): Date | null {
  const release = Date.parse(releaseAtIso);
  if (!Number.isFinite(release)) return null;
  return new Date(release - leadMinutes * 60_000);
}

export function formatDropWhen(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  return new Date(at).toLocaleString("en-GB", {
    timeZone: "Africa/Tunis",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
