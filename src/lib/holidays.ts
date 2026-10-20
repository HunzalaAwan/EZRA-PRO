/* ==========================================================================
   Public holidays — the days a business may close, by country, for any
   year. Fixed dates and the ones worked out each year (Easter, "the
   fourth Thursday of November"). The holiday itself, not the weekday it
   moves to when it falls on a weekend. Browser- and server-safe.
   ========================================================================== */

export interface Holiday {
  /** "YYYY-MM-DD". */
  dateKey: string
  /** Plain name: "Thanksgiving", "Christmas Day". */
  name: string
}

/** The countries with a holiday list, for pickers. */
export const HOLIDAY_COUNTRIES: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
]

const ALIASES: Record<string, string> = {
  US: 'US', USA: 'US', 'UNITED STATES': 'US', 'UNITED STATES OF AMERICA': 'US',
  CA: 'CA', CANADA: 'CA',
  GB: 'GB', UK: 'GB', 'UNITED KINGDOM': 'GB', 'GREAT BRITAIN': 'GB', ENGLAND: 'GB',
  AU: 'AU', AUSTRALIA: 'AU',
  NZ: 'NZ', 'NEW ZEALAND': 'NZ',
  IE: 'IE', IRELAND: 'IE',
  PT: 'PT', PORTUGAL: 'PT',
  GR: 'GR', GREECE: 'GR',
}

/** A country code ("US") from a code or a name ("United States"); undefined when there is no list for it. */
export function holidayCountryOf(codeOrName: string | undefined | null): string | undefined {
  if (!codeOrName) return undefined
  return ALIASES[codeOrName.trim().toUpperCase()]
}

/* ---------- date helpers (local calendar, no time zones) ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
const key = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`
/** Day of the week, 0 = Sunday. */
const weekday = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).getDay()
const daysIn = (year: number, month: number) => new Date(year, month, 0, 12).getDate()

/** The nth weekday of a month (n = 1 first, 2 second …). */
function nth(year: number, month: number, dow: number, n: number): string {
  const first = weekday(year, month, 1)
  const day = 1 + ((dow - first + 7) % 7) + (n - 1) * 7
  return key(year, month, day)
}

/** The last weekday of a month. */
function last(year: number, month: number, dow: number): string {
  const end = daysIn(year, month)
  const day = end - ((weekday(year, month, end) - dow + 7) % 7)
  return key(year, month, day)
}

/** A day key moved by some days. */
function shift(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d + days, 12)
  return key(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Easter Sunday (Western), anonymous Gregorian algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return key(year, month, day)
}

/** Orthodox Easter Sunday (Julian computus, shown on the Gregorian calendar). */
export function orthodoxEaster(year: number): string {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31)
  const day = ((d + e + 114) % 31) + 1
  // Julian to Gregorian: 13 days between 1900 and 2099.
  const offset = Math.floor(year / 100) - Math.floor(year / 400) - 2
  return shift(key(year, month, day), offset)
}

/** Matariki (New Zealand) moves each year; these are the dates set in law. */
const MATARIKI: Record<number, string> = {
  2022: '06-24',
  2023: '07-14',
  2024: '06-28',
  2025: '06-20',
  2026: '07-10',
  2027: '06-25',
  2028: '07-14',
  2029: '07-06',
  2030: '06-21',
}

/* ---------- each country's list ---------- */

type Builder = (year: number) => [string, string][]

const COUNTRY: Record<string, Builder> = {
  US: (y) => [
    [key(y, 1, 1), 'New Year’s Day'],
    [nth(y, 1, 1, 3), 'Martin Luther King Jr. Day'],
    [nth(y, 2, 1, 3), 'Presidents’ Day'],
    [last(y, 5, 1), 'Memorial Day'],
    [key(y, 6, 19), 'Juneteenth'],
    [key(y, 7, 4), 'Independence Day'],
    [nth(y, 9, 1, 1), 'Labor Day'],
    [nth(y, 10, 1, 2), 'Columbus Day'],
    [key(y, 11, 11), 'Veterans Day'],
    [nth(y, 11, 4, 4), 'Thanksgiving'],
    [key(y, 12, 25), 'Christmas Day'],
  ],
  // Canada: the days observed in every province. Family Day, Victoria Day, the Civic Holiday, Thanksgiving,
  // Remembrance Day, Boxing Day and the rest are provincial and close the business through its own closed days.
  CA: (y) => {
    const easter = easterSunday(y)
    return [
      [key(y, 1, 1), 'New Year’s Day'],
      [shift(easter, -2), 'Good Friday'],
      [key(y, 7, 1), 'Canada Day'],
      [nth(y, 9, 1, 1), 'Labour Day'],
      [key(y, 12, 25), 'Christmas Day'],
    ]
  },
  GB: (y) => {
    const easter = easterSunday(y)
    return [
      [key(y, 1, 1), 'New Year’s Day'],
      [shift(easter, -2), 'Good Friday'],
      [shift(easter, 1), 'Easter Monday'],
      [nth(y, 5, 1, 1), 'Early May bank holiday'],
      [last(y, 5, 1), 'Spring bank holiday'],
      [last(y, 8, 1), 'Summer bank holiday'],
      [key(y, 12, 25), 'Christmas Day'],
      [key(y, 12, 26), 'Boxing Day'],
    ]
  },
  // Australia: the national days only. The King's Birthday, Labour Day and Easter Saturday move or differ by state
  // (Queensland keeps the King's Birthday in October), so they close the business through its own closed days.
  AU: (y) => {
    const easter = easterSunday(y)
    return [
      [key(y, 1, 1), 'New Year’s Day'],
      [key(y, 1, 26), 'Australia Day'],
      [shift(easter, -2), 'Good Friday'],
      [shift(easter, 1), 'Easter Monday'],
      [key(y, 4, 25), 'Anzac Day'],
      [key(y, 12, 25), 'Christmas Day'],
      [key(y, 12, 26), 'Boxing Day'],
    ]
  },
  NZ: (y) => {
    const easter = easterSunday(y)
    const list: [string, string][] = [
      [key(y, 1, 1), 'New Year’s Day'],
      [key(y, 1, 2), 'Day after New Year’s Day'],
      [key(y, 2, 6), 'Waitangi Day'],
      [shift(easter, -2), 'Good Friday'],
      [shift(easter, 1), 'Easter Monday'],
      [key(y, 4, 25), 'Anzac Day'],
      [nth(y, 6, 1, 1), 'King’s Birthday'],
      [nth(y, 10, 1, 4), 'Labour Day'],
      [key(y, 12, 25), 'Christmas Day'],
      [key(y, 12, 26), 'Boxing Day'],
    ]
    if (MATARIKI[y]) list.push([`${y}-${MATARIKI[y]}`, 'Matariki'])
    return list
  },
  IE: (y) => {
    const easter = easterSunday(y)
    // St Brigid's Day: the first Monday of February, or 1 February when that is a Friday.
    const brigid = weekday(y, 2, 1) === 5 ? key(y, 2, 1) : nth(y, 2, 1, 1)
    return [
      [key(y, 1, 1), 'New Year’s Day'],
      ...(y >= 2023 ? ([[brigid, 'St Brigid’s Day']] as [string, string][]) : []),
      [key(y, 3, 17), 'St Patrick’s Day'],
      [shift(easter, 1), 'Easter Monday'],
      [nth(y, 5, 1, 1), 'May bank holiday'],
      [nth(y, 6, 1, 1), 'June bank holiday'],
      [nth(y, 8, 1, 1), 'August bank holiday'],
      [last(y, 10, 1), 'October bank holiday'],
      [key(y, 12, 25), 'Christmas Day'],
      [key(y, 12, 26), 'St Stephen’s Day'],
    ]
  },
  PT: (y) => {
    const easter = easterSunday(y)
    return [
      [key(y, 1, 1), 'New Year’s Day'],
      [shift(easter, -2), 'Good Friday'],
      [easter, 'Easter Sunday'],
      [key(y, 4, 25), 'Freedom Day'],
      [key(y, 5, 1), 'Labour Day'],
      [shift(easter, 60), 'Corpus Christi'],
      [key(y, 6, 10), 'Portugal Day'],
      [key(y, 8, 15), 'Assumption Day'],
      [key(y, 10, 5), 'Republic Day'],
      [key(y, 11, 1), 'All Saints’ Day'],
      [key(y, 12, 1), 'Restoration of Independence'],
      [key(y, 12, 8), 'Immaculate Conception'],
      [key(y, 12, 25), 'Christmas Day'],
    ]
  },
  GR: (y) => {
    const easter = orthodoxEaster(y)
    return [
      [key(y, 1, 1), 'New Year’s Day'],
      [key(y, 1, 6), 'Epiphany'],
      [shift(easter, -48), 'Clean Monday'],
      [key(y, 3, 25), 'Independence Day'],
      [shift(easter, -2), 'Good Friday'],
      [easter, 'Easter Sunday'],
      [shift(easter, 1), 'Easter Monday'],
      [key(y, 5, 1), 'Labour Day'],
      [shift(easter, 50), 'Whit Monday'],
      [key(y, 8, 15), 'Assumption Day'],
      [key(y, 10, 28), 'Ohi Day'],
      [key(y, 12, 25), 'Christmas Day'],
      [key(y, 12, 26), 'Day after Christmas'],
    ]
  },
}

const cache = new Map<string, Holiday[]>()

/** A country's public holidays in a year, in date order. Unknown countries have none. */
export function holidaysFor(country: string, year: number): Holiday[] {
  const code = holidayCountryOf(country)
  if (!code || !Number.isFinite(year)) return []
  const id = `${code}:${year}`
  const hit = cache.get(id)
  // A copy, so a caller sorting or trimming its list never changes the next caller's.
  if (hit) return hit.slice()
  const seen = new Set<string>()
  const list = COUNTRY[code](Math.floor(year))
    .map(([dateKey, name]) => ({ dateKey, name }))
    .filter((holiday) => (seen.has(holiday.dateKey) ? false : (seen.add(holiday.dateKey), true)))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0))
  cache.set(id, list)
  return list.slice()
}

/** Every public holiday between two day keys (inclusive), keyed by day. */
export function holidaysBetween(country: string, fromKey: string, toKey: string): Map<string, string> {
  const out = new Map<string, string>()
  const fromYear = Number(fromKey.slice(0, 4))
  const toYear = Number(toKey.slice(0, 4))
  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear)) return out
  for (let year = fromYear; year <= toYear; year++) {
    for (const holiday of holidaysFor(country, year)) {
      if (holiday.dateKey >= fromKey && holiday.dateKey <= toKey && !out.has(holiday.dateKey)) out.set(holiday.dateKey, holiday.name)
    }
  }
  return out
}
