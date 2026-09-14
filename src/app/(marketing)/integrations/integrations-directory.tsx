'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, PlugZap, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { INTEGRATIONS } from '@/content/marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn, hashSeed, initials } from '@/lib/utils'
import type { Integration } from '@/types'

/* ==========================================================================
   TAXONOMY

   Order is editorial, not alphabetical: the categories an operator evaluates
   first (where the money moves, then where the demand comes from) lead.
   ========================================================================== */

type Category = Integration['category']

const CATEGORY_ORDER: Category[] = ['payments', 'ota', 'marketing', 'accounting', 'comms', 'ops']

const CATEGORY_LABEL: Record<Category, string> = {
  payments: 'Payments',
  ota: 'Channels & OTAs',
  marketing: 'Marketing',
  accounting: 'Accounting',
  comms: 'Communications',
  ops: 'Operations',
}

const CATEGORY_BLURB: Record<Category, string> = {
  payments: 'Take the money, split the tips, get paid next business day.',
  ota: 'One inventory pool, every marketplace, no oversells.',
  marketing: 'Push guest segments and conversion events where you already work.',
  accounting: 'Sales, fees and payouts reconciled without a spreadsheet.',
  comms: 'Confirmations, reminders and weather alerts that actually arrive.',
  ops: 'Wire EZRA Pro into whatever the rest of your business runs on.',
}

type FilterKey = 'all' | Category

/* ==========================================================================
   LETTERMARK TINT

   Keyed off a stable hash of the integration id so a partner keeps the same
   colour on every surface, and nothing is decided at render time.
   ========================================================================== */

const MARK_TINTS = [
  'bg-lagoon-500/12 text-lagoon-700 ring-lagoon-500/22 dark:bg-lagoon-400/14 dark:text-lagoon-300 dark:ring-lagoon-400/26',
  'bg-coral-500/12 text-coral-700 ring-coral-500/22 dark:bg-coral-400/14 dark:text-coral-300 dark:ring-coral-400/26',
  'bg-reef-500/12 text-reef-700 ring-reef-500/22 dark:bg-reef-400/14 dark:text-reef-300 dark:ring-reef-400/26',
  'bg-sunset-500/12 text-sunset-700 ring-sunset-500/22 dark:bg-sunset-400/14 dark:text-sunset-300 dark:ring-sunset-400/26',
]

function markTint(id: string) {
  return MARK_TINTS[hashSeed(id) % MARK_TINTS.length]
}

/* ==========================================================================
   ENTITIES — descriptions carry `&rsquo;` (Tripadvisor&rsquo;s, Expedia&rsquo;s).
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': '’',
  '&amp;': '&',
}

const ENTITY_PATTERN = /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|quot|#39|amp);/g

function decodeEntities(input: string) {
  return input.replace(ENTITY_PATTERN, (match) => ENTITIES[match] ?? match)
}

/* ==========================================================================
   SEARCH INDEX — built once at module scope. Name, category label and the
   decoded description are all searchable, so "oversell" finds the OTAs and
   "payout" finds Stripe and QuickBooks.
   ========================================================================== */

const INDEXED = INTEGRATIONS.map((integration) => ({
  ...integration,
  description: decodeEntities(integration.description),
  haystack: [
    integration.name,
    CATEGORY_LABEL[integration.category],
    decodeEntities(integration.description),
  ]
    .join(' ')
    .toLowerCase(),
}))

const COUNTS: Record<FilterKey, number> = {
  all: INDEXED.length,
  payments: INDEXED.filter((item) => item.category === 'payments').length,
  ota: INDEXED.filter((item) => item.category === 'ota').length,
  marketing: INDEXED.filter((item) => item.category === 'marketing').length,
  accounting: INDEXED.filter((item) => item.category === 'accounting').length,
  comms: INDEXED.filter((item) => item.category === 'comms').length,
  ops: INDEXED.filter((item) => item.category === 'ops').length,
}

const FILTERS: FilterKey[] = ['all', ...CATEGORY_ORDER]

/* ==========================================================================
   DIRECTORY
   ========================================================================== */

export interface IntegrationsDirectoryProps {
  className?: string
}

export function IntegrationsDirectory({ className }: IntegrationsDirectoryProps) {
  const reduceMotion = useReducedMotionSafe()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const matches = INDEXED.filter((item) => {
      if (filter !== 'all' && item.category !== filter) return false
      if (!needle) return true
      return item.haystack.includes(needle)
    })

    return CATEGORY_ORDER.map((category) => ({
      category,
      items: matches.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0)
  }, [filter, query])

  const total = groups.reduce((count, group) => count + group.items.length, 0)

  const clear = () => {
    setQuery('')
    setFilter('all')
  }

  return (
    <div className={cn('relative', className)}>
      {/* ---------- Controls ---------- */}
      <div className="flex flex-col gap-5">
        <SearchInput
          label="Search integrations"
          placeholder="Search 20 integrations — try “payout”, “Viator” or “SMS”"
          size="lg"
          debounceMs={120}
          value={query}
          onValueChange={setQuery}
          className="text-base"
          fieldClassName="w-full max-w-xl"
        />

        <div role="group" aria-label="Filter integrations by category" className="flex flex-wrap gap-2">
          {FILTERS.map((option) => {
            const active = option === filter
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5',
                  'text-[0.8125rem] font-medium whitespace-nowrap',
                  'transition-[color,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  active
                    ? 'border-[color-mix(in_oklab,var(--primary)_38%,transparent)] bg-primary-soft text-primary shadow-sm'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                )}
              >
                {option === 'all' ? 'Everything' : CATEGORY_LABEL[option]}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular',
                    active ? 'bg-surface text-primary' : 'bg-surface-sunken text-subtle',
                  )}
                >
                  {COUNTS[option]}
                </span>
              </button>
            )
          })}
        </div>

        <p aria-live="polite" className="text-sm text-subtle">
          {total === 0
            ? 'No integrations match that.'
            : `Showing ${total} of ${COUNTS.all} integrations`}
        </p>
      </div>

      {/* ---------- Results ---------- */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${filter}:${query.trim().toLowerCase()}`}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT_EXPO }}
          className="mt-10"
        >
          {groups.length === 0 ? (
            <EmptyState
              variant="no-results"
              icon={SearchX}
              title="Nothing matches that search"
              description="Try a broader term, or clear the filters to browse all twenty. If the tool you need is genuinely missing, tell us — the roadmap is largely operator-requested."
              action={
                <Button type="button" variant="secondary" size="md" onClick={clear}>
                  Clear search and filters
                </Button>
              }
              secondaryAction={
                <Button asChild variant="ghost" size="md">
                  <Link href="/contact?topic=integration">Request an integration</Link>
                </Button>
              }
              className="rounded-3xl border border-line bg-surface"
            />
          ) : (
            <div className="flex flex-col gap-12">
              {groups.map((group) => (
                <section key={group.category} aria-labelledby={`group-${group.category}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
                    <h3
                      id={`group-${group.category}`}
                      className="font-display text-lg font-semibold tracking-[-0.015em] text-foreground"
                    >
                      {CATEGORY_LABEL[group.category]}
                      <span className="ml-2.5 text-sm font-medium text-faint tabular">
                        {group.items.length}
                      </span>
                    </h3>
                    <p className="text-sm text-muted">{CATEGORY_BLURB[group.category]}</p>
                  </div>

                  <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className={cn(
                          'group flex gap-4 rounded-2xl border border-line bg-surface p-5 shadow-xs',
                          'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
                          'hover:-translate-y-1 hover:border-line-strong hover:shadow-lg',
                          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1',
                            'font-display text-sm font-bold tracking-[-0.02em]',
                            'transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-105',
                            'motion-reduce:transition-none motion-reduce:group-hover:scale-100',
                            markTint(item.id),
                          )}
                        >
                          {initials(item.name)}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-foreground">
                            {item.name}
                          </span>
                          <span className="mt-1.5 block text-[0.8125rem] leading-relaxed text-muted">
                            {item.description}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ---------- Request an integration ---------- */}
      <div
        className={cn(
          'mt-14 flex flex-col items-start gap-5 rounded-3xl border border-line p-6 shadow-sm sm:p-8 lg:flex-row lg:items-center lg:justify-between',
          'bg-[linear-gradient(140deg,color-mix(in_oklab,var(--primary)_11%,var(--surface))_0%,var(--surface)_56%,color-mix(in_oklab,var(--accent)_10%,var(--surface))_100%)]',
        )}
      >
        <div className="flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <PlugZap className="size-5" aria-hidden="true" />
          </span>
          <div className="max-w-xl">
            <h3 className="font-display text-lg font-semibold tracking-[-0.015em] text-foreground">
              Missing the one you actually use?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Most of this list exists because an operator asked for it. Tell us what you need and
              which of your workflows depends on it — and if it is urgent, the REST API and
              webhooks are on every plan, so you never have to wait for us.
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2.5 sm:w-auto sm:flex-row lg:w-auto">
          <Button
            asChild
            size="md"
            variant="primary"
            rightIcon={<ArrowRight aria-hidden="true" />}
          >
            <Link href="/contact?topic=integration">Request an integration</Link>
          </Button>
          <Button asChild size="md" variant="outline">
            <Link href="/developers">Read the API docs</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
