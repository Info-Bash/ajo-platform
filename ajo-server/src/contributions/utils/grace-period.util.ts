// The group's gracePeriodHours is meant literally for real DAILY/WEEKLY/
// MONTHLY groups. For TESTING-frequency groups (3-minute rounds, dev only)
// an hours-long grace period would defeat the point of fast iteration, so
// we override it to a short, fixed window instead.
const TESTING_GRACE_PERIOD_MS = 60 * 1000; // 1 minute
const HOUR_MS = 60 * 60 * 1000;

export function effectiveGracePeriodMs(group: { frequency: string; gracePeriodHours: number }): number {
  if (group.frequency === 'TESTING') return TESTING_GRACE_PERIOD_MS;
  return group.gracePeriodHours * HOUR_MS;
}
