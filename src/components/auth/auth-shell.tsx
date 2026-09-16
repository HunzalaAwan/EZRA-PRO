'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Star } from 'lucide-react'

import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { SITE } from '@/lib/site-config'
import { NOW } from '@/lib/data/constants'
import { STATS, TESTIMONIALS } from '@/content/marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Avatar } from '@/components/ui/avatar'

/* ==========================================================================
   WORDMARK
   ========================================================================== */

export interface AuthWordmarkProps {
  /** `brand` inverts the lockup for the photo panel. */
  tone?: 'default' | 'brand'
  className?: string
}

/**
 * The EZRA mark: a rounded tile carrying a swell line. Drawn inline so it
 * tints itself from the surrounding text colour on the dark panel.
 */
export function AuthWordmark({ tone = 'default', className }: AuthWordmarkProps) {
  const brand = tone === 'brand'

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'relative flex size-9 items-center justify-center rounded-xl',
          brand ? 'bg-white/15 text-white ring-1 ring-white/20' : 'bg-primary text-on-primary',
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" focusable="false">
          <path
            d="M3 15.2c2.1-2.6 4.2-2.6 6.3 0s4.2 2.6 6.3 0 4.2-2.6 5.4-.9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M5.5 9.2c1.7-2.1 3.4-2.1 5.1 0s3.4 2.1 5.1 0 3.4-2.1 4.3-.7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>
      </span>
      <span
        className={cn(
          'font-display text-[0.9375rem] font-semibold tracking-[-0.02em]',
          brand ? 'text-white' : 'text-foreground',
        )}
      >
        {SITE.name}
      </span>
    </span>
  )
}

/* ==========================================================================
   BRAND PANEL — a photograph of the trade, one operator's words over it.
   ========================================================================== */

/** The marketing copy carries typographic entities; the panel renders text. */
const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&amp;': '&',
}

function decodeEntities(input: string) {
  return input.replace(/&(?:rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip|amp);/g, (match) => ENTITIES[match] ?? match)
}

/** Four operators from four trades, each with the picture of their day. */
const PANEL_STORIES: { id: string; trade: string; photo: Photo }[] = [
  { id: 'tst-3', trade: 'Restaurants', photo: PHOTOS.restaurantRoom },
  { id: 'tst-4', trade: 'Adventure', photo: PHOTOS.summitLedge },
  { id: 'tst-1', trade: 'Watersports', photo: PHOTOS.barrel },
  { id: 'tst-6', trade: 'Charters', photo: PHOTOS.goldenShore },
]

const TRUST_STAT_LABELS = ['Processed for operators', 'Experiences live', 'Checkout uptime'] as const

const ROTATE_MS = 7600

function BrandPanel() {
  const reducedMotion = useReducedMotionSafe()

  const stories = React.useMemo(
    () =>
      PANEL_STORIES.map((story) => {
        const testimonial = TESTIMONIALS.find((t) => t.id === story.id)
        return testimonial ? { ...story, testimonial } : null
      }).filter((s): s is NonNullable<typeof s> => s !== null),
    [],
  )

  const trustPoints = React.useMemo(
    () =>
      TRUST_STAT_LABELS.map((label) => STATS.find((s) => s.label === label)).filter(
        (s): s is (typeof STATS)[number] => Boolean(s),
      ),
    [],
  )

  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    // Paused entirely under prefers-reduced-motion — an auto-advancing panel is
    // motion whether or not it is animated.
    if (reducedMotion || stories.length < 2) return
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % stories.length)
    }, ROTATE_MS)
    return () => window.clearInterval(timer)
  }, [reducedMotion, stories.length])

  const active = stories[index] ?? stories[0]
  if (!active) return null
  const quote = active.testimonial

  const transition = reducedMotion ? { duration: 0 } : { duration: DURATION.slow, ease: EASE_OUT_EXPO }

  return (
    <div className="relative isolate flex h-full flex-col justify-between overflow-hidden bg-navy-deep px-10 py-10 text-white xl:px-14 xl:py-12">
      {/* ---------- photograph, cut slowly between stories ---------- */}
      <AnimatePresence initial={false}>
        <motion.div
          key={active.id}
          className="absolute inset-0 -z-20"
          initial={reducedMotion ? false : { opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 1.2, ease: EASE_OUT_EXPO }}
        >
          <Image
            src={photoUrl(active.photo, 1600, 72)}
            alt=""
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 55vw, 0px"
            className="object-cover"
            style={{ objectPosition: active.photo.focus }}
          />
        </motion.div>
      </AnimatePresence>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-navy-deep/60" />

      {/* ---------- top ---------- */}
      <div className="relative flex items-center justify-between gap-4">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-navy-deep"
        >
          <AuthWordmark tone="brand" />
          <span className="sr-only">{`${SITE.name} home`}</span>
        </Link>

        <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1.5 text-[0.6875rem] font-semibold tracking-[0.06em] text-white uppercase ring-1 ring-white/15 backdrop-blur-sm">
          <span aria-hidden="true" className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-accent" />
            {!reducedMotion ? (
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
            ) : null}
          </span>
          Live in a weekend
        </span>
      </div>

      {/* ---------- the story ---------- */}
      <div className="relative flex flex-1 items-end py-12">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              key={active.id}
              initial={reducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -12 }}
              transition={transition}
              className="gpu"
            >
              <span className="inline-flex items-center rounded-full bg-white/12 px-2.5 py-1 text-[0.625rem] font-semibold tracking-[0.1em] text-white/90 uppercase ring-1 ring-white/15">
                {active.trade}
              </span>

              <blockquote className="mt-5 font-serif text-[1.75rem] leading-[1.15] tracking-[-0.01em] text-balance text-white xl:text-[2.25rem]">
                “{decodeEntities(quote.quote)}”
              </blockquote>

              <figcaption className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3">
                <Avatar name={quote.author} src={quote.avatarUrl} size="md" className="ring-2 ring-white/30" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{quote.author}</p>
                  <p className="truncate text-xs text-white/70">
                    {quote.role} · {quote.company}
                  </p>
                </div>

                {quote.metric ? (
                  <div className="ml-auto shrink-0 rounded-xl bg-accent px-3.5 py-2 text-right text-on-accent">
                    <p className="font-display text-lg leading-none font-semibold tracking-[-0.02em] tabular-nums">
                      {quote.metric.value}
                    </p>
                    <p className="mt-1 text-[0.625rem] leading-tight opacity-85">{quote.metric.label}</p>
                  </div>
                ) : null}
              </figcaption>

              <div className="mt-5 flex items-center gap-1" aria-label={`Rated ${quote.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    aria-hidden="true"
                    className={cn('size-3.5', i < quote.rating ? 'fill-sunset-400 text-sunset-400' : 'text-white/30')}
                  />
                ))}
              </div>
            </motion.figure>
          </AnimatePresence>

          {stories.length > 1 ? (
            <div className="mt-8 flex items-center gap-2">
              {stories.map((story, i) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show the story from ${story.testimonial.company}`}
                  aria-current={i === index || undefined}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-out-expo)]',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-navy-deep',
                    i === index ? 'w-10 bg-white' : 'w-4 bg-white/30 hover:bg-white/60',
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------- trust points ---------- */}
      <dl className="relative grid grid-cols-3 gap-6 border-t border-white/15 pt-7">
        {trustPoints.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="sr-only">{stat.label}</dt>
            <dd>
              <span className="block font-display text-xl leading-none font-semibold tracking-[-0.025em] text-white tabular-nums xl:text-2xl">
                {stat.value}
              </span>
              <span className="mt-2 block text-xs leading-snug text-white/65">{stat.label}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ==========================================================================
   SHELL
   ========================================================================== */

export interface AuthShellProps {
  /** The page's h1. */
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Small caps line above the title. */
  eyebrow?: React.ReactNode
  /** The form. */
  children: React.ReactNode
  /** Replaces the default legal line under the form column. */
  footer?: React.ReactNode
  /** Replaces the whole brand panel on the right. */
  side?: React.ReactNode
  className?: string
}

/**
 * The split-screen surface behind sign in, sign up and password recovery.
 *
 * Left: a quiet, single-column form on the app's own background, so the moment
 * the operator lands in the dashboard nothing about the chrome changes.
 * Right (lg and up): a photograph of one of the trades with an operator's
 * story over it, and the three numbers that matter.
 */
export function AuthShell({ title, subtitle, eyebrow, children, footer, side, className }: AuthShellProps) {
  // Sourced from the demo clock so the footer never disagrees with the data.
  const year = NOW.getFullYear()

  return (
    <div
      className={cn(
        'min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]',
        className,
      )}
    >
      {/* ---------- Form column ---------- */}
      <div className="relative isolate flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:min-h-0 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="-m-1 rounded-lg p-1 transition-opacity duration-200 hover:opacity-80">
            <AuthWordmark />
            <span className="sr-only">{`${SITE.name} home`}</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-12 sm:py-16">
          <div className="w-full max-w-md">
            {eyebrow ? (
              <p className="mb-3 text-[0.6875rem] font-semibold tracking-[0.12em] text-primary uppercase">{eyebrow}</p>
            ) : null}

            <h1 className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-[2rem]">
              {title}
            </h1>

            {subtitle ? <p className="mt-3 text-sm leading-relaxed text-pretty text-muted">{subtitle}</p> : null}

            <div className="mt-8">{children}</div>
          </div>
        </main>

        <footer className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
          {footer ?? (
            <>
              <p className="text-xs text-faint">
                © {year} {SITE.name}. All rights reserved.
              </p>
              <nav aria-label="Legal" className="flex items-center gap-4">
                <Link href="/legal/privacy" className="text-xs text-faint transition-colors duration-200 hover:text-foreground">
                  Privacy
                </Link>
                <Link href="/legal/terms" className="text-xs text-faint transition-colors duration-200 hover:text-foreground">
                  Terms
                </Link>
                <Link href="/help" className="text-xs text-faint transition-colors duration-200 hover:text-foreground">
                  Help
                </Link>
              </nav>
            </>
          )}
        </footer>
      </div>

      {/* ---------- Brand column ---------- */}
      <aside className="relative hidden lg:block" aria-label="Why operators switch to EZRA Pro">
        <div className="sticky top-0 h-dvh">{side ?? <BrandPanel />}</div>
      </aside>
    </div>
  )
}
