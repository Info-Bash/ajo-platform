/**
 * Normalizes a Nigerian phone number to E.164 format (+234XXXXXXXXXX).
 *
 * Handles all common formats:
 *   08137413868      → +2348137413868
 *   2348137413868    → +2348137413868
 *   +2348137413868   → +2348137413868
 *   0813 741 3868    → +2348137413868
 *
 * Returns null if the number cannot be normalized to a valid
 * Nigerian format (used for validation rejection).
 */
export function normalizeNigerianPhone(raw: string): string | null {
  // Strip all whitespace, dashes, dots, brackets
  const stripped = raw.replace(/[\s\-().]/g, '');

  let normalized: string;

  if (stripped.startsWith('+234')) {
    normalized = stripped;
  } else if (stripped.startsWith('234')) {
    normalized = `+${stripped}`;
  } else if (stripped.startsWith('0')) {
    normalized = `+234${stripped.slice(1)}`;
  } else {
    // Unknown format
    return null;
  }

  // Nigerian numbers: +234 followed by exactly 10 digits
  // Total length = 14 characters
  if (!/^\+234[0-9]{10}$/.test(normalized)) {
    return null;
  }

  return normalized;
}
