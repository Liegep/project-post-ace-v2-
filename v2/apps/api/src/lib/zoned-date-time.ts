export const LEGACY_APP_TIME_ZONE = "America/Sao_Paulo";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseWallClock(value: Date | string): DateTimeParts | null {
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
}

function partsAt(instant: Date, timeZone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second") };
}

function partsAsUtc(parts: DateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function validTimeZone(value: string | null | undefined, fallback = LEGACY_APP_TIME_ZONE) {
  const candidate = value?.trim() || fallback;
  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return fallback;
  }
}

/** Converts a timezone-less wall clock plus its IANA zone into one unambiguous instant. */
export function zonedWallClockToIso(value: Date | string | null | undefined, timeZone?: string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
  }
  const desired = parseWallClock(value);
  if (!desired) return null;
  const zone = validTimeZone(timeZone);
  const desiredEpoch = partsAsUtc(desired);
  let guess = desiredEpoch;
  // Two passes account for offset changes around daylight-saving boundaries.
  for (let pass = 0; pass < 3; pass += 1) {
    const observed = partsAt(new Date(guess), zone);
    const correction = desiredEpoch - partsAsUtc(observed);
    if (correction === 0) break;
    guess += correction;
  }
  return new Date(guess).toISOString();
}

export function instantToWallClock(value: Date | string, timeZone?: string | null) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return "";
  const parts = partsAt(instant, validTimeZone(timeZone));
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}
