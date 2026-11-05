/**
 * Age banding.
 *
 * The band is measured from THEIR last contact, not ours. A record we have
 * chased five times this week is not fresh; a record that answered us an hour
 * ago is, however old the file is. Getting this backwards makes the busiest
 * rows look coldest.
 */

/** Default thresholds, in days. Supply your own — these are a convention, not a rule. */
export const DEFAULT_BANDS = [
  { name: "fresh", maxDays: 14 },
  { name: "aging", maxDays: 30 },
  { name: "stale", maxDays: 90 },
  { name: "cold", maxDays: Infinity },
];

const MS_PER_DAY = 86_400_000;

/**
 * The instant a record was last touched by the other party.
 * Falls back to creation. Returns null when neither is usable, which is a
 * real state and not an error — see `band`.
 */
export function ageAt(record, { inboundKey = "lastInboundAt", createdKey = "createdAt" } = {}) {
  const raw = record?.[inboundKey] ?? record?.[createdKey] ?? null;
  if (raw == null) return null;
  const t = raw instanceof Date ? raw.getTime() : Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** Whole days elapsed, or null when there is no usable date. */
export function ageInDays(record, now, options = {}) {
  const t = ageAt(record, options);
  if (t == null) return null;
  return Math.max(0, (asTime(now) - t) / MS_PER_DAY);
}

/**
 * Band a record.
 *
 * A record with no usable date bands as the LAST band rather than the first.
 * Unknown age is not newness, and defaulting it to "fresh" quietly buries
 * the records nobody has looked at.
 */
export function band(record, now, { bands = DEFAULT_BANDS, ...options } = {}) {
  const days = ageInDays(record, now, options);
  if (days == null) return bands[bands.length - 1].name;
  for (const b of bands) if (days < b.maxDays) return b.name;
  return bands[bands.length - 1].name;
}

/**
 * A clock label. Under `hoursUntilDays` it reads in hours, then in days.
 * Negative input is rendered by magnitude — the caller decides whether that
 * means "ago" or "from now", because only the caller knows.
 */
export function clockLabel(hours, { hoursUntilDays = 48 } = {}) {
  const a = Math.abs(Number(hours) || 0);
  return a < hoursUntilDays ? `${Math.round(a)}h` : `${Math.round(a / 24)}d`;
}

function asTime(now) {
  if (now == null) return Date.now();
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number") return now;
  const t = Date.parse(now);
  if (!Number.isFinite(t)) throw new TypeError(`unusable "now": ${String(now)}`);
  return t;
}
