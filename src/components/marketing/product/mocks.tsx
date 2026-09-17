'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, FileCheck2, Globe, Mail, Phone, RefreshCw, Star, Tag, Utensils } from 'lucide-react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Product graphics that only the product pages need. Each is a still of the
   product built from real markup, with one small thing moving so it reads
   as software rather than a picture. Timer-driven, so server and client
   agree on the first frame.
   ========================================================================== */

/* --------------------------------------------------------------------------
   GuestProfileMock — one guest, everything the desk knows about them.
   -------------------------------------------------------------------------- */

const TRIPS = [
  { when: 'Sat 12 Sep', what: 'Sunrise paddle · 2 seats', status: 'Booked' },
  { when: 'Jun 2025', what: 'Reef snorkel · 4 seats', status: 'Went' },
  { when: 'Aug 2024', what: 'Sunset sail · 2 seats', status: 'Went' },
]

export function GuestProfileMock({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="A guest profile in EZRA: Ana Ferreira, three trips since 2024, a vegetarian note, a signed waiver, a five-star review, tagged as a repeat guest."
      className={cn('w-full max-w-[24rem] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]', className)}
    >
      <div aria-hidden="true">
        <div className="flex items-center gap-3 border-b border-line-subtle p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-[0.9375rem] font-semibold text-on-primary">AF</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.9375rem] font-medium text-foreground">Ana Ferreira</p>
            <p className="flex items-center gap-2 text-[0.75rem] text-subtle">
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> ana@…
              </span>
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> +351 …
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[0.6875rem] font-medium text-success">
            <Tag className="size-3" /> Repeat
          </span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line-subtle border-b border-line-subtle text-center">
          {[
            ['3', 'trips'],
            ['$1,246', 'lifetime'],
            ['5.0', 'rating'],
          ].map(([value, label]) => (
            <div key={label} className="py-3">
              <p className="text-[1rem] font-semibold text-foreground tabular-nums">{value}</p>
              <p className="text-[0.6875rem] text-subtle">{label}</p>
            </div>
          ))}
        </div>

        <ul className="flex flex-col divide-y divide-line-subtle px-4">
          {TRIPS.map((trip) => (
            <li key={trip.when} className="flex items-center justify-between gap-3 py-2.5 text-[0.8125rem]">
              <span className="min-w-0">
                <span className="block truncate text-foreground">{trip.what}</span>
                <span className="block text-[0.6875rem] text-subtle">{trip.when}</span>
              </span>
              <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium', trip.status === 'Booked' ? 'bg-primary/10 text-primary' : 'bg-surface-sunken text-muted')}>
                {trip.status}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 border-t border-line-subtle p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[0.75rem] font-medium text-warning">
            <Utensils className="size-3" /> Vegetarian
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[0.75rem] font-medium text-success">
            <FileCheck2 className="size-3" /> Waiver signed
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-[0.75rem] font-medium text-foreground">
            <Star className="size-3 fill-current text-warning" /> Left a review
          </span>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   SegmentsMock — the lists a campaign goes to, and one going out.
   -------------------------------------------------------------------------- */

const SEGMENTS = [
  { name: 'Came once, not since spring', count: 412, tone: 'bg-cal-peach' },
  { name: 'Three trips or more', count: 96, tone: 'bg-cal-lime' },
  { name: 'Booked, waiver missing', count: 14, tone: 'bg-cal-sky' },
  { name: 'Left a 5-star review', count: 233, tone: 'bg-cal-iris' },
]

export function SegmentsMock({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const [sent, setSent] = React.useState(0)
  React.useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setSent((n) => (n >= 412 ? 0 : Math.min(412, n + 37))), 260)
    return () => window.clearInterval(id)
  }, [reduce])

  return (
    <div
      role="img"
      aria-label="Four guest segments in EZRA, with a win-back email going out to the 412 guests who came once and not since spring."
      className={cn('w-full max-w-[24rem] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]', className)}
    >
      <div aria-hidden="true">
        <div className="border-b border-line-subtle px-4 py-3">
          <p className="text-[0.8125rem] font-medium text-foreground">Segments</p>
          <p className="text-[0.6875rem] text-subtle">Built from trips, reviews and waivers</p>
        </div>
        <ul className="flex flex-col divide-y divide-line-subtle">
          {SEGMENTS.map((segment) => (
            <li key={segment.name} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn('size-2.5 shrink-0 rounded-full', segment.tone)} />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{segment.name}</span>
              <span className="text-[0.8125rem] font-medium text-foreground tabular-nums">{segment.count}</span>
            </li>
          ))}
        </ul>
        <div className="m-3 rounded-xl bg-surface-sunken p-3">
          <div className="flex items-center justify-between text-[0.75rem]">
            <span className="font-medium text-foreground">Win-back · 15% off a return</span>
            <span className="text-subtle tabular-nums">{reduce ? 412 : sent} / 412</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
            <motion.div animate={{ width: `${((reduce ? 412 : sent) / 412) * 100}%` }} transition={{ duration: 0.25, ease: 'linear' }} className="h-full rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   ChannelSyncMock — one basket of seats, every channel drawing from it.
   -------------------------------------------------------------------------- */

const CHANNELS = [
  { name: 'Your website', icon: Globe, share: 0.46 },
  { name: 'Viator', icon: Globe, share: 0.22 },
  { name: 'GetYourGuide', icon: Globe, share: 0.17 },
  { name: 'Expedia', icon: Globe, share: 0.09 },
  { name: 'Phone & walk-up', icon: Phone, share: 0.06 },
]

const CAPACITY = 49
const SALES = [
  { seats: 2, via: 'Viator' },
  { seats: 1, via: 'Your website' },
  { seats: 4, via: 'GetYourGuide' },
  { seats: 2, via: 'Your website' },
  { seats: 3, via: 'Phone & walk-up' },
]

export function ChannelSyncMock({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const [step, setStep] = React.useState(0)
  React.useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setStep((s) => (s + 1) % (SALES.length + 2)), 1700)
    return () => window.clearInterval(id)
  }, [reduce])

  const soldNow = SALES.slice(0, Math.min(step, SALES.length)).reduce((sum, s) => sum + s.seats, 0)
  const booked = Math.min(CAPACITY, 24 + (reduce ? 8 : soldNow))
  const latest = step > 0 && step <= SALES.length ? SALES[step - 1] : null

  return (
    <div
      role="img"
      aria-label="The sunset sail's 49 seats shared across the website, Viator, GetYourGuide, Expedia and the phone; each sale on any channel updates the others in under a second."
      className={cn('w-full max-w-[24rem] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]', className)}
    >
      <div aria-hidden="true">
        <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
          <div>
            <p className="text-[0.8125rem] font-medium text-foreground">Sunset sail · tonight 17:45</p>
            <p className="text-[0.6875rem] text-subtle">One basket of seats, five channels</p>
          </div>
          <p className="text-right">
            <span className="block text-[1.125rem] font-semibold leading-none text-foreground tabular-nums">
              {booked}
              <span className="text-[0.75rem] font-normal text-subtle"> / {CAPACITY}</span>
            </span>
            <span className="text-[0.625rem] text-subtle">seats sold</span>
          </p>
        </div>

        <ul className="flex flex-col gap-2 px-4 py-3">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon
            const hot = latest?.via === channel.name
            return (
              <li key={channel.name} className="flex items-center gap-3 text-[0.8125rem]">
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg transition-colors duration-300', hot ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-muted')}>
                  <Icon className="size-3.5" />
                </span>
                <span className="w-28 shrink-0 truncate text-foreground">{channel.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span className="block h-full rounded-full bg-chart-1" style={{ width: `${channel.share * 100}%` }} />
                </span>
                <span className="w-9 text-right text-[0.75rem] text-subtle tabular-nums">{Math.round(channel.share * 100)}%</span>
              </li>
            )
          })}
        </ul>

        <div className="mx-3 mb-3 flex h-9 items-center gap-2 rounded-xl bg-surface-sunken px-3 text-[0.75rem]">
          <RefreshCw className={cn('size-3.5 shrink-0 text-primary', !reduce && latest && 'animate-spin')} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={latest ? `${step}` : 'idle'}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              className="truncate text-foreground"
            >
              {latest ? `${latest.seats} sold on ${latest.via} · every channel updated in 0.4s` : 'All channels in sync'}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   ChannelMarginMock — what each channel really pays, after commission.
   -------------------------------------------------------------------------- */

const MARGINS = [
  { name: 'Your website', bookings: 184, commission: 4, net: 96 },
  { name: 'Viator', bookings: 88, commission: 25, net: 75 },
  { name: 'GetYourGuide', bookings: 67, commission: 23, net: 77 },
  { name: 'Expedia', bookings: 36, commission: 20, net: 80 },
]

export function ChannelMarginMock({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Bookings by channel this month with the commission each one takes: the website at 4 percent, Viator at 25, GetYourGuide at 23, Expedia at 20."
      className={cn('w-full max-w-[24rem] overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]', className)}
    >
      <div aria-hidden="true">
        <div className="border-b border-line-subtle px-4 py-3">
          <p className="text-[0.8125rem] font-medium text-foreground">Net of commission · September</p>
          <p className="text-[0.6875rem] text-subtle">What each channel keeps for you</p>
        </div>
        <table className="w-full text-[0.8125rem]">
          <thead>
            <tr className="text-[0.625rem] tracking-[0.06em] text-subtle uppercase">
              <th className="px-4 py-2 text-left font-medium">Channel</th>
              <th className="py-2 text-right font-medium">Bookings</th>
              <th className="py-2 text-right font-medium">Fee</th>
              <th className="px-4 py-2 text-right font-medium">You keep</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {MARGINS.map((row) => (
              <tr key={row.name}>
                <td className="px-4 py-2.5 text-foreground">{row.name}</td>
                <td className="py-2.5 text-right text-muted tabular-nums">{row.bookings}</td>
                <td className="py-2.5 text-right text-muted tabular-nums">{row.commission}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <span className={cn('rounded-md px-1.5 py-0.5 font-medium', row.net >= 90 ? 'bg-success-soft text-success' : 'bg-surface-sunken text-foreground')}>{row.net}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="flex items-center gap-2 border-t border-line-subtle px-4 py-3 text-[0.75rem] text-muted">
          <Check className="size-3.5 text-success" strokeWidth={3} />
          Direct bookings up 38% since the widget went live
        </p>
      </div>
    </div>
  )
}
