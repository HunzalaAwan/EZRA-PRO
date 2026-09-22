import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudRain,
  LayoutDashboard,
  Plus,
  Search,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { CapacityBar } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/* ==========================================================================
   HeroConsole — the week, as the desk sees it.

   The product screenshot under the landing headline, built from the same
   primitives the dashboard uses rather than shipped as a picture. A server
   component: nothing here moves on its own, so it costs no JavaScript and
   renders identically on the server and the client. The frame around it is
   what animates.
   ========================================================================== */

type Tint = 'primary' | 'accent' | 'success' | 'info' | 'chart'

const TINT: Record<Tint, { chip: string; text: string }> = {
  primary: { chip: 'border-primary/20 bg-primary/[0.07]', text: 'text-primary' },
  accent: { chip: 'border-accent/25 bg-accent/[0.08]', text: 'text-accent' },
  success: { chip: 'border-success/25 bg-success/[0.08]', text: 'text-success' },
  info: { chip: 'border-info/25 bg-info/[0.08]', text: 'text-info' },
  chart: { chip: 'border-chart-1/25 bg-chart-1/[0.08]', text: 'text-chart-1' },
}

interface Slot {
  id: string
  time: string
  name: string
  booked: number
  capacity: number
  held?: number
  tint: Tint
  flag?: 'full' | 'weather'
}

interface Day {
  weekday: string
  date: number
  today?: boolean
  /** Days past the first three are hidden on narrow screens. */
  slots: Slot[]
}

const WEEK: Day[] = [
  {
    weekday: 'Mon',
    date: 7,
    slots: [
      { id: 'a', time: '06:40', name: 'Sunrise paddle', booked: 12, capacity: 14, tint: 'primary' },
      { id: 'b', time: '19:30', name: "Chef's table", booked: 10, capacity: 10, tint: 'accent', flag: 'full' },
      { id: 'b2', time: '20:30', name: 'Wine flight', booked: 9, capacity: 20, tint: 'chart' },
    ],
  },
  {
    weekday: 'Tue',
    date: 8,
    slots: [
      { id: 'c', time: '09:00', name: 'Old town walk', booked: 6, capacity: 16, tint: 'chart' },
      { id: 'd', time: '17:45', name: 'Sunset sail', booked: 22, capacity: 38, tint: 'info' },
    ],
  },
  {
    weekday: 'Wed',
    date: 9,
    today: true,
    slots: [
      { id: 'e', time: '10:30', name: 'Pottery, beginners', booked: 8, capacity: 8, tint: 'success', flag: 'full' },
      { id: 'f', time: '19:00', name: 'Wine flight', booked: 14, capacity: 20, held: 2, tint: 'accent' },
      { id: 'f2', time: '20:30', name: 'Supper club', booked: 21, capacity: 24, tint: 'chart' },
    ],
  },
  {
    weekday: 'Thu',
    date: 10,
    slots: [
      { id: 'g', time: '06:40', name: 'Sunrise paddle', booked: 9, capacity: 14, tint: 'primary' },
      { id: 'h', time: '16:30', name: 'Reef snorkel', booked: 31, capacity: 38, tint: 'info', flag: 'weather' },
    ],
  },
  {
    weekday: 'Fri',
    date: 11,
    slots: [
      { id: 'i', time: '12:30', name: 'Long lunch terrace', booked: 26, capacity: 40, tint: 'accent' },
      { id: 'j', time: '20:00', name: 'Supper club', booked: 18, capacity: 24, tint: 'chart' },
      { id: 'j2', time: '21:30', name: 'Rooftop DJ set', booked: 88, capacity: 120, tint: 'primary' },
    ],
  },
  {
    weekday: 'Sat',
    date: 12,
    slots: [
      { id: 'k', time: '07:00', name: 'Balloon flight', booked: 8, capacity: 8, tint: 'primary', flag: 'full' },
      { id: 'l2', time: '10:00', name: 'Reef snorkel', booked: 30, capacity: 38, tint: 'info' },
      { id: 'l', time: '18:00', name: 'Rooftop gala', booked: 212, capacity: 300, tint: 'success' },
    ],
  },
  {
    weekday: 'Sun',
    date: 13,
    slots: [
      { id: 'm', time: '08:30', name: 'Sunrise yoga', booked: 11, capacity: 20, tint: 'success' },
      { id: 'n', time: '11:00', name: 'Vineyard day trip', booked: 15, capacity: 16, tint: 'chart' },
    ],
  },
]

const RAIL: { icon: LucideIcon; label: string; active?: boolean }[] = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: CalendarDays, label: 'Calendar', active: true },
  { icon: Ticket, label: 'Bookings' },
  { icon: ClipboardList, label: 'Manifest' },
  { icon: Users, label: 'Guests' },
  { icon: Wallet, label: 'Payouts' },
]

/** Index at which a day column is hidden below `sm`, then below `lg`. */
function columnVisibility(index: number) {
  if (index < 3) return ''
  if (index < 5) return 'hidden sm:flex'
  return 'hidden lg:flex'
}

export function HeroConsole({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The EZRA Pro calendar for the week of 7 September: eighteen departures, sittings and classes across seven days, with sold-out slots, a weather hold and seats held by carts in progress."
      className={cn('flex h-[19rem] sm:h-[22rem] lg:h-[23.5rem]', className)}
    >
      {/* ---------- nav rail ---------- */}
      <div aria-hidden="true" className="hidden w-12 shrink-0 flex-col items-center gap-1 border-r border-line-subtle bg-surface py-3 sm:flex">
        <span className="grid size-6 place-items-center rounded-md bg-primary font-display text-xs font-bold text-on-primary">
          E
        </span>
        <span className="my-1.5 h-px w-5 bg-line-subtle" />
        {RAIL.map((item) => {
          const Icon = item.icon
          return (
            <span
              key={item.label}
              className={cn(
                'grid size-7 place-items-center rounded-lg',
                item.active ? 'bg-primary-soft text-primary ring-1 ring-primary/25 ring-inset' : 'text-faint',
              )}
            >
              <Icon className="size-[0.9375rem]" strokeWidth={1.9} />
            </span>
          )
        })}
      </div>

      {/* ---------- week ---------- */}
      <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line-subtle bg-surface px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-display text-[0.8125rem] leading-tight font-semibold text-foreground">
              7 – 13 September
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">
              <span className="tabular">18 slots</span>
              <span className="text-faint">·</span>
              <span className="tabular">559 seats sold</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden h-6 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-xs text-faint sm:flex">
              <Search className="size-3" />
              Search
            </span>
            <span className="hidden items-center gap-0.5 rounded-md border border-line bg-surface p-0.5 text-faint sm:flex">
              <ChevronLeft className="size-3.5" />
              <ChevronRight className="size-3.5" />
            </span>
            <span className="inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-on-primary">
              <Plus className="size-3" strokeWidth={2.5} />
              New slot
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden px-2.5 pt-2.5 pb-2">
          <div className="grid h-full grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-7">
            {WEEK.map((day, index) => (
              <div key={day.weekday} className={cn('flex min-w-0 flex-col gap-1.5', columnVisibility(index))}>
                <div
                  className={cn(
                    'flex items-baseline justify-between gap-1 rounded-md px-1.5 py-1',
                    day.today ? 'bg-primary text-on-primary' : 'bg-surface-sunken',
                  )}
                >
                  <span className={cn('text-xs font-semibold tracking-[0.08em] uppercase', day.today ? 'text-on-primary/80' : 'text-subtle')}>
                    {day.weekday}
                  </span>
                  <span className={cn('tabular text-xs font-semibold', day.today ? 'text-on-primary' : 'text-foreground')}>
                    {day.date}
                  </span>
                </div>

                {day.slots.map((slot) => (
                  <div key={slot.id} className={cn('flex flex-col gap-1 rounded-md border p-1.5 shadow-xs', TINT[slot.tint].chip)}>
                    <div className="flex items-center gap-1">
                      <span className={cn('tabular text-xs leading-none font-bold', TINT[slot.tint].text)}>{slot.time}</span>
                      {slot.flag === 'weather' ? <CloudRain className="size-2.5 shrink-0 text-warning" /> : null}
                      {slot.flag === 'full' ? (
                        <span className="ml-auto rounded-sm bg-foreground px-1 text-xs leading-[0.875rem] font-bold text-background">
                          FULL
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs leading-tight font-medium text-foreground">{slot.name}</p>
                    <CapacityBar booked={slot.booked} capacity={slot.capacity} held={slot.held} size="xs" showLabel={false} />
                    <p className="tabular text-xs leading-none text-subtle">
                      {slot.booked}/{slot.capacity}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line-subtle bg-surface px-3 py-2">
          <CloudRain className="size-3.5 shrink-0 text-warning" />
          <p className="min-w-0 truncate text-xs text-muted">
            Thursday 16:30 is on a weather hold. 31 guests have been told and are waiting on a decision.
          </p>
          <span className="ml-auto hidden h-6 shrink-0 items-center rounded-md border border-line bg-surface px-2 text-xs font-semibold text-foreground sm:inline-flex">
            Review
          </span>
        </footer>
      </div>
    </div>
  )
}
