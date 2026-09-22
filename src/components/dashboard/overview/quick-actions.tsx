'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarOff,
  Download,
  FileSpreadsheet,
  FileText,
  Plus,
  UserPlus,
  Waves,
  type LucideIcon,
} from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'
import {
  DateRangePicker,
  formatRangeLabel,
  rangeForPreset,
} from '@/components/ui/date-range-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import type { DateRange, RangePreset } from '@/types'

/* ==========================================================================
   QuickActions — the four things an operator starts a session with, plus the
   page header's own controls (they live here because they are actions, and
   keeping them beside the tiles means one client island instead of two).
   ========================================================================== */

interface ActionTile {
  label: string
  description: string
  cta: string
  href: string
  icon: LucideIcon
  /** Tinted medallion. */
  chip: string
  /** Hover bloom behind the tile. */
  wash: string
}

const TILES: ActionTile[] = [
  {
    label: 'New booking',
    description: 'Take a reservation over the phone or at the desk.',
    cta: 'Open the form',
    href: '/dashboard/bookings?new=1',
    icon: Plus,
    chip: 'bg-lagoon-400/14 text-primary ring-lagoon-400/28',
    wash: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-lagoon-400),transparent_70%)]',
  },
  {
    label: 'Add activity',
    description: 'Publish a new trip with tiers, add-ons and photos.',
    cta: 'Start a draft',
    href: '/dashboard/activities?new=1',
    icon: Waves,
    chip: 'bg-coral-400/14 text-accent ring-coral-400/28',
    wash: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-coral-500),transparent_70%)]',
  },
  {
    label: 'Block time',
    description: 'Close a slot for maintenance, weather or a private charter.',
    cta: 'Edit availability',
    href: '/dashboard/availability?block=1',
    icon: CalendarOff,
    chip: 'bg-sunset-400/16 text-warning ring-sunset-400/28',
    wash: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-sunset-400),transparent_70%)]',
  },
  {
    label: 'Invite teammate',
    description: 'Add a captain, guide or reservations lead to the crew.',
    cta: 'Send an invite',
    href: '/dashboard/team?invite=1',
    icon: UserPlus,
    chip: 'bg-reef-400/14 text-info ring-reef-400/28',
    wash: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-reef-400),transparent_70%)]',
  },
]

export interface QuickActionsProps {
  className?: string
}

export function QuickActions({ className }: QuickActionsProps) {
  return (
    <StaggerGroup
      as="ul"
      stagger={0.06}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {TILES.map((tile) => {
        const Icon = tile.icon
        return (
          <StaggerItem as="li" key={tile.label} distance={14}>
            <Link
              href={tile.href}
              className={cn(
                'group relative isolate flex h-full flex-col gap-3 overflow-hidden rounded-2xl',
                'border border-line bg-surface p-4 shadow-xs',
                'transition-all duration-300 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lg',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'motion-reduce:transform-none motion-reduce:transition-none',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute -top-12 -right-10 -z-10 size-32 rounded-full opacity-0 blur-2xl',
                  'transition-opacity duration-500 ease-[var(--ease-out-expo)] group-hover:opacity-25',
                  tile.wash,
                )}
              />

              <span
                className={cn(
                  'grid size-10 place-items-center rounded-xl ring-1 ring-inset',
                  'transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-105',
                  'motion-reduce:transform-none',
                  tile.chip,
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
              </span>

              <span className="block">
                <span className="block font-display text-sm font-semibold tracking-[-0.01em] text-foreground">
                  {tile.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {tile.description}
                </span>
              </span>

              <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary">
                {tile.cta}
                <ArrowRight
                  aria-hidden="true"
                  className="size-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </StaggerItem>
        )
      })}
    </StaggerGroup>
  )
}

/* --------------------------------------------------------------------------
   OverviewHeaderActions — the <PageHeader actions> island.
   -------------------------------------------------------------------------- */

export interface OverviewHeaderActionsProps {
  /** Local ISO "now" from the data seam, e.g. "2026-09-11T09:00:00". */
  nowIso: string
  className?: string
}

const EXPORTS: { label: string; detail: string; icon: LucideIcon }[] = [
  { label: 'CSV', detail: 'Bookings, guests and totals for the selected range.', icon: FileSpreadsheet },
  { label: 'PDF summary', detail: 'A one-page briefing with charts and KPIs.', icon: FileText },
]

export function OverviewHeaderActions({ nowIso, className }: OverviewHeaderActionsProps) {
  const referenceDate = React.useMemo(() => new Date(nowIso), [nowIso])

  const [preset, setPreset] = React.useState<RangePreset>('30d')
  const [range, setRange] = React.useState<DateRange>(
    () =>
      rangeForPreset('30d', new Date(nowIso)) ?? {
        from: nowIso.slice(0, 10),
        to: nowIso.slice(0, 10),
      },
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <DateRangePicker
        value={range}
        preset={preset}
        referenceDate={referenceDate}
        label="Dashboard date range"
        onChange={(nextRange, nextPreset) => {
          setRange(nextRange)
          setPreset(nextPreset)
          toast.success('Range updated', {
            description: formatRangeLabel(nextRange),
          })
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="md" leftIcon={<Download />}>
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Export this view</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {EXPORTS.map((option) => {
            const Icon = option.icon
            return (
              <DropdownMenuItem
                key={option.label}
                className="items-start"
                onSelect={() =>
                  toast.success(`${option.label} export queued`, {
                    description: `${formatRangeLabel(range)} — we will email it to you when it is ready.`,
                  })
                }
              >
                <Icon aria-hidden="true" className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-subtle">
                    {option.detail}
                  </span>
                </span>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <p className="px-2.5 pt-1 pb-2 text-xs leading-relaxed text-faint">
            Exports respect the date range above and every filter applied to this page.
          </p>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
