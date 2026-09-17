'use client'

import * as React from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Reveal } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { TESTIMONIALS } from '@/content/marketing'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   CustomerStories — real operators, real numbers.

   One story open at a time: a photograph of the operator, the number that
   changed and their words, on a pastel ground. The other four sit in a
   list beside it; the list advances on its own every seven seconds, stops
   while the pointer is on the section, and a click chooses.
   ========================================================================== */

const HOLD_MS = 7000

interface Story {
  id: string
  photo: Photo
  ground: string
}

const STORIES: Story[] = [
  { id: 'tst-5', photo: PHOTOS.guideGroup, ground: 'bg-cal-cloud' },
  { id: 'tst-3', photo: PHOTOS.chefClass, ground: 'bg-cal-sunbeam' },
  { id: 'tst-6', photo: PHOTOS.scubaDeck, ground: 'bg-cal-seafoam' },
  { id: 'tst-7', photo: PHOTOS.storeTablet, ground: 'bg-cal-haze' },
  { id: 'tst-2', photo: PHOTOS.diverWave, ground: 'bg-cal-honeydew' },
]

const ENTITIES: Record<string, string> = { '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–', '&amp;': '&' }
const decode = (input: string) => input.replace(/&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|amp);/g, (m) => ENTITIES[m] ?? m)

const ITEMS = STORIES.map((story) => ({ story, quote: TESTIMONIALS.find((t) => t.id === story.id) })).filter(
  (item): item is { story: Story; quote: NonNullable<typeof item.quote> } => Boolean(item.quote),
)

export function CustomerStories({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const [active, setActive] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (reduce || !inView || paused) return
    const id = window.setTimeout(() => setActive((i) => (i + 1) % ITEMS.length), HOLD_MS)
    return () => window.clearTimeout(id)
  }, [reduce, inView, paused, active])

  const { story, quote } = ITEMS[active]
  const step = (delta: number) => setActive((i) => (i + delta + ITEMS.length) % ITEMS.length)

  return (
    <section
      ref={ref}
      id="customers"
      aria-labelledby="stories-title"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn('scroll-mt-4 bg-background-subtle py-20 sm:py-24', className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <Reveal as="h2" id="stories-title" blur distance={14} className="font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem] lg:text-[3rem]">
              Real operators. Real numbers.
            </Reveal>
            <Reveal as="p" delay={0.08} distance={12} className="mt-4 text-[1.125rem] leading-[1.45] text-muted">
              What changed for the businesses that moved.
            </Reveal>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label="Previous story" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-foreground transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label="Next story" className="grid size-11 place-items-center rounded-full border border-line bg-surface text-foreground transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-12">
          {/* ---------- the open story ---------- */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.article
                key={quote.id}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                className={cn('grid overflow-hidden rounded-[2rem] sm:grid-cols-2', story.ground)}
              >
                <figure className="relative m-0 aspect-[4/3] sm:aspect-auto sm:min-h-[26rem]">
                  <Image src={photoUrl(story.photo, 1000)} alt={story.photo.alt} fill sizes="(min-width: 1024px) 28rem, 100vw" className="object-cover" style={{ objectPosition: story.photo.focus }} />
                </figure>
                <div className="flex flex-col p-7 sm:p-9">
                  {quote.metric ? (
                    <p>
                      <span className="block font-display text-[2.75rem] leading-none font-medium tracking-[-0.03em] text-foreground tabular-nums sm:text-[3.25rem]">{quote.metric.value}</span>
                      <span className="mt-2 block text-[0.9375rem] text-muted">{quote.metric.label}</span>
                    </p>
                  ) : null}
                  <blockquote className="mt-6 font-serif text-[1.375rem] leading-[1.3] text-foreground sm:text-[1.5rem]">
                    &ldquo;{decode(quote.quote)}&rdquo;
                  </blockquote>
                  <p className="mt-auto pt-6 text-[0.9375rem] text-foreground">
                    <span className="font-medium">{quote.author}</span>
                    <span className="text-muted">
                      {' '}
                      · {quote.role}, {quote.company}
                    </span>
                  </p>
                </div>
              </motion.article>
            </AnimatePresence>
          </div>

          {/* ---------- the others ---------- */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1" aria-label="More stories">
            {ITEMS.map((item, index) => {
              const selected = index === active
              return (
                <li key={item.quote.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActive(index)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-[background-color,box-shadow] duration-300',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      selected ? 'bg-surface shadow-[var(--shadow-md)]' : 'hover:bg-surface/70',
                    )}
                  >
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
                      <Image src={photoUrl(item.story.photo, 200)} alt="" fill sizes="48px" className="object-cover" style={{ objectPosition: item.story.photo.focus }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-medium text-foreground">{item.quote.company}</span>
                      <span className="block truncate text-[0.8125rem] text-muted">
                        {item.quote.metric ? `${item.quote.metric.value} ${item.quote.metric.label}` : item.quote.role}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
