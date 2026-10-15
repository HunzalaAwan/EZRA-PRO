import type { Activity, BookingSettings, RequestReason } from '@/types'

/* ==========================================================================
   How guests book — one place that resolves an activity's booking settings,
   with sensible defaults for older activities (a charter set to request to
   book, an activity that accepted custom quotes). Browser-safe.
   ========================================================================== */

export const DEFAULT_BOOKING: BookingSettings = {
  method: 'instant',
  scheduled: true,
  groupLimit: 0,
  otherDates: false,
  customQuote: false,
  phone: '',
  callHours: '',
  replyHours: 24,
}

export function bookingOf(activity: Pick<Activity, 'booking' | 'charter' | 'customRequests'>): BookingSettings {
  const saved = activity.booking ?? {}
  // Older saves may say 'call': that is a request with a phone number shown.
  const savedMethod = saved.method as string | undefined
  const method: BookingSettings['method'] = savedMethod === 'call' ? 'request' : (saved.method ?? (activity.charter?.requestToBook ? 'request' : 'instant'))
  return {
    ...DEFAULT_BOOKING,
    ...saved,
    method,
    // Instant booking always runs on a schedule.
    scheduled: method === 'instant' ? true : (saved.scheduled ?? true),
    customQuote: saved.customQuote ?? Boolean(activity.customRequests),
  }
}

/** True when the storefront shows the date and time picker. */
export const showsSchedule = (settings: BookingSettings) => settings.scheduled

export const METHOD_LABEL: Record<BookingSettings['method'], string> = {
  instant: 'Book online',
  request: 'Request to book',
}

export const REASON_LABEL: Record<RequestReason, string> = {
  booking: 'Request to book',
  group: 'Big group',
  date: 'Another date',
  sooner: 'Sooner than notice',
  quote: 'Custom quote',
  message: 'Message',
}

export const TIME_WINDOWS = ['Any time', 'Morning', 'Midday', 'Afternoon', 'Evening'] as const
