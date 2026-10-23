'use client'

import * as React from 'react'
import Image from 'next/image'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchInput } from '@/components/ui/search-input'
import { Switch } from '@/components/ui/switch'
import { cn, formatCurrency } from '@/lib/utils'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import type { CurrencyCode, SoldOutSuggestions } from '@/types'

/* ==========================================================================
   WHEN IT'S FULLY BOOKED — on the Booking step, right after Capacity. What
   the storefront offers a guest on a day with no spots left: the next days
   that have spots (on unless switched off) and, if picked, some of the
   business's other activities. Only the ones with spots soon are shown.
   ========================================================================== */

/** One of the business's other live activities, offered in the picker. */
export interface SuggestOption {
  id: string
  name: string
  /** The cover photo's url; none: the name alone. */
  image?: string
  /** Its lowest price, minor units. */
  basePrice: number
}

/** "Other days · 2 activities": the setting in one line, for the Review step. */
export function soldOutSummary(value: SoldOutSuggestions, options: SuggestOption[]): string {
  const picked = value.activityIds.filter((id) => options.length === 0 || options.some((option) => option.id === id)).length
  const parts = [value.otherDays ? 'Other days' : null, picked > 0 ? `${picked} ${picked === 1 ? 'activity' : 'activities'}` : null].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Nothing suggested'
}

export function SoldOutBox({
  value,
  onChange,
  options: seeded,
  currency,
}: {
  value: SoldOutSuggestions
  onChange: (next: SoldOutSuggestions) => void
  /** The business's other live activities (not this one). */
  options: SuggestOption[]
  currency: CurrencyCode
}) {
  const headingId = React.useId()
  const listId = React.useId()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  // The names as saved in this browser's edits, so a renamed activity reads as it does on the storefront.
  const overrides = useActivityOverrides()
  const options = React.useMemo(() => seeded.map((option) => (overrides[option.id]?.name ? { ...option, name: overrides[option.id].name } : option)), [seeded, overrides])
  // Picked activities that are no longer on sale are left off the chips (and the storefront skips them).
  const picked = value.activityIds.map((id) => options.find((option) => option.id === id)).filter((option): option is SuggestOption => Boolean(option))
  const unpicked = options.filter((option) => !value.activityIds.includes(option.id))
  const shown = query.trim() ? unpicked.filter((option) => option.name.toLowerCase().includes(query.trim().toLowerCase())) : unpicked
  const setIds = (activityIds: string[]) => onChange({ ...value, activityIds })

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-4" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold">
        When it&rsquo;s fully booked
      </h3>
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">Suggest other days</span>
          <span className="block text-xs text-subtle">The next days with spots left.</span>
        </span>
        <Switch checked={value.otherDays} onCheckedChange={(otherDays) => onChange({ ...value, otherDays })} aria-label="Suggest other days" />
      </label>

      <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              Suggest other activities <span className="text-xs font-normal text-subtle">Optional</span>
            </p>
            <p className="text-xs text-subtle">Only shown when they have spots.</p>
          </div>
          {options.length > 0 && unpicked.length > 0 ? (
            <Popover
              open={open}
              onOpenChange={(next) => {
                setOpen(next)
                if (!next) setQuery('')
              }}
            >
              <PopoverTrigger asChild>
                <Button type="button" variant="secondary" size="xs" leftIcon={<Plus />}>
                  Add an activity
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" width="md" padding="sm" className="flex flex-col gap-2">
                {unpicked.length > 5 ? <SearchInput size="sm" label="Search activities" placeholder="Search activities" value={query} onValueChange={setQuery} debounceMs={0} autoFocus /> : null}
                <ul id={listId} className="flex max-h-72 list-none flex-col gap-0.5 overflow-y-auto p-0" aria-label="Your other activities">
                  {shown.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setIds([...value.activityIds, option.id])
                          if (unpicked.length <= 1) setOpen(false)
                        }}
                        className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <Thumb option={option} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{option.name}</span>
                          <span className="block text-xs text-subtle tabular">From {formatCurrency(option.basePrice, currency)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {shown.length === 0 ? <li className="px-2 py-3 text-sm text-subtle">No activity matches.</li> : null}
                </ul>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>

        {picked.length > 0 ? (
          <ul className="flex list-none flex-wrap gap-2 p-0" aria-label="Activities suggested">
            {picked.map((option) => (
              <li key={option.id} className="flex min-w-0 max-w-full items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-1">
                <Thumb option={option} small />
                <span className="min-w-0 truncate text-sm">{option.name}</span>
                <button
                  type="button"
                  onClick={() => setIds(value.activityIds.filter((id) => id !== option.id))}
                  aria-label={`Remove ${option.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : options.length === 0 ? (
          <p className="text-xs text-subtle">Add another activity to suggest it here.</p>
        ) : null}
      </div>
    </section>
  )
}

function Thumb({ option, small = false }: { option: SuggestOption; small?: boolean }) {
  return (
    <span className={cn('relative shrink-0 overflow-hidden bg-surface-sunken', small ? 'size-7 rounded-full' : 'size-10 rounded-lg')} aria-hidden="true">
      {option.image ? (
        <Image src={option.image} alt="" fill sizes={small ? '28px' : '40px'} className="object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-xs font-semibold text-muted">{option.name.charAt(0).toUpperCase()}</span>
      )}
    </span>
  )
}
