/** Common product-spec labels (longest first so "FABRIC WEIGHT" wins over "FABRIC"). */
const SPEC_LABELS = [
  "FABRIC WEIGHT",
  "MADE IN",
  "MATERIAL",
  "MATERIALS",
  "COMPOSITION",
  "FABRIC",
  "WEIGHT",
  "SILHOUETTE",
  "FEATURES",
  "DETAILS",
  "OCCASION",
  "DESIGN",
  "COLOUR",
  "COLOR",
  "STYLE",
  "LENGTH",
  "ORIGIN",
  "CARE",
  "WASH",
  "FIT",
].sort((a, b) => b.length - a.length);

const LABEL_PATTERN = new RegExp(
  `(?:^|\\s)(${SPEC_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}):\\s*`,
  "gi",
);

const ACRONYMS = new Set(["gsm", "spf", "uv", "xl", "xxl", "os"]);

function titleCaseWord(word: string): string {
  if (word === "/") return word;
  if (/^\d+%?$/.test(word)) return word;
  if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => titleCaseWord(part))
      .join("-");
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatSpecLabel(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((w) => titleCaseWord(w))
    .join(" ");
}

function formatSpecValue(raw: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const words = value.split(" ");
  const shortPhrase = words.length <= 4 || /\//.test(value);
  if (shortPhrase) {
    return words.map((w) => titleCaseWord(w)).join(" ");
  }
  const lower = value.toLowerCase().replace(/\bgsm\b/g, "GSM");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatSpecLine(line: string): string {
  const match = line.match(/^([^:]+):\s*(.+)$/);
  if (!match) return line.trim();
  const label = formatSpecLabel(match[1]);
  const value = formatSpecValue(match[2]);
  return value ? `${label}: ${value}` : label;
}

function splitPackedSpecs(text: string): string[] | null {
  LABEL_PATTERN.lastIndex = 0;
  const matches = [...text.matchAll(LABEL_PATTERN)];
  if (matches.length < 2) return null;

  const lines: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = match[1]?.trim() ?? "";
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const value = text.slice(valueStart, valueEnd).trim();
    if (!label) continue;
    lines.push(formatSpecLine(`${label}: ${value}`));
  }
  return lines.length > 0 ? lines : null;
}

/**
 * Turns a packed "MATERIAL: … FABRIC WEIGHT: …" block (or newline specs)
 * into one readable line per field.
 */
export function productDescriptionLines(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/\r?\n/.test(trimmed)) {
    return trimmed
      .split(/\r?\n/)
      .map((line) => formatSpecLine(line.trim()))
      .filter(Boolean);
  }

  return splitPackedSpecs(trimmed) ?? [trimmed];
}
