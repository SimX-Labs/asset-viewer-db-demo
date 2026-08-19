/** Date, or date + time, in the ISO-8601 shapes the Unity/DBO exports emit. */
const ISO_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function isDateTimeString(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_TIME.test(value.trim());
}

/** `2026-02-11T19:37:55.123Z` -> `Feb 11, 2026, 2:37 PM` in local time. */
export function formatDateTime(value: string): string {
  const raw = value.trim();
  const match = ISO_DATE_TIME.exec(raw);
  if (!match) return value;

  const hasTime = match[4] !== undefined;
  // A bare date parses as UTC midnight, which can render as the previous day.
  const date = hasTime
    ? new Date(raw)
    : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value;

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  if (hasTime) {
    options.hour = 'numeric';
    options.minute = '2-digit';
  }
  return date.toLocaleString(undefined, options);
}
