'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useInView } from 'motion/react'
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  FileCheck2,
  ListOrdered,
  MessageSquareText,
  Package,
  Play,
  Repeat2,
  ShoppingCart,
  Ticket,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HeroStage } from './hero-stage'
import { LAND_VERTICALS, type LandVerticalKey } from './verticals'

/* ==========================================================================
   LandHero — the claim, then the product.

   One centred column on a pale violet ground: a large headline that finishes
   itself with a different trade every few seconds, one paragraph, two
   buttons and a line of small print. Either side of it, on wide screens, a
   photograph of that trade with two pieces of the product laid over it; the
   photographs and the chips change with the word. Behind everything, three
   flat pastel shapes. Under it, the stage: a field of colour with a deck
   of four cards, one piece of the product each.
   ========================================================================== */

const CYCLE_MS = 3600

const SHAPES = [
  {
    className: 'left-[-8%] top-[6%] h-[26rem] w-[34rem] rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-cal-sky',
    drift: { x: [0, 22, 0], y: [0, -16, 0], rotate: [0, 6, 0] },
    duration: 18,
  },
  {
    className: 'right-[-10%] top-[0%] h-[22rem] w-[30rem] rounded-[55%_45%_50%_50%/45%_55%_45%_55%] bg-cal-honeydew',
    drift: { x: [0, -18, 0], y: [0, 14, 0], rotate: [0, -5, 0] },
    duration: 21,
  },
  {
    className: 'left-[62%] top-[48%] h-[16rem] w-[24rem] rounded-[50%_50%_45%_55%/60%_40%_60%_40%] bg-cal-lavender',
    drift: { x: [0, 12, 0], y: [0, 18, 0], rotate: [0, 4, 0] },
    duration: 24,
  },
] as const

interface Chip {
  icon: LucideIcon
  tone: 'primary' | 'success' | 'ink'
  title: string
  detail: string
}

/** What each trade shows either side of the headline. */
interface Scene {
  left: Photo
  right: Photo
  /** Above the left photograph. */
  leftNote: Chip
  /** Across the right photograph's lower edge. */
  rightChip: Chip
  /** Above the right photograph. */
  rightNote: Chip
}

const SCENES: Record<LandVerticalKey, Scene> = {
  tours: {
    left: PHOTOS.kayakSunset,
    right: PHOTOS.kayakGolden,
    leftNote: { icon: FileCheck2, tone: 'success', title: 'Waivers signed', detail: '2 of 2, before the slip' },
    rightChip: { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$4,128.40 · Bank of Maui ····4412' },
    rightNote: { icon: Users, tone: 'primary', title: 'Guide roster', detail: 'Mara takes the 06:40' },
  },
  restaurants: {
    left: PHOTOS.chefPlating,
    right: PHOTOS.waitressOrder,
    leftNote: { icon: Utensils, tone: 'success', title: 'Allergy noted', detail: 'Nut allergy, on the ticket' },
    rightChip: { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$6,240.00 · two sittings' },
    rightNote: { icon: ListOrdered, tone: 'primary', title: 'Table 9 resold', detail: 'From the waitlist, in order' },
  },
  events: {
    left: PHOTOS.weddingVenue,
    right: PHOTOS.villaWedding,
    leftNote: { icon: Users, tone: 'success', title: 'Seating chart', detail: 'Shared with 120 guests' },
    rightChip: { icon: Wallet, tone: 'ink', title: 'Balance collected', detail: '$18,400 · on 1 Oct' },
    rightNote: { icon: CalendarCheck2, tone: 'primary', title: 'Vendor schedule', detail: 'Sent to 6 suppliers' },
  },
  classes: {
    left: PHOTOS.potteryClass,
    right: PHOTOS.chefClass,
    leftNote: { icon: Package, tone: 'success', title: 'Kit reserved', detail: '8 wheels, 8 aprons' },
    rightChip: { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$1,360.00 · four classes' },
    rightNote: { icon: Repeat2, tone: 'primary', title: 'Waitlist', detail: '2 notified, 1 took the seat' },
  },
  wellness: {
    left: PHOTOS.sunsetYoga,
    right: PHOTOS.yogaSea,
    leftNote: { icon: Ticket, tone: 'success', title: 'Class pack', detail: '1 of 10 credits used' },
    rightChip: { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$2,910.00 · Bank of Maui ····4412' },
    rightNote: { icon: Repeat2, tone: 'primary', title: 'Memberships renewed', detail: '212 of 220 overnight' },
  },
  venues: {
    left: PHOTOS.rooftopBar,
    right: PHOTOS.confettiCrowd,
    leftNote: { icon: MessageSquareText, tone: 'success', title: 'Text confirmation', detail: 'Delivered 14:02' },
    rightChip: { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$3,480.00 · Friday terrace' },
    rightNote: { icon: Check, tone: 'primary', title: 'Minimum spend', detail: '$50 held on the card' },
  },
}

const TONE: Record<Chip['tone'], string> = {
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-white',
  ink: 'bg-foreground text-background',
}

function ChipCard({ chip, className }: { chip: Chip; className?: string }) {
  const Icon = chip.icon
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]', className)}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE[chip.tone])}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{chip.title}</span>
        <span className="block truncate text-[0.75rem] text-subtle">{chip.detail}</span>
      </span>
    </div>
  )
}

/** A chip that swaps with the trade: the old one drops out, the new one rises in. */
function SwapChip({ id, chip, reduce, className }: { id: string; chip: Chip; reduce: boolean; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={id}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        >
          <ChipCard chip={chip} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function SideScene({
  align,
  active,
  reduce,
  delay,
  chip,
  note,
}: {
  align: 'left' | 'right'
  active: LandVerticalKey
  reduce: boolean
  delay: number
  chip: Chip
  note: Chip
}) {
  const drift = align === 'left' ? [0, -8, 0] : [0, 7, 0]
  return (
    <motion.div
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: EASE_OUT_EXPO }}
      className={cn('absolute top-2 hidden w-[13.5rem] xl:block 2xl:w-[15rem]', align === 'left' ? 'left-8 2xl:-left-4' : 'right-8 2xl:-right-4')}
    >
      <motion.div
        animate={reduce ? undefined : { y: drift }}
        transition={reduce ? undefined : { duration: align === 'left' ? 8.5 : 9.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative will-change-transform"
      >
        <SwapChip id={`${active}-note`} chip={note} reduce={reduce} className={cn('z-10 mb-3 w-[13rem]', align === 'left' ? 'ml-6' : 'mr-6')} />

        {/* every trade's photograph is mounted, so a swap is a crossfade and never a load */}
        <figure
          className="relative m-0 aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-surface-sunken shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06]"
          style={{ transform: `rotate(${align === 'left' ? -4 : 4}deg)` }}
        >
          {LAND_VERTICALS.map((v, i) => {
            const photo = align === 'left' ? SCENES[v.key].left : SCENES[v.key].right
            const shown = v.key === active
            return (
              <motion.div
                key={v.key}
                initial={false}
                animate={{ opacity: shown ? 1 : 0, scale: shown ? 1 : 1.04 }}
                transition={reduce ? { duration: 0 } : { duration: 0.7, ease: EASE_OUT_EXPO }}
                className="absolute inset-0"
                style={{ zIndex: shown ? 1 : 0 }}
              >
                <Image
                  src={photoUrl(photo, 1200, 82)}
                  alt=""
                  fill
                  priority={i === 0}
                  sizes="(min-width: 1536px) 15rem, 13.5rem"
                  className="object-cover"
                  style={{ objectPosition: photo.focus }}
                />
              </motion.div>
            )
          })}
        </figure>

        <SwapChip id={`${active}-chip`} chip={chip} reduce={reduce} className={cn('absolute -bottom-5 z-10 w-[15rem]', align === 'left' ? 'left-8' : 'right-8')} />
      </motion.div>
    </motion.div>
  )
}

export function LandHero() {
  const reduce = useReducedMotionSafe()
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const inView = useInView(headingRef, { amount: 0.5 })
  const [index, setIndex] = React.useState(0)
  const current = LAND_VERTICALS[index]
  const scene = SCENES[current.key]

  React.useEffect(() => {
    if (reduce || !inView) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % LAND_VERTICALS.length), CYCLE_MS)
    return () => window.clearInterval(id)
  }, [reduce, inView])

  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  })

  const bookingChip: Chip = {
    icon: ShoppingCart,
    tone: 'primary',
    title: 'New booking',
    detail: `${current.booking.title} · ${current.booking.when}`,
  }

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-cal-rain pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20">
      {/* the ground, alive */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] overflow-hidden">
        {SHAPES.map((shape, i) => (
          <motion.span
            key={i}
            animate={reduce ? undefined : { x: [...shape.drift.x], y: [...shape.drift.y], rotate: [...shape.drift.rotate] }}
            transition={reduce ? undefined : { duration: shape.duration, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute opacity-70 will-change-transform ${shape.className}`}
          />
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SideScene align="left" active={current.key} reduce={reduce} delay={0.35} chip={bookingChip} note={scene.leftNote} />
        <SideScene align="right" active={current.key} reduce={reduce} delay={0.45} chip={scene.rightChip} note={scene.rightNote} />

        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.h1
            ref={headingRef}
            id="hero-title"
            {...enter(0)}
            className="font-display text-[2.875rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.5rem] xl:text-[5rem]"
          >
            Take bookings for your{' '}
            <span className="relative inline-grid overflow-hidden align-top">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current.key}
                  className="col-start-1 row-start-1 whitespace-nowrap text-primary"
                  initial={reduce ? false : { y: '0.7em', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? undefined : { y: '-0.7em', opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                >
                  {current.word}.
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p {...enter(0.08)} className="mt-7 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem] lg:text-[1.375rem]">
            Availability, deposits, staff rosters and next-day payouts for tours, restaurants, events, classes
            and venues. One inventory behind your website, the marketplaces and the phone.
          </motion.p>

          <motion.div {...enter(0.16)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="ink" size="xl" className="rounded-[10px] px-7" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild variant="secondary" size="xl" className="rounded-[10px] px-7" leftIcon={<Play aria-hidden="true" />}>
              <Link href="/dashboard">See it running</Link>
            </Button>
          </motion.div>

          <motion.p {...enter(0.22)} className="mt-5 text-[0.875rem] text-subtle">
            No card to start · Free migration from FareHarbor, Peek Pro, OpenTable or Eventbrite
          </motion.p>
        </div>

      </div>

      <motion.div {...enter(0.3)} className="mx-auto mt-16 w-full max-w-[96rem] px-3 sm:mt-20 sm:px-5 lg:px-6 xl:mt-24">
        <HeroStage />
      </motion.div>
    </section>
  )
}
