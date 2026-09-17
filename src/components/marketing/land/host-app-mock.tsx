'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, MapPin, Signal, SignalZero, UserPlus } from 'lucide-react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   HostAppMock — the phone at the dock, checking a manifest in with no signal.

   A phone frame with the 06:40 departure's guest list. Every few seconds a
   guest is checked in; halfway through, the signal drops and the app keeps
   going with an "offline, will sync" note; then the bar comes back and the
   queue clears. Timer-driven, so the server and the first client frame agree.
   ========================================================================== */

const GUESTS = [
  { name: 'Ana & Tomás Ferreira', seats: 2, note: 'Pickup: Hotel Aurora' },
  { name: 'Priya Raman', seats: 1, note: 'Vegetarian' },
  { name: 'The Okafor family', seats: 4, note: 'Two under 12' },
  { name: 'Jonas Weber', seats: 1, note: 'Walk-up · paid at the dock' },
  { name: 'Mei Lin & Kai', seats: 2, note: 'Waiver signed 06:12' },
] as const

const TICK_MS = 1900

export function HostAppMock({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const [step, setStep] = React.useState(0)

  React.useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setStep((s) => (s + 1) % (GUESTS.length + 3)), TICK_MS)
    return () => window.clearInterval(id)
  }, [reduce])

  const checkedIn = reduce ? 3 : Math.min(step, GUESTS.length)
  const offline = !reduce && step >= 2 && step <= 3
  const total = GUESTS.reduce((sum, g) => sum + g.seats, 0)
  const seated = GUESTS.slice(0, checkedIn).reduce((sum, g) => sum + g.seats, 0)

  return (
    <div
      role="img"
      aria-label="The EZRA host app on a phone: the 06:40 sunrise paddle manifest with guests being checked in, including a walk-up, while the phone briefly has no signal."
      className={cn('mx-auto w-[17rem] sm:w-[18.5rem]', className)}
    >
      <div aria-hidden="true" className="rounded-[2.25rem] bg-foreground p-2 shadow-[var(--shadow-2xl)]">
        <div className="overflow-hidden rounded-[1.85rem] bg-surface">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-3 text-[0.625rem] font-semibold text-foreground">
            <span className="tabular-nums">06:31</span>
            <span className="h-4 w-16 rounded-full bg-foreground" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={offline ? 'off' : 'on'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn('inline-flex items-center gap-1', offline ? 'text-warning' : 'text-foreground')}
              >
                {offline ? <SignalZero className="size-3" /> : <Signal className="size-3" />}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* header */}
          <div className="px-4 pt-4 pb-3">
            <p className="text-[0.625rem] font-semibold tracking-[0.12em] text-subtle uppercase">Today · 06:40</p>
            <p className="mt-1 text-[1rem] leading-tight font-semibold text-foreground">Sunrise paddle</p>
            <p className="mt-1 flex items-center gap-1 text-[0.6875rem] text-muted">
              <MapPin className="size-3" />
              Pier 4 · Guide: Mara
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken px-3 py-2">
              <span className="text-[0.6875rem] text-muted">Checked in</span>
              <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">
                {seated} / {total} seats
              </span>
            </div>
          </div>

          {/* offline note */}
          <AnimatePresence initial={false}>
            {offline ? (
              <motion.div
                key="offline"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
                className="overflow-hidden"
              >
                <p className="mx-4 mb-2 rounded-lg bg-warning-soft px-3 py-1.5 text-[0.6875rem] font-medium text-warning">
                  No signal. Check-ins are saved and will sync.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* guests */}
          <ul className="flex flex-col gap-1.5 px-4 pb-4">
            {GUESTS.map((guest, i) => {
              const done = i < checkedIn
              return (
                <li key={guest.name} className="flex items-center gap-2.5 rounded-xl border border-line-subtle px-3 py-2">
                  <motion.span
                    animate={{ backgroundColor: done ? 'var(--color-success)' : 'var(--color-surface-sunken)' }}
                    transition={{ duration: 0.3 }}
                    className="grid size-6 shrink-0 place-items-center rounded-full"
                  >
                    <AnimatePresence initial={false}>
                      {done ? (
                        <motion.span
                          key="check"
                          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 26 }}
                        >
                          <Check className="size-3.5 text-white" strokeWidth={3} />
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </motion.span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[0.75rem] font-semibold', done ? 'text-foreground' : 'text-muted')}>{guest.name}</span>
                    <span className="block truncate text-[0.625rem] text-subtle">{guest.note}</span>
                  </span>
                  <span className="shrink-0 text-[0.6875rem] font-semibold text-subtle tabular-nums">×{guest.seats}</span>
                </li>
              )
            })}
          </ul>

          {/* walk-up */}
          <div className="px-4 pb-4">
            <span className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary text-[0.75rem] font-semibold text-on-primary">
              <UserPlus className="size-3.5" />
              Add a walk-up
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
