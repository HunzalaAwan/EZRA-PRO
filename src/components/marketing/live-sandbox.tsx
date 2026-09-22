'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CapacityBar } from '@/components/ui/progress'
import { Reveal } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn, formatCurrency } from '@/lib/utils'

interface ChannelSyncEvent {
  id: string
  channel: 'Website' | 'Viator' | 'GetYourGuide' | 'Walk-In' | 'Phone'
  seats: number
  guestName: string
  timestamp: string
  reference: string
}

const INITIAL_EVENTS: ChannelSyncEvent[] = [
  {
    id: 'evt-1',
    channel: 'Website',
    seats: 2,
    guestName: 'Chloe Whitaker',
    timestamp: 'Just now',
    reference: 'EZ-84920',
  },
  {
    id: 'evt-2',
    channel: 'Viator',
    seats: 4,
    guestName: 'Lars Sorensen',
    timestamp: '2 mins ago',
    reference: 'VT-99104',
  },
  {
    id: 'evt-3',
    channel: 'GetYourGuide',
    seats: 2,
    guestName: 'Mateo Silva',
    timestamp: '5 mins ago',
    reference: 'GYG-4412',
  },
]

const SIMULATED_GUESTS = [
  { name: 'Sarah & Alex Jenkins', seats: 2, channel: 'Website' as const },
  { name: 'Marcus Brody (Group)', seats: 3, channel: 'Viator' as const },
  { name: 'Elena Rostova', seats: 1, channel: 'Walk-In' as const },
  { name: 'David & Kim Vance', seats: 2, channel: 'GetYourGuide' as const },
  { name: 'Oskar Lindqvist', seats: 2, channel: 'Phone' as const },
]

export function LiveSandbox({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const [capacity, setCapacity] = React.useState(20)
  const [booked, setBooked] = React.useState(14)
  const [events, setEvents] = React.useState<ChannelSyncEvent[]>(INITIAL_EVENTS)
  const [isSimulating, setIsSimulating] = React.useState(false)
  const [offlineMode, setOfflineMode] = React.useState(false)
  const [syncCount, setSyncCount] = React.useState(142)

  const handleSimulateBooking = (channelFilter?: 'Website' | 'Viator' | 'Walk-In') => {
    if (booked >= capacity || isSimulating) return
    setIsSimulating(true)

    const pool = channelFilter
      ? SIMULATED_GUESTS.filter((g) => g.channel === channelFilter)
      : SIMULATED_GUESTS
    const pick = pool[Math.floor(Math.random() * pool.length)] ?? SIMULATED_GUESTS[0]
    const seatsToAdd = Math.min(pick.seats, capacity - booked)

    setTimeout(() => {
      const newBooked = booked + seatsToAdd
      setBooked(newBooked)
      setSyncCount((c) => c + 1)

      const newEvt: ChannelSyncEvent = {
        id: `evt-${Date.now()}`,
        channel: pick.channel,
        seats: seatsToAdd,
        guestName: pick.name,
        timestamp: 'Just now',
        reference: `EZ-${Math.floor(10000 + Math.random() * 90000)}`,
      }

      setEvents((prev) => [newEvt, ...prev.slice(0, 4)])
      setIsSimulating(false)
    }, 400)
  }

  const handleReset = () => {
    setBooked(14)
    setEvents(INITIAL_EVENTS)
  }

  const seatsLeft = capacity - booked

  return (
    <section
      id="live-sandbox"
      className={cn(
        'relative isolate overflow-hidden bg-background-subtle py-20 lg:py-28',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft/50 px-3.5 py-1 text-[0.75rem] font-semibold tracking-wider text-primary uppercase">
              <Sparkles className="size-3.5" />
              Interactive Demo
            </span>
          <h2 className="mt-4 font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-foreground">
            Test Instant Cross-Channel Seat Locking
          </h2>
          <p className="mt-4 text-base text-muted sm:text-lg">
            Click below to simulate a real-time reservation. Watch how direct website checkout, OTAs,
            and dockside check-in instantly reconcile across your entire inventory with zero double-bookings.
          </p>
        </Reveal>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          {/* Controls & Active Departure State */}
          <Reveal className="lg:col-span-6" distance={20}>
            <div className="glass-strong rounded-3xl border border-line p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between gap-4 border-b border-line-subtle pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">SLIP 42</span>
                    <span aria-hidden="true" className="size-1 rounded-full bg-subtle" />
                    <span className="text-xs font-medium text-muted">14:30 Catamaran Sail</span>
                  </div>
                  <h3 className="mt-1 text-xl font-semibold text-foreground">
                    Molokini Crater Snorkel & Sail
                  </h3>
                </div>
                <Badge variant={seatsLeft === 0 ? 'danger' : 'success'} size="md" dot>
                  {seatsLeft === 0 ? 'Sold Out' : 'Active Departure'}
                </Badge>
              </div>

              {/* Capacity visualizer */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-foreground">Live Occupancy</span>
                  <span className="font-mono font-semibold text-foreground tabular-nums">
                    {booked} / {capacity} seats ({Math.round((booked / capacity) * 100)}%)
                  </span>
                </div>
                <CapacityBar booked={booked} capacity={capacity} held={0} size="lg" showLabel />
              </div>

              {/* Action Simulation Buttons */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="md"
                  disabled={seatsLeft === 0 || isSimulating}
                  onClick={() => handleSimulateBooking('Website')}
                  leftIcon={<Zap className="size-4" />}
                >
                  Book Direct Website (+2)
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  disabled={seatsLeft === 0 || isSimulating}
                  onClick={() => handleSimulateBooking('Viator')}
                  leftIcon={<ShieldCheck className="size-4" />}
                >
                  Book Viator OTA (+3)
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  disabled={seatsLeft === 0 || isSimulating}
                  onClick={() => handleSimulateBooking('Walk-In')}
                  leftIcon={<Smartphone className="size-4" />}
                >
                  Walk-In Desk (+1)
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleReset}
                  leftIcon={<RefreshCw className="size-3.5" />}
                  className="ml-auto text-subtle hover:text-foreground"
                >
                  Reset
                </Button>
              </div>

              {/* Offline Manifest Mode Toggle */}
              <div className="mt-6 flex items-center justify-between rounded-2xl bg-surface-sunken p-4 border border-line-subtle">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'grid size-9 place-items-center rounded-xl transition-colors',
                      offlineMode ? 'bg-warning-soft text-warning' : 'bg-surface text-subtle',
                    )}
                  >
                    <WifiOff className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Offline Dockside Mode</p>
                    <p className="text-xs text-muted">
                      {offlineMode
                        ? 'Manifest cached on captain device. Check-ins queue offline.'
                        : 'Simulate captain device with no cellular signal at the slip.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOfflineMode(!offlineMode)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none',
                    offlineMode ? 'bg-warning' : 'bg-line-strong',
                  )}
                >
                  <span
                    className={cn(
                      'inline-block size-5 transform rounded-full bg-white transition-transform duration-200 shadow-sm',
                      offlineMode ? 'translate-x-5' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            </div>
          </Reveal>

          {/* Live Synchronized Channel Feed */}
          <Reveal className="lg:col-span-6" delay={0.15} distance={20}>
            <div className="glass-strong rounded-3xl border border-line p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between pb-4 border-b border-line-subtle">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2.5">
                    <span className="absolute inline-flex size-full rounded-full bg-success opacity-75 animate-ping" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                  </span>
                  <h4 className="text-sm font-semibold text-foreground">
                    Live Channel Synchronization Feed
                  </h4>
                </div>
                <span className="font-mono text-xs text-subtle">
                  {syncCount} events synced today
                </span>
              </div>

              <div className="mt-5 space-y-3 min-h-[260px]">
                <AnimatePresence initial={false}>
                  {events.map((evt) => (
                    <motion.div
                      key={evt.id}
                      initial={reduce ? false : { opacity: 0, y: -12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35 }}
                      className="flex items-center justify-between rounded-2xl border border-line bg-surface p-3.5 shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary font-bold text-xs">
                          {evt.channel === 'Website'
                            ? 'WEB'
                            : evt.channel === 'Viator'
                            ? 'VTR'
                            : evt.channel === 'GetYourGuide'
                            ? 'GYG'
                            : 'DESK'}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {evt.guestName}{' '}
                            <span className="font-normal text-muted">
                              ({evt.seats} {evt.seats === 1 ? 'seat' : 'seats'})
                            </span>
                          </p>
                          <p className="text-xs text-subtle">
                            Ref: {evt.reference} · Channel: {evt.channel}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success bg-success-soft px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="size-3" /> Lock Synced
                        </span>
                        <p className="text-xs text-subtle mt-0.5">{evt.timestamp}</p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-line-subtle pt-4 text-xs text-subtle">
                <span className="flex items-center gap-1.5">
                  <Lock className="size-3.5 text-primary" />
                  Instant Atomic Inventory Lock
                </span>
                <span className="font-mono text-primary font-semibold">Latency: &lt; 180ms</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
