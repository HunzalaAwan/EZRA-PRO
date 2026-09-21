/* ==========================================================================
   The hotel search — dates and guests a visitor typed once, remembered
   across the rooms grid, the room page and checkout.
   ========================================================================== */

export interface StaySearch {
  checkIn: string
  checkOut: string
  adults: number
  children: number
}

export const STAY_SEARCH_EVENT = 'ezra:stay-search'

export function staySearchKey(slug: string) {
  return `ezra:stay-search:${slug}`
}

function shift(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function defaultStaySearch(todayKey: string): StaySearch {
  return { checkIn: shift(todayKey, 3), checkOut: shift(todayKey, 5), adults: 2, children: 0 }
}

export function readStaySearchRaw(slug: string): string {
  try {
    return window.localStorage.getItem(staySearchKey(slug)) ?? ''
  } catch {
    return ''
  }
}

export function parseStaySearch(raw: string, todayKey: string): StaySearch {
  const fallback = defaultStaySearch(todayKey)
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as Partial<StaySearch>
    const checkIn = typeof parsed.checkIn === 'string' && parsed.checkIn >= todayKey ? parsed.checkIn : fallback.checkIn
    const checkOut = typeof parsed.checkOut === 'string' && parsed.checkOut > checkIn ? parsed.checkOut : shift(checkIn, 2)
    return {
      checkIn,
      checkOut,
      adults: typeof parsed.adults === 'number' && parsed.adults >= 1 ? Math.min(4, parsed.adults) : fallback.adults,
      children: typeof parsed.children === 'number' && parsed.children >= 0 ? Math.min(3, parsed.children) : fallback.children,
    }
  } catch {
    return fallback
  }
}

export function writeStaySearch(slug: string, search: StaySearch) {
  try {
    window.localStorage.setItem(staySearchKey(slug), JSON.stringify(search))
  } catch {
    /* blocked storage */
  }
  window.dispatchEvent(new Event(STAY_SEARCH_EVENT))
}

export function staySearchQuery(search: StaySearch) {
  return `in=${search.checkIn}&out=${search.checkOut}&adults=${search.adults}&children=${search.children}`
}
