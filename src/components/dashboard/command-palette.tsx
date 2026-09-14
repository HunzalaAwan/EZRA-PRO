'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import {
  ArrowRight,
  CornerDownLeft,
  MoonStar,
  Plus,
  Search,
  SunMedium,
  Ticket,
  UserRound,
  Waves,
} from 'lucide-react'

import type { Activity } from '@/types'
import { DASHBOARD_NAV } from '@/lib/site-config'
import { CURRENT_TENANT } from '@/lib/demo-core'
import type { SearchResults } from '@/lib/demo'
import { searchCommandPalette } from '@/lib/actions/search'
import { cn, formatCurrency, formatDateShort, formatDuration } from '@/lib/utils'
import { useTheme } from '@/components/providers/theme-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { NewBookingDialog } from '@/components/dashboard/bookings/new-booking-dialog'
import { NavIcon } from '@/components/dashboard/sidebar'

/* ==========================================================================
   COMMAND PALETTE

   One context so ⌘K, the topbar search button and any future call site all
   drive the same panel. The listener lives in the provider — mounted exactly
   once per dashboard tree — and is torn down with it.
   ========================================================================== */

export interface CommandPaletteContextValue {
  /** Command palette visibility. */
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  /**
   * The shell's one global creation flow. Owned here so the topbar button and
   * the palette's "New booking" action drive the same dialog.
   */
  newBookingOpen: boolean
  setNewBookingOpen: (open: boolean) => void
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette() {
  const context = React.useContext(CommandPaletteContext)
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider')
  }
  return context
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [newBookingOpen, setNewBookingOpen] = React.useState(false)

  const toggle = React.useCallback(() => setOpen((previous) => !previous), [])

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  const value = React.useMemo(
    () => ({ open, setOpen, toggle, newBookingOpen, setNewBookingOpen }),
    [open, toggle, newBookingOpen],
  )

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <NewBookingDialog open={newBookingOpen} onOpenChange={setNewBookingOpen} />
    </CommandPaletteContext.Provider>
  )
}

/* --------------------------------------------------------------------------
   Row primitives
   -------------------------------------------------------------------------- */

const ACTIVITY_TINT: Record<Activity['colorKey'], string> = {
  lagoon: 'bg-primary-soft text-primary',
  coral: 'bg-accent-soft text-accent',
  sunset: 'bg-warning-soft text-warning',
  reef: 'bg-info-soft text-info',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
}

interface PaletteItemProps {
  value: string
  keywords?: string[]
  onSelect: () => void
  icon: React.ReactNode
  tint?: string
  label: string
  hint: string
  trailing?: React.ReactNode
}

function PaletteItem({
  value,
  keywords,
  onSelect,
  icon,
  tint,
  label,
  hint,
  trailing,
}: PaletteItemProps) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className={cn(
        'group/item flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2',
        'outline-hidden transition-colors duration-150',
        'data-[selected=true]:bg-primary-soft',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg border border-line-subtle',
          'bg-surface-sunken text-subtle [&_svg]:size-4',
          tint,
        )}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{label}</span>
        <span className="block truncate text-[0.6875rem] text-subtle">{hint}</span>
      </span>

      {trailing ? (
        <span className="shrink-0 text-[0.6875rem] font-medium text-subtle tabular-nums">
          {trailing}
        </span>
      ) : null}

      <ArrowRight
        aria-hidden="true"
        className="size-3.5 shrink-0 text-primary opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100"
      />
    </Command.Item>
  )
}

/* --------------------------------------------------------------------------
   Flattened navigation
   -------------------------------------------------------------------------- */

const NAV_ENTRIES = DASHBOARD_NAV.flatMap((section) =>
  section.items.map((item) => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    section: section.heading ?? 'Workspace overview',
  })),
)

/* --------------------------------------------------------------------------
   PALETTE
   -------------------------------------------------------------------------- */

export function CommandPalette() {
  const { open, setOpen, setNewBookingOpen } = useCommandPalette()
  const router = useRouter()
  const { resolvedTheme, toggleTheme } = useTheme()

  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<SearchResults>({
    activities: [],
    bookings: [],
    customers: [],
  })
  const hasQuery = query.trim().length > 0

  // Debounced Server Action call — the search itself (and the dataset it
  // scans) never leaves the server; the client only ever sees the up-to-6
  // matches per group that come back.
  React.useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length === 0) {
      setResults({ activities: [], bookings: [], customers: [] })
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      searchCommandPalette(CURRENT_TENANT.id, trimmed).then((next) => {
        if (!cancelled) setResults(next)
      })
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const close = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) setQuery('')
    },
    [setOpen],
  )

  const go = React.useCallback(
    (href: string) => {
      close(false)
      router.push(href)
    },
    [close, router],
  )

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        showCloseButton={false}
        size="lg"
        overlayClassName="backdrop-blur-[3px]"
        className={cn(
          'top-[9vh] max-h-[min(38rem,80vh)] max-w-[40rem] translate-y-0 p-0 sm:max-w-[40rem]',
          'border-line-strong bg-surface-raised/85 shadow-2xl backdrop-blur-2xl backdrop-saturate-150',
        )}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search activities, bookings and guests, or jump to any page in the dashboard.
        </DialogDescription>

        <Command
          loop
          label="Command palette"
          className="flex min-h-0 flex-1 flex-col [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.09em] [&_[cmdk-group-heading]]:text-faint [&_[cmdk-group-heading]]:uppercase"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-line-subtle px-4">
            <Search aria-hidden="true" className="size-[1.125rem] shrink-0 text-faint" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search bookings, guests, activities — or jump to a page…"
              className="h-[3.75rem] min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-hidden placeholder:text-faint"
            />
            <Kbd size="sm" variant="ghost" className="shrink-0">
              Esc
            </Kbd>
          </div>

          <Command.List className="max-h-[min(26rem,56vh)] min-h-0 overflow-y-auto overscroll-contain px-2 pb-2">
            <Command.Empty>
              <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
                <span
                  aria-hidden="true"
                  className="mb-1 grid size-11 place-items-center rounded-2xl bg-surface-sunken text-faint"
                >
                  <Search className="size-5" />
                </span>
                <p className="text-sm font-medium text-foreground">No matches for “{query}”</p>
                <p className="max-w-[22rem] text-xs leading-relaxed text-subtle">
                  Try a booking reference like <span className="font-mono">EZR-</span>, a guest
                  email, or an activity name.
                </p>
              </div>
            </Command.Empty>

            <Command.Group heading="Navigation">
              {NAV_ENTRIES.map((entry) => (
                <PaletteItem
                  key={entry.href}
                  value={`nav ${entry.label} ${entry.section} ${entry.href}`}
                  keywords={[entry.label, entry.section]}
                  onSelect={() => go(entry.href)}
                  icon={<NavIcon name={entry.icon} />}
                  label={entry.label}
                  hint={entry.section}
                />
              ))}
            </Command.Group>

            {hasQuery && results.activities.length > 0 ? (
              <Command.Group heading="Activities">
                {results.activities.map((activity) => (
                  <PaletteItem
                    key={activity.id}
                    value={`activity ${activity.name} ${activity.tagline} ${activity.slug} ${activity.category}`}
                    keywords={[activity.name, activity.slug]}
                    onSelect={() => go(`/dashboard/activities/${activity.id}`)}
                    icon={<Waves />}
                    tint={ACTIVITY_TINT[activity.colorKey]}
                    label={activity.name}
                    hint={`${formatDuration(activity.durationMinutes)} · ${formatCurrency(
                      activity.basePrice,
                      activity.currency,
                    )} · ${activity.status === 'live' ? 'Live' : activity.status === 'paused' ? 'Paused' : 'Draft'}`}
                    trailing={`${activity.rating.toFixed(2)} ★`}
                  />
                ))}
              </Command.Group>
            ) : null}

            {hasQuery && results.bookings.length > 0 ? (
              <Command.Group heading="Bookings">
                {results.bookings.map(({ booking, customer, activity, departure }) => (
                  <PaletteItem
                    key={booking.id}
                    value={`booking ${booking.reference} ${customer.firstName} ${customer.lastName} ${customer.email} ${activity.name}`}
                    keywords={[booking.reference, customer.email]}
                    onSelect={() => go(`/dashboard/bookings/${booking.id}`)}
                    icon={<Ticket />}
                    tint="bg-info-soft text-info"
                    label={`${booking.reference} · ${customer.firstName} ${customer.lastName}`}
                    hint={`${activity.name} · ${formatDateShort(departure.startsAt)} · ${booking.partySize} ${
                      booking.partySize === 1 ? 'guest' : 'guests'
                    }`}
                    trailing={formatCurrency(booking.total, booking.currency)}
                  />
                ))}
              </Command.Group>
            ) : null}

            {hasQuery && results.customers.length > 0 ? (
              <Command.Group heading="Guests">
                {results.customers.map((customer) => (
                  <PaletteItem
                    key={customer.id}
                    value={`customer ${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone}`}
                    keywords={[customer.email, customer.phone]}
                    onSelect={() => go(`/dashboard/customers/${customer.id}`)}
                    icon={<UserRound />}
                    tint="bg-accent-soft text-accent"
                    label={`${customer.firstName} ${customer.lastName}`}
                    hint={`${customer.email} · ${customer.totalBookings} ${
                      customer.totalBookings === 1 ? 'booking' : 'bookings'
                    }`}
                    trailing={formatCurrency(customer.lifetimeValue, CURRENT_TENANT.currency)}
                  />
                ))}
              </Command.Group>
            ) : null}

            <Command.Group heading="Actions">
              <PaletteItem
                value="action new booking create reservation"
                onSelect={() => {
                  close(false)
                  setNewBookingOpen(true)
                }}
                icon={<Plus />}
                tint="bg-primary-soft text-primary"
                label="New booking"
                hint="Take a reservation on any departure"
              />
              <PaletteItem
                value="action create activity new product experience"
                onSelect={() => go('/dashboard/activities/new')}
                icon={<Waves />}
                tint="bg-success-soft text-success"
                label="Create activity"
                hint="Add a new sellable experience"
              />
              <PaletteItem
                value="action toggle theme dark light appearance"
                onSelect={() => {
                  toggleTheme()
                  close(false)
                }}
                icon={resolvedTheme === 'dark' ? <SunMedium /> : <MoonStar />}
                tint="bg-warning-soft text-warning"
                label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
                hint="Appearance"
              />
            </Command.Group>
          </Command.List>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line-subtle px-4 py-2.5">
            <span className="flex items-center gap-3 text-[0.6875rem] text-faint">
              <span className="flex items-center gap-1.5">
                <Kbd size="sm" variant="ghost">
                  ↑
                </Kbd>
                <Kbd size="sm" variant="ghost">
                  ↓
                </Kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd size="sm" variant="ghost">
                  <CornerDownLeft className="size-2.5" aria-hidden="true" />
                </Kbd>
                open
              </span>
            </span>
            <span className="hidden items-center gap-1.5 text-[0.6875rem] text-faint sm:flex">
              Searching {CURRENT_TENANT.name}
            </span>
          </footer>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
