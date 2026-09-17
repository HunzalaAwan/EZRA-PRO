'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, PlugZap } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { Marquee } from '@/components/motion/marquee'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { INTEGRATIONS } from '@/content/marketing'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn, hashSeed, initials } from '@/lib/utils'
import type { Integration } from '@/types'

/* ==========================================================================
   SOURCE-TEXT HYGIENE
   Integration descriptions are authored with HTML entities. React escapes
   string children verbatim, so they are resolved here with a fixed table —
   identical on the server and the client, so nothing drifts at hydration.
   ========================================================================== */

const HTML_ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': '’',
  '&#39;': '’',
}

function decodeEntities(input: string): string {
  return input.replace(/&(?:[a-zA-Z]+|#\d+);/g, (match) => HTML_ENTITIES[match] ?? match)
}

/* ==========================================================================
   CATEGORIES
   ========================================================================== */

type IntegrationCategory = Integration['category']
type FilterKey = IntegrationCategory | 'all'

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  payments: 'Payments',
  ota: 'Channels',
  marketing: 'Marketing',
  accounting: 'Accounting',
  comms: 'Comms',
  ops: 'Ops',
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'payments', label: 'Payments' },
  { key: 'ota', label: 'Channels & OTAs' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'comms', label: 'Comms' },
  { key: 'ops', label: 'Ops' },
]

/* ==========================================================================
   LETTERMARKS
   There are no logo assets, so every partner gets a typographic mark instead:
   one or two letters from the name in a tinted rounded square. The tint is
   picked from a stable hash of the id, so a partner keeps the same colour on
   the server, on the client and across every page it appears on.
   ========================================================================== */

const MARK_TONES = [
  'bg-lagoon-500/12 text-lagoon-700 ring-lagoon-500/22 dark:bg-lagoon-400/14 dark:text-lagoon-300 dark:ring-lagoon-400/26',
  'bg-coral-500/12 text-coral-700 ring-coral-500/22 dark:bg-coral-400/14 dark:text-coral-300 dark:ring-coral-400/26',
  'bg-reef-500/12 text-reef-700 ring-reef-500/22 dark:bg-reef-400/14 dark:text-reef-300 dark:ring-reef-400/26',
  'bg-sunset-500/16 text-sunset-800 ring-sunset-500/24 dark:bg-sunset-400/14 dark:text-sunset-300 dark:ring-sunset-400/26',
] as const

function markTone(id: string): string {
  return MARK_TONES[hashSeed(id) % MARK_TONES.length]
}

function Lettermark({
  integration,
  className,
}: {
  integration: Integration
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-xl font-display font-semibold leading-none ring-1 ring-inset',
        'transition-transform duration-300 ease-[var(--ease-out-expo)]',
        markTone(integration.id),
        className,
      )}
    >
      {initials(integration.name)}
    </span>
  )
}

/* ==========================================================================
   CONSTELLATION
   Two counter-rotating rings of lettermarks around the EZRA hub. Positions
   are trigonometry on fixed angles — no randomness, so server and client
   agree. The whole block is decorative: the same partners are announced
   properly by the grid underneath, so it is hidden from assistive tech, and
   it collapses to a single belt below md where a 480px circle cannot fit.
   ========================================================================== */

interface OrbitPoint {
  left: string
  top: string
}

function orbitPoints(count: number, radius: number, offsetDegrees: number): OrbitPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = ((360 / count) * index + offsetDegrees) * (Math.PI / 180)
    return {
      left: `${(50 + radius * Math.cos(angle)).toFixed(3)}%`,
      top: `${(50 + radius * Math.sin(angle)).toFixed(3)}%`,
    }
  })
}

const INNER_POINTS = orbitPoints(4, 31, -45)
const OUTER_POINTS = orbitPoints(6, 45, -75)

/** Evenly strided picks, so neither ring is all payment processors. */
const INNER_INDICES = [0, 5, 10, 15]
const OUTER_INDICES = [2, 4, 7, 11, 14, 18]

function pickAt(items: Integration[], indices: number[]): Integration[] {
  if (items.length === 0) return []
  const seen = new Set<string>()
  const picked: Integration[] = []
  for (const index of indices) {
    const candidate = items[index % items.length]
    if (!candidate || seen.has(candidate.id)) continue
    seen.add(candidate.id)
    picked.push(candidate)
  }
  return picked
}

function OrbitRing({
  marks,
  points,
  seconds,
  reverse,
}: {
  marks: Integration[]
  points: OrbitPoint[]
  seconds: number
  reverse: boolean
}) {
  return (
    <div
      className="absolute inset-0 animate-spin-slow gpu"
      style={{
        animationDuration: `${seconds}s`,
        animationDirection: reverse ? 'reverse' : 'normal',
      }}
    >
      {marks.map((integration, index) => {
        const point = points[index]
        if (!point) return null
        return (
          <div
            key={integration.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: point.left, top: point.top }}
          >
            {/* Counter-rotates at the ring's own rate, so every mark stays upright. */}
            <div
              className="animate-spin-slow"
              style={{
                animationDuration: `${seconds}s`,
                animationDirection: reverse ? 'normal' : 'reverse',
              }}
            >
              <Lettermark
                integration={integration}
                className="size-12 rounded-2xl border border-line bg-surface text-sm shadow-md lg:size-14 lg:text-base"
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Constellation({ items }: { items: Integration[] }) {
  const inner = pickAt(items, INNER_INDICES)
  const outer = pickAt(items, OUTER_INDICES)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative mx-auto hidden aspect-square w-full max-w-[26rem] md:block lg:max-w-[30rem]"
    >
      <div className="absolute inset-[3%] rounded-full border border-dashed border-line-subtle" />
      <div className="absolute inset-[17%] rounded-full border border-dashed border-line" />
      <div className="absolute inset-[30%] rounded-full bg-primary/12 blur-xl" />

      <OrbitRing marks={outer} points={OUTER_POINTS} seconds={68} reverse />
      <OrbitRing marks={inner} points={INNER_POINTS} seconds={46} reverse={false} />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative grid size-24 place-items-center rounded-full glass-strong shadow-xl lg:size-28">
          <span className="absolute inset-0 rounded-full bg-primary/10" />
          <span className="absolute inset-0 animate-pulse-ring rounded-full ring-1 ring-primary/40" />
          <span className="relative font-display text-sm font-semibold tracking-[0.1em] text-foreground lg:text-base">
            EZRA
          </span>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   TILE
   ========================================================================== */

function IntegrationTile({ integration }: { integration: Integration }) {
  return (
    <div
      className={cn(
        'group flex h-full items-start gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-sm',
        'transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      )}
    >
      <Lettermark
        integration={integration}
        className="size-11 text-sm group-hover:scale-105 motion-reduce:group-hover:scale-100"
      />

      <div className="min-w-0 flex-1">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.13em] text-faint">
          {CATEGORY_LABEL[integration.category]}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{integration.name}</p>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-subtle transition-colors duration-300 group-hover:text-muted">
          {decodeEntities(integration.description)}
        </p>
      </div>
    </div>
  )
}

/* ==========================================================================
   SECTION
   ========================================================================== */

export interface IntegrationsProps {
  /** Anchor target for in-page navigation. */
  id?: string
  /** Override the partners shipped in the content file. */
  items?: Integration[]
  /** Where the closing call-to-action points. */
  href?: string
  className?: string
}

/**
 * The stack an operator already runs on, as a filterable wall of lettermarks.
 * Chips drive a shared `layoutId` pill; the grid re-flows with a layout
 * transition rather than a hard swap, so filtering reads as the same set of
 * tiles rearranging instead of a page repaint.
 */
export function Integrations({
  id = 'integrations',
  items = INTEGRATIONS,
  href = '/integrations',
  className,
}: IntegrationsProps) {
  const reducedMotion = useReducedMotionSafe()
  const [active, setActive] = useState<FilterKey>('all')

  const counts = useMemo(() => {
    const tally: Record<string, number> = { all: items.length }
    for (const filter of FILTERS) {
      if (filter.key !== 'all') tally[filter.key] = 0
    }
    for (const item of items) {
      tally[item.category] = (tally[item.category] ?? 0) + 1
    }
    return tally
  }, [items])

  const visible = useMemo(
    () => (active === 'all' ? items : items.filter((item) => item.category === active)),
    [active, items],
  )

  const tileTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.34, ease: EASE_OUT_EXPO }

  return (
    <section
      id={id}
      aria-label="Integrations"
      className={cn('relative isolate overflow-hidden py-24 sm:py-32', className)}
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Integrations"
          title="Connect the tools you already run on"
          description="Twenty first-party connections, live on day one. Keep your processor, your channels, your accounting and your inbox exactly where they are."
          align="center"
        />

        <div className="mt-12 sm:mt-14">
          <Constellation items={items} />

          {/* Below md the ring becomes a single belt — same partners, legible
              at 360px, no 480px circle squeezed into a phone. */}
          <div aria-hidden="true" className="md:hidden">
            <Marquee speed={44} gap={12} pauseOnHover={false}>
              {items.map((integration) => (
                <span
                  key={integration.id}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 shadow-sm"
                >
                  <Lettermark integration={integration} className="size-6 rounded-lg text-[0.625rem]" />
                  <span className="whitespace-nowrap text-xs font-medium text-muted">
                    {integration.name}
                  </span>
                </span>
              ))}
            </Marquee>
          </div>
        </div>

        {/* ---------------- FILTER CHIPS ---------------- */}
        <div className="mt-12 flex justify-center sm:mt-14">
          <div
            role="group"
            aria-label="Filter integrations by category"
            className="flex flex-wrap justify-center gap-1 rounded-2xl border border-line bg-surface-sunken/70 p-1.5 sm:rounded-full"
          >
            {FILTERS.map((filter) => {
              const isActive = filter.key === active
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActive(filter.key)}
                  aria-pressed={isActive}
                  className={cn(
                    'relative isolate inline-flex items-center gap-1.5 rounded-full px-3.5 py-2',
                    'text-xs font-medium transition-colors duration-200 ease-[var(--ease-out-expo)] sm:text-sm',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
                    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    isActive ? 'text-on-primary' : 'text-muted hover:text-foreground',
                  )}
                >
                  {isActive ? (
                    <motion.span
                      aria-hidden="true"
                      layoutId="integration-filter-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-primary shadow-sm"
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 }
                      }
                    />
                  ) : null}

                  <span>{filter.label}</span>
                  <span
                    className={cn(
                      'tabular text-[0.6875rem]',
                      isActive ? 'text-on-primary/70' : 'text-faint',
                    )}
                  >
                    {counts[filter.key] ?? 0}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ---------------- GRID ---------------- */}
        <motion.ul
          layout={!reducedMotion}
          transition={tileTransition}
          className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((integration) => (
              <motion.li
                key={integration.id}
                layout={!reducedMotion}
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={tileTransition}
                className="min-w-0"
              >
                <IntegrationTile integration={integration} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>

        {visible.length === 0 ? (
          <p className="mt-10 text-center text-sm text-subtle">
            Nothing in this category yet — try another filter.
          </p>
        ) : null}

        {/* ---------------- CLOSING CTA ---------------- */}
        <div className="mt-12 flex flex-col items-center gap-3.5 sm:mt-14">
          <Button
            asChild
            variant="outline"
            size="lg"
            leftIcon={<PlugZap aria-hidden="true" />}
            rightIcon={<ArrowRight aria-hidden="true" />}
          >
            <Link href={href}>Browse every integration</Link>
          </Button>
          <p className="max-w-md text-center text-xs leading-relaxed text-subtle">
            Not listed? The open REST API and webhooks cover the rest, and Zapier bridges another
            6,000 tools without a developer.
          </p>
        </div>
      </div>
    </section>
  )
}
