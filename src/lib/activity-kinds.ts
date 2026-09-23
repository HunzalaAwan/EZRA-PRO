import type { Activity, ActivityFormat, ActivityKind } from '@/types'
import { formatDuration } from '@/lib/utils'

/* ==========================================================================
   Activity kinds — what an operator is selling. One niche (Tours &
   Activities) covers boats, tours, adventure and island operators; the kind
   decides the setup fields, the storefront widget and the day-of tools.
   Browser-safe: icons are lucide export names resolved by the caller.
   ========================================================================== */

export interface ActivityKindMeta {
  label: string
  /** Short chip text. */
  short: string
  /** One line for the wizard's picker. */
  hint: string
  examples: string
  icon: 'Route' | 'Anchor' | 'KeyRound' | 'GraduationCap' | 'Ticket'
  /** What a single bookable instance is called. */
  unit: string
  units: string
  /** How the storefront sells it. */
  booksBy: string
  /** The schedule format a new activity of this kind starts with. */
  defaultFormat: ActivityFormat
}

export const ACTIVITY_KINDS: ActivityKind[] = ['trip', 'charter', 'rental', 'lesson', 'pass']

export const ACTIVITY_KIND_META: Record<ActivityKind, ActivityKindMeta> = {
  trip: {
    label: 'Scheduled trip',
    short: 'Trip',
    hint: 'Seats on a departure at set times.',
    examples: 'Snorkel trips, city tours, zipline runs, whale watching',
    icon: 'Route',
    unit: 'departure',
    units: 'departures',
    booksBy: 'Seats per departure',
    defaultFormat: 'departures',
  },
  charter: {
    label: 'Private charter',
    short: 'Charter',
    hint: 'The whole boat, vehicle or guide for one group.',
    examples: 'Fishing charters, private tours, yacht hire, private guiding',
    icon: 'Anchor',
    unit: 'charter',
    units: 'charters',
    booksBy: 'One group per departure, priced per group',
    defaultFormat: 'departures',
  },
  rental: {
    label: 'Rental',
    short: 'Rental',
    hint: 'Units by the hour, half day or day.',
    examples: 'Jet skis, kayaks, SUPs, bikes, e-bikes, gear',
    icon: 'KeyRound',
    unit: 'start time',
    units: 'start times',
    booksBy: 'Units for a chosen length of time',
    defaultFormat: 'open',
  },
  lesson: {
    label: 'Lesson or course',
    short: 'Lesson',
    hint: 'Coached sessions with a level and a student ratio.',
    examples: 'Surf lessons, dive courses, climbing, kitesurf, ski school',
    icon: 'GraduationCap',
    unit: 'class',
    units: 'classes',
    booksBy: 'Places in a class or course',
    defaultFormat: 'departures',
  },
  pass: {
    label: 'Pass or admission',
    short: 'Pass',
    hint: 'Entry for the day, no set start time.',
    examples: 'Park entry, beach club, aqua park, attraction tickets',
    icon: 'Ticket',
    unit: 'day',
    units: 'days',
    booksBy: 'Tickets for a day',
    defaultFormat: 'open',
  },
}

export const LESSON_LEVELS = [
  { value: 'all', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const

export const RENTAL_LENGTHS = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '90 minutes' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: 'Half day (4 hours)' },
  { minutes: 480, label: 'Full day (8 hours)' },
] as const

export function rentalLengthLabel(minutes: number): string {
  return RENTAL_LENGTHS.find((option) => option.minutes === minutes)?.label ?? `${minutes} minutes`
}

export function kindOf(activity: { kind?: ActivityKind }): ActivityKind {
  return activity.kind ?? 'trip'
}

/** The chip on a storefront card: what it is at a glance. */
export function kindChipLabel(activity: Pick<Activity, 'kind' | 'durationMinutes' | 'maxCapacity' | 'rental' | 'charter' | 'lesson' | 'pass'>): string {
  switch (activity.kind ?? 'trip') {
    case 'rental': {
      const shortest = Math.min(...(activity.rental?.durations.map((entry) => entry.minutes) ?? [activity.durationMinutes]))
      return `Rental · from ${formatDuration(shortest)}`
    }
    case 'charter':
      return `Private · up to ${activity.charter?.maxGuests ?? activity.maxCapacity}`
    case 'lesson': {
      const sessions = activity.lesson?.sessions ?? 1
      return sessions > 1 ? `${sessions}-day course` : `Lesson · ${formatDuration(activity.durationMinutes)}`
    }
    case 'pass': {
      const days = activity.pass?.validDays ?? 1
      return days > 1 ? `${days}-day pass` : 'Day pass'
    }
    default:
      return formatDuration(activity.durationMinutes)
  }
}
