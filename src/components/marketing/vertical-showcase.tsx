'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { AnimatePresence, motion, useInView, type Variants } from 'motion/react'
import {
  Check,
  Compass,
  Mountain,
  Palmtree,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { SectionHeading } from '@/components/marketing/section-heading'
import { GlowOrb, GridBackground } from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { VERTICAL_PITCHES } from '@/content/marketing'
import { VERTICALS } from '@/lib/data/verticals'
import { DURATION, EASE_OUT_EXPO, SPRING_SNAPPY } from '@/lib/motion'
import {
  average,
  cn,
  createRng,
  formatDelta,
  hashSeed,
  percentChange,
  rngInt,
  sparklinePath,
} from '@/lib/utils'
import type { Vertical, VerticalKey } from '@/types'

/* ==========================================================================
   Constants
   ========================================================================== */

/** How long each vertical holds the stage before the carousel advances. */
const AUTO_ADVANCE_MS = 8000

/** lucide export names carried on `Vertical.icon`, resolved at render time. */
const VERTICAL_ICONS: Record<string, LucideIcon> = {
  Waves,
  Compass,
  UtensilsCrossed,
  Mountain,
  Palmtree,
  Sparkles,
}

/** Decorative tint per vertical — brand ramp, not a semantic token. */
const ACCENT_VAR: Record<Vertical['accent'], string> = {
  lagoon: 'var(--info)',
  coral: 'var(--accent)',
  sunset: 'var(--accent)',
  reef: 'var(--primary)',
}

const ENTITIES: Record<string, string> = {
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
  '&apos;': "'",
  '&#39;': "'",
}

/** The copy constants carry HTML entities; JSX renders text, so decode them. */
function plainText(input: string): string {
  return input.replace(
    /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|amp|quot|apos|#39);/g,
    (match) => ENTITIES[match] ?? match,
  )
}

function iconFor(vertical: Vertical): LucideIcon {
  return VERTICAL_ICONS[vertical.icon] ?? Compass
}

/* ==========================================================================
   Panel motion
   ========================================================================== */

const panelVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.quick, ease: EASE_OUT_EXPO, staggerChildren: 0.055, delayChildren: 0.04 },
  },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

const panelItemVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO },
  },
  exit: { opacity: 0, y: -8, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

const instantContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

const instantItem: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
  exit: { opacity: 1 },
}

/* ==========================================================================
   <VerticalShowcase>
   ========================================================================== */

export interface VerticalShowcaseProps {
  /** Which vertical is selected on first paint. */
  defaultVertical?: VerticalKey
  className?: string
}

/**
 * "Built for your kind of business" — the section that proves EZRA Pro knows
 * what a vessel manifest, a tasting seating and a guide roster are.
 *
 * A pill row of the six verticals drives a single crossfading panel: pitch on
 * the left, a re-tinted glimpse of the product on the right. It advances on its
 * own until the visitor engages with it (hover, focus or a click), and never
 * advances at all under `prefers-reduced-motion`.
 */
export function VerticalShowcase({ defaultVertical, className }: VerticalShowcaseProps) {
  const reducedMotion = useReducedMotionSafe()

  const initialIndex = useMemo(() => {
    const index = VERTICALS.findIndex((vertical) => vertical.key === defaultVertical)
    return index === -1 ? 0 : index
  }, [defaultVertical])

  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [paused, setPaused] = useState(false)
  const [panelHeight, setPanelHeight] = useState<number>()

  const sectionRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const observerRef = useRef<ResizeObserver | null>(null)

  const inView = useInView(sectionRef, { amount: 0.3 })
  const autoAdvancing = inView && !paused && !reducedMotion

  const active = VERTICALS[activeIndex]
  const pitch = VERTICAL_PITCHES[active.key]
  const accent = ACCENT_VAR[active.accent]
  const ActiveIcon = iconFor(active)

  /* -- selection ---------------------------------------------------------- */

  const select = useCallback(
    (index: number, moveFocus = false) => {
      const next = (index + VERTICALS.length) % VERTICALS.length
      setActiveIndex(next)

      const node = tabRefs.current[next]
      const scroller = scrollerRef.current
      if (!node) return
      if (moveFocus) node.focus({ preventScroll: true })
      if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return

      // Centre the pill inside its own rail without ever scrolling the page.
      const nodeBox = node.getBoundingClientRect()
      const railBox = scroller.getBoundingClientRect()
      const delta = nodeBox.left - railBox.left - (railBox.width - nodeBox.width) / 2
      scroller.scrollTo({
        left: scroller.scrollLeft + delta,
        behavior: reducedMotion ? 'auto' : 'smooth',
      })
    },
    [reducedMotion],
  )

  const handleTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
      const keys: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        ArrowDown: index + 1,
        ArrowUp: index - 1,
        Home: 0,
        End: VERTICALS.length - 1,
      }
      const next = keys[event.key]
      if (next === undefined) return
      event.preventDefault()
      select(next, true)
    },
    [select],
  )

  /* -- auto-advance ------------------------------------------------------- */

  useEffect(() => {
    if (!autoAdvancing) return
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % VERTICALS.length)
    }, AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [autoAdvancing, activeIndex])

  // Keep the auto-advanced pill in view on narrow screens.
  useEffect(() => {
    if (!autoAdvancing) return
    const scroller = scrollerRef.current
    const node = tabRefs.current[activeIndex]
    if (!scroller || !node || scroller.scrollWidth <= scroller.clientWidth) return
    const nodeBox = node.getBoundingClientRect()
    const railBox = scroller.getBoundingClientRect()
    scroller.scrollTo({
      left: scroller.scrollLeft + nodeBox.left - railBox.left - (railBox.width - nodeBox.width) / 2,
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [activeIndex, autoAdvancing, reducedMotion])

  /* -- height lock -------------------------------------------------------- */

  /**
   * `mode="wait"` unmounts the outgoing panel before the next one mounts, so
   * the card would collapse to nothing mid-swap. Holding the last measured
   * height as a floor keeps the section perfectly still through the crossfade,
   * and the observer re-measures on resize instead of guessing magic numbers.
   */
  const measurePanel = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const target = entries[0]?.target as HTMLElement | undefined
      if (target) setPanelHeight(target.offsetHeight)
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  /* -- render ------------------------------------------------------------- */

  const containerVariants = reducedMotion ? instantContainer : panelVariants
  const itemVariants = reducedMotion ? instantItem : panelItemVariants

  return (
    <section
      ref={sectionRef}
      id="verticals"
      aria-labelledby="verticals-title"
      className={cn(
        'relative isolate overflow-hidden bg-background-subtle py-20 sm:py-28 lg:py-32',
        className,
      )}
    >
      <GridBackground fade="radial" className="opacity-60" />
      <GlowOrb color={active.accent} size={520} opacity={0.16} blur={110} className="-top-32 left-[8%]" />
      <GlowOrb
        color="reef"
        size={420}
        opacity={0.1}
        blur={120}
        float={false}
        className="-bottom-24 right-[6%]"
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="verticals-title"
          align="center"
          eyebrow="Six verticals, one platform"
          title="Built for your kind of business"
          description="Generic booking software makes you bend the way you operate to fit the form fields. EZRA Pro already knows what a vessel manifest, a timed seating and a guide roster are — because it was built next to the people running them."
          className="mx-auto max-w-3xl"
        />

        {/* -- tabs ---------------------------------------------------------- */}
        <div
          className="mt-10 sm:mt-12"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
          }}
        >
          <Reveal direction="up" distance={12}>
            <div
              ref={scrollerRef}
              className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            >
              <div
                role="tablist"
                aria-label="Business verticals"
                aria-orientation="horizontal"
                className="mx-auto flex w-max items-center gap-1 rounded-full border border-line bg-surface/80 p-1.5 shadow-sm backdrop-blur-sm"
              >
                {VERTICALS.map((vertical, index) => {
                  const Icon = iconFor(vertical)
                  const isActive = index === activeIndex
                  const tint = ACCENT_VAR[vertical.accent]

                  return (
                    <button
                      key={vertical.key}
                      ref={(node) => {
                        tabRefs.current[index] = node
                      }}
                      type="button"
                      role="tab"
                      id={`vertical-tab-${vertical.key}`}
                      aria-selected={isActive}
                      aria-controls={isActive ? `vertical-panel-${vertical.key}` : undefined}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => select(index)}
                      onKeyDown={(event) => handleTabKeyDown(event, index)}
                      className={cn(
                        'relative isolate flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium',
                        'transition-colors duration-200 ease-[var(--ease-out-quint)]',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                        isActive ? 'text-foreground' : 'text-muted hover:text-foreground',
                      )}
                    >
                      {isActive ? (
                        <motion.span
                          aria-hidden="true"
                          layoutId="vertical-tab-indicator"
                          className="absolute inset-0 -z-10 rounded-full ring-1 ring-inset ring-line-strong"
                          style={{
                            background: `color-mix(in oklab, ${tint} 12%, var(--surface-raised))`,
                            boxShadow: `0 1px 2px oklch(0 0 0 / 0.06), 0 6px 18px -10px ${tint}`,
                          }}
                          transition={
                            reducedMotion ? { duration: 0 } : { type: 'spring', ...SPRING_SNAPPY }
                          }
                        />
                      ) : null}
                      <Icon
                        aria-hidden="true"
                        className="size-4 shrink-0 transition-colors duration-200"
                        style={isActive ? { color: tint } : undefined}
                      />
                      <span className="whitespace-nowrap">{vertical.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Reveal>

          {/* -- panel ------------------------------------------------------- */}
          <Reveal direction="up" distance={18} delay={0.06} className="mt-6 sm:mt-8">
            <div
              className="relative overflow-hidden rounded-3xl border border-line bg-surface shadow-xl transition-[min-height] duration-300 ease-[var(--ease-out-expo)]"
              style={panelHeight ? { minHeight: panelHeight } : undefined}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70"
                style={{
                  background: `radial-gradient(80% 100% at 50% 0%, color-mix(in oklab, ${accent} 12%, transparent), transparent 70%)`,
                }}
              />

              {autoAdvancing ? (
                <motion.div
                  key={`progress-${active.key}`}
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 z-20 h-px origin-left"
                  style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                />
              ) : null}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active.key}
                  ref={measurePanel}
                  role="tabpanel"
                  id={`vertical-panel-${active.key}`}
                  aria-labelledby={`vertical-tab-${active.key}`}
                  tabIndex={0}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="relative grid gap-8 p-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:gap-10 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:items-center lg:gap-12 lg:p-12"
                >
                  {/* -- pitch -------------------------------------------------- */}
                  <div className="flex flex-col">
                    <motion.div variants={itemVariants} className="flex items-center gap-3">
                      <span
                        className="flex size-9 items-center justify-center rounded-xl"
                        style={{
                          background: `color-mix(in oklab, ${accent} 14%, transparent)`,
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${accent} 28%, transparent)`,
                        }}
                      >
                        <ActiveIcon aria-hidden="true" className="size-[1.125rem]" style={{ color: accent }} />
                      </span>
                      <span
                        className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: accent }}
                      >
                        {active.label}
                      </span>
                    </motion.div>

                    <motion.h3
                      variants={itemVariants}
                      className="mt-5 font-display text-2xl font-semibold text-pretty text-foreground sm:text-3xl lg:text-[2rem] lg:leading-[1.12]"
                    >
                      {plainText(pitch.headline)}
                    </motion.h3>

                    <motion.p
                      variants={itemVariants}
                      className="mt-4 max-w-[54ch] text-base leading-relaxed text-muted"
                    >
                      {plainText(pitch.body)}
                    </motion.p>

                    <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      {pitch.bullets.map((bullet) => (
                        <motion.li
                          key={bullet}
                          variants={itemVariants}
                          className="flex items-start gap-2.5"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                            style={{ background: `color-mix(in oklab, ${accent} 16%, transparent)` }}
                          >
                            <Check className="size-3" style={{ color: accent }} strokeWidth={3} />
                          </span>
                          <span className="text-sm leading-snug text-foreground/85">
                            {plainText(bullet)}
                          </span>
                        </motion.li>
                      ))}
                    </ul>

                    <motion.div
                      variants={itemVariants}
                      className="mt-8 flex items-center gap-4 rounded-2xl border p-4 sm:gap-5 sm:p-5"
                      style={{
                        borderColor: `color-mix(in oklab, ${accent} 26%, var(--border))`,
                        background: `linear-gradient(120deg, color-mix(in oklab, ${accent} 10%, transparent), transparent 70%), var(--surface-sunken)`,
                      }}
                    >
                      <span
                        className="font-display text-[2.5rem] font-semibold leading-none tracking-tight sm:text-5xl"
                        style={{ color: accent }}
                      >
                        {pitch.proofStat}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-10 w-px shrink-0"
                        style={{ background: `color-mix(in oklab, ${accent} 32%, transparent)` }}
                      />
                      <p className="text-sm leading-snug text-muted">{plainText(pitch.proofLabel)}</p>
                    </motion.div>
                  </div>

                  {/* -- product glimpse ---------------------------------------- */}
                  <motion.div variants={itemVariants} className="lg:pl-2">
                    <VerticalVisual vertical={active} />
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   <VerticalVisual>
   One abstract product surface that re-tints and re-labels per vertical.
   ========================================================================== */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const TIME_SLOTS = ['7:30', '9:00', '10:15', '11:45', '13:30', '15:00', '16:45', '18:30'] as const
/** Thursday reads as "today" — fixed so SSR and client always agree. */
const TODAY_INDEX = 3

interface VisualDay {
  key: string
  label: string
  chips: { key: string; time: string; full: boolean }[]
}

interface VisualRow {
  key: string
  name: string
  booked: number
  capacity: number
  pct: number
}

function buildVisualData(vertical: Vertical) {
  const rng = createRng(hashSeed(`ezra-vertical-visual-${vertical.key}`))

  const days: VisualDay[] = DAY_LABELS.map((label, dayIndex) => {
    const slotCount = rngInt(rng, 1, 3)
    const slots = new Set<number>()
    while (slots.size < slotCount) slots.add(rngInt(rng, 0, TIME_SLOTS.length - 1))

    return {
      key: `${vertical.key}-day-${dayIndex}`,
      label,
      chips: Array.from(slots)
        .sort((a, b) => a - b)
        .map((slot) => ({
          key: `${vertical.key}-chip-${dayIndex}-${slot}`,
          time: TIME_SLOTS[slot],
          full: rng() > 0.66,
        })),
    }
  })

  const rows: VisualRow[] = vertical.sampleActivities.slice(0, 3).map((name, rowIndex) => {
    const capacity = rngInt(rng, 10, 24)
    const booked = rngInt(rng, Math.ceil(capacity * 0.5), capacity)
    return {
      key: `${vertical.key}-row-${rowIndex}`,
      name,
      booked,
      capacity,
      pct: Math.round((booked / capacity) * 100),
    }
  })

  // A gently upward drift — this is a proof surface, not a random walk.
  const trend: number[] = []
  let value = rngInt(rng, 30, 44)
  for (let index = 0; index < 16; index += 1) {
    value = Math.max(18, Math.min(100, value + rngInt(rng, -7, 12)))
    trend.push(value)
  }

  // Compare the last four weeks with the four before them — a whole-series
  // delta on a 16-week ramp reads as an implausible headline number.
  const delta = percentChange(average(trend.slice(-4)), average(trend.slice(-8, -4)))

  return { days, rows, trend, delta }
}

export interface VerticalVisualProps {
  vertical: Vertical
  className?: string
}

/**
 * A stylised slice of the EZRA Pro console: this week's departures, live
 * capacity on the three headline activities, and the revenue line underneath.
 *
 * Decorative by design — every figure is seeded from the vertical key so it is
 * stable across renders, and the whole surface is hidden from assistive tech
 * because the panel beside it carries the meaning.
 */
export function VerticalVisual({ vertical, className }: VerticalVisualProps) {
  const reducedMotion = useReducedMotionSafe()
  const accent = ACCENT_VAR[vertical.accent]
  const { days, rows, trend, delta } = useMemo(() => buildVisualData(vertical), [vertical])

  const linePath = useMemo(() => sparklinePath(trend, 260, 64, 3), [trend])
  const areaPath = `${linePath} L257,61 L3,61 Z`
  const gradientId = `vertical-spark-${vertical.key}`

  return (
    <div
      aria-hidden="true"
      className={cn('relative select-none', className)}
      style={{ '--v-accent': accent } as CSSProperties}
    >
      <div
        className="pointer-events-none absolute -inset-x-6 -bottom-8 -top-6 -z-10 rounded-[2.5rem] blur-2xl"
        style={{
          background:
            'radial-gradient(58% 55% at 50% 26%, color-mix(in oklab, var(--v-accent) 24%, transparent), transparent 72%)',
        }}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-xl">
        {/* chrome */}
        <div className="flex items-center gap-2.5 border-b border-line-subtle bg-surface-sunken/70 px-4 py-2.5">
          <span className="relative flex size-2 items-center justify-center">
            <span
              className="absolute inline-flex size-2 rounded-full opacity-60 motion-safe:animate-pulse-ring"
              style={{ background: 'var(--v-accent)' }}
            />
            <span
              className="relative inline-flex size-2 rounded-full"
              style={{ background: 'var(--v-accent)' }}
            />
          </span>
          <span className="truncate text-[11px] font-medium tracking-wide text-muted">
            {vertical.label} · this week
          </span>
          <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-subtle ring-1 ring-inset ring-line">
            Live
          </span>
        </div>

        {/* week strip */}
        <div className="px-3 pt-4 sm:px-4">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {days.map((day, dayIndex) => {
              const isToday = dayIndex === TODAY_INDEX
              return (
                <div
                  key={day.key}
                  className={cn(
                    'flex min-h-[5.5rem] flex-col gap-1 rounded-lg p-1 sm:min-h-[6rem] sm:p-1.5',
                    !isToday && 'bg-surface-sunken/45',
                  )}
                  style={
                    isToday
                      ? {
                          background: 'color-mix(in oklab, var(--v-accent) 9%, transparent)',
                          boxShadow:
                            'inset 0 0 0 1px color-mix(in oklab, var(--v-accent) 30%, transparent)',
                        }
                      : undefined
                  }
                >
                  <span
                    className={cn(
                      'text-center text-[9px] font-semibold uppercase tracking-[0.08em] sm:text-[10px]',
                      isToday ? 'text-foreground' : 'text-faint',
                    )}
                  >
                    <span className="sm:hidden">{day.label.charAt(0)}</span>
                    <span className="hidden sm:inline">{day.label}</span>
                  </span>

                  {day.chips.map((chip, chipIndex) => (
                    <motion.span
                      key={chip.key}
                      className="truncate rounded-[5px] px-1 py-[3px] text-center text-[8px] font-medium leading-none sm:text-[9px]"
                      style={
                        chip.full
                          ? {
                              background: 'color-mix(in oklab, var(--v-accent) 82%, transparent)',
                              color: 'var(--color-ink-975)',
                            }
                          : {
                              background: 'color-mix(in oklab, var(--v-accent) 16%, transparent)',
                              color: 'var(--v-accent)',
                            }
                      }
                      initial={reducedMotion ? false : { opacity: 0, scale: 0.86, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{
                        duration: DURATION.quick,
                        delay: 0.12 + dayIndex * 0.035 + chipIndex * 0.05,
                        ease: EASE_OUT_EXPO,
                      }}
                    >
                      {chip.time}
                    </motion.span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>

        {/* capacity */}
        <div className="mt-4 space-y-2.5 border-t border-line-subtle px-4 pt-4">
          {rows.map((row, rowIndex) => (
            <div key={row.key} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/80 sm:text-xs">
                {row.name}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-subtle sm:text-[11px]">
                {row.booked}/{row.capacity}
              </span>
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-sunken sm:w-24">
                <motion.span
                  className="block h-full origin-left rounded-full"
                  style={{
                    width: `${row.pct}%`,
                    background:
                      'linear-gradient(90deg, color-mix(in oklab, var(--v-accent) 55%, transparent), var(--v-accent))',
                  }}
                  initial={reducedMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{
                    duration: DURATION.slow,
                    delay: 0.28 + rowIndex * 0.08,
                    ease: EASE_OUT_EXPO,
                  }}
                />
              </span>
            </div>
          ))}
        </div>

        {/* revenue */}
        <div className="mt-4 border-t border-line-subtle px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              Revenue · 16 weeks
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold text-success">
              <TrendingUp className="size-3" />
              {formatDelta(delta)}
            </span>
          </div>

          <svg
            viewBox="0 0 260 64"
            preserveAspectRatio="none"
            className="mt-2 h-14 w-full overflow-visible sm:h-16"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--v-accent)' }} stopOpacity={0.32} />
                <stop offset="100%" style={{ stopColor: 'var(--v-accent)' }} stopOpacity={0} />
              </linearGradient>
            </defs>

            <motion.path
              d={areaPath}
              fill={`url(#${gradientId})`}
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DURATION.slow, delay: 0.35, ease: EASE_OUT_EXPO }}
            />
            <motion.path
              d={linePath}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ stroke: 'var(--v-accent)' }}
              initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: DURATION.slower, delay: 0.18, ease: EASE_OUT_EXPO }}
            />
          </svg>
        </div>
      </div>
    </div>
  )
}
