// Business-time arithmetic in an IANA timezone. Pure functions (no DB), unit tested.

export type BusinessCalendar = {
  timezone: string;
  /** dayOfWeek 0=Sunday..6=Saturday; minutes from local midnight. Empty = 24x7. */
  periods: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  /** Local dates "YYYY-MM-DD"; recurring holidays match month-day every year. */
  holidays: { date: string; recurring: boolean }[];
};

export const ALWAYS_OPEN: BusinessCalendar = { timezone: "UTC", periods: [], holidays: [] };

type LocalDay = { y: number; m: number; d: number };
const MAX_DAYS = 800;

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    partsCache.set(tz, f);
  }
  return f;
}

function localParts(date: Date, tz: string) {
  const p = Object.fromEntries(formatter(tz).formatToParts(date).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** Offset (ms) of tz from UTC at the given instant. */
function offsetAt(date: Date, tz: string) {
  const p = localParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant for a local wall-clock time (minute of day may be 1440 = next midnight). */
export function zonedTime(day: LocalDay, minuteOfDay: number, tz: string) {
  const naive = Date.UTC(day.y, day.m - 1, day.d, 0, minuteOfDay);
  let guess = naive - offsetAt(new Date(naive), tz);
  guess = naive - offsetAt(new Date(guess), tz);
  return new Date(guess);
}

const localDay = (date: Date, tz: string): LocalDay => { const p = localParts(date, tz); return { y: p.y, m: p.m, d: p.d }; };
const nextDay = (day: LocalDay): LocalDay => { const t = new Date(Date.UTC(day.y, day.m - 1, day.d + 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const dayOfWeek = (day: LocalDay) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
const pad = (n: number) => String(n).padStart(2, "0");

function isHoliday(day: LocalDay, cal: BusinessCalendar) {
  const iso = `${day.y}-${pad(day.m)}-${pad(day.d)}`;
  const md = iso.slice(5);
  return cal.holidays.some(h => (h.recurring ? h.date.slice(5) === md : h.date === iso));
}

/** Working windows (UTC) for a local day, sorted. */
function windows(day: LocalDay, cal: BusinessCalendar): [number, number][] {
  if (isHoliday(day, cal)) return [];
  if (!cal.periods.length) return [[zonedTime(day, 0, cal.timezone).getTime(), zonedTime(day, 1440, cal.timezone).getTime()]];
  const dow = dayOfWeek(day);
  return cal.periods
    .filter(p => p.dayOfWeek === dow && p.endMinute > p.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute)
    .map(p => [zonedTime(day, p.startMinute, cal.timezone).getTime(), zonedTime(day, p.endMinute, cal.timezone).getTime()]);
}

/** Instant reached after `minutes` of business time starting at `start`. */
export function addBusinessMinutes(start: Date, minutes: number, cal: BusinessCalendar): Date {
  let remaining = Math.max(0, minutes) * 60_000;
  let cursor = start.getTime();
  let day = localDay(start, cal.timezone);
  for (let i = 0; i < MAX_DAYS; i++) {
    for (const [ws, we] of windows(day, cal)) {
      if (cursor >= we) continue;
      const from = Math.max(cursor, ws);
      if (remaining <= we - from) return new Date(from + remaining);
      remaining -= we - from;
      cursor = we;
    }
    day = nextDay(day);
  }
  throw new Error("Business calendar has no working time; check business hours configuration");
}

/** Business minutes elapsed between two instants (0 if end <= start). */
export function businessMinutesBetween(start: Date, end: Date, cal: BusinessCalendar): number {
  if (end <= start) return 0;
  let total = 0;
  let day = localDay(start, cal.timezone);
  const s = start.getTime();
  const e = end.getTime();
  for (let i = 0; i < MAX_DAYS; i++) {
    const dayStart = zonedTime(day, 0, cal.timezone).getTime();
    if (dayStart >= e) break;
    for (const [ws, we] of windows(day, cal)) {
      const from = Math.max(ws, s);
      const to = Math.min(we, e);
      if (to > from) total += to - from;
    }
    day = nextDay(day);
  }
  return Math.round(total / 60_000);
}
