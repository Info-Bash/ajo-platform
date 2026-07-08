// Maps a GroupFrequency to its round duration in milliseconds.
// TESTING exists solely so we can exercise the full contribution flow in
// minutes instead of days during development — see schema.prisma's
// GroupFrequency enum comment for how to remove it before launch.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const FREQUENCY_DURATIONS_MS: Record<string, number> = {
  DAILY: DAY,
  WEEKLY: 7 * DAY,
  MONTHLY: 30 * DAY,
  TESTING: 3 * MINUTE,
};

export function frequencyDurationMs(frequency: string): number {
  const ms = FREQUENCY_DURATIONS_MS[frequency];
  if (!ms) throw new Error(`Unknown frequency: ${frequency}`);
  return ms;
}

/** TESTING is only selectable outside production — enforced at the DTO/service boundary. */
export function isTestingFrequencyAllowed(nodeEnv: string): boolean {
  return nodeEnv !== 'production';
}
