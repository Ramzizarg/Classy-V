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

export const PHONE_ERROR = `Enter a valid phone number (${PHONE_MIN_DIGITS} to ${PHONE_MAX_DIGITS} digits).`;
