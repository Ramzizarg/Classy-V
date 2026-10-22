export const PHONE_MIN_DIGITS = 6;
export const PHONE_MAX_DIGITS = 15;

/** Keep digits and a leading "+" so international numbers survive editing. */
export function normalizePhoneInput(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  const digits = trimmed.replace(/\D/g, "").slice(0, PHONE_MAX_DIGITS);
  return `${plus}${digits}`;
}

export function isValidPhone(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

/** `tel:` href for click-to-call. Local 8-digit Tunisian numbers become +216. */
export function telHref(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (hadPlus) return `tel:+${digits}`;
  if (digits.startsWith("216") && digits.length >= 11) return `tel:+${digits}`;
  if (digits.startsWith("00") && digits.length >= 12) return `tel:+${digits.slice(2)}`;
  if (digits.length === 8) return `tel:+216${digits}`;
  if (digits.startsWith("0") && digits.length === 9) return `tel:+216${digits.slice(1)}`;
  return `tel:${digits}`;
}

export const PHONE_ERROR = `Enter a valid phone number (${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits).`;
