'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react'
import { Check } from 'lucide-react'

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   SceneReel — three moments, one pinned frame.

   The section is tall and the frame inside it sticks, so scrolling plays the
   photographs like a slow cut: each one grows in, holds while its sentence is
   read, then gives way. The sentences are the product's argument — the thing
   it did while nobody was looking. Reduced motion gets the same three
   moments stacked and still.
   ========================================================================== */

interface Frame {
  key: string
  time: string
  label: string
  photo: Photo
  line: string
  did: string[]
}

const FRAMES: Frame[] = [
  {
    key: 'dawn',
    time: '05:52',
    label: 'Before dawn',
    photo: PHOTOS.balloonSunrise,
    line: 'The 06:40 flight sold its last two seats while the pilot was still asleep.',
    did: [
      'Website and Viator drew from one basket of seats',
      'Both guests texted the meeting point',
      'Crew roster updated for the extra weight',
    ],
  },
  {
    key: 'service',
    time: '17:10',
    label: 'Before service',
    photo: PHOTOS.dinnerService,
    line: 'A table of four cancelled at ten past five. It was resold from the waitlist before the first cover sat down.',
    did: [
      'Deposit kept, under the policy you set',
      'Waitlist offered the slot, in order',
      'Floor plan updated at the host stand',
    ],
  },
  {
    key: 'gala',
    time: 'Saturday',
    label: 'The big night',
    photo: PHOTOS.weddingHall,
    line: 'Three hundred guests, two entrances, one list that everyone on the floor can see.',
    did: [
      'QR check-in at both doors',
      'Seating chart on every phone',
      'Balance collected two weeks out',
    ],
  },
]

/* --------------------------------------------------------------------------
   One photograph, faded and scaled by where the section is in the scroll.
   -------------------------------------------------------------------------- */

function ReelPhoto({ frame, index, progress }: { frame: Frame; index: number; progress: MotionValue<number> }) {
  const n = FRAMES.length
  const first = index === 0
  const last = index === n - 1
  // Scroll-linked values become native animations, so every stop must sit in 0–1.
  const start = index / n
  const end = (index + 1) / n
  const fadeIn = [Math.max(0, start - 0.05), start + 0.03]
  const fadeOut = [end - 0.03, Math.min(1, end + 0.05)]

  const opacity = useTransform(
    progress,
    first ? [0, fadeOut[0], fadeOut[1]] : last ? [fadeIn[0], fadeIn[1], 1] : [...fadeIn, ...fadeOut],
    first ? [1, 1, 0] : last ? [0, 1, 1] : [0, 1, 1, 0],
  )
  const scale = useTransform(progress, [Math.max(0, start - 0.05), Math.min(1, end + 0.05)], [1.14, 1])

  return (
    <motion.div style={{ opacity, scale }} className="absolute inset-0 will-change-transform">
      <Image
        src={photoUrl(frame.photo, 2000, 72)}
        alt={frame.photo.alt}
        fill
        sizes="100vw"
        priority={index === 0}
        className="object-cover"
        style={{ objectPosition: frame.photo.focus }}
      />
    </motion.div>
  )
}

/* --------------------------------------------------------------------------
   The words for the active frame.
   -------------------------------------------------------------------------- */

function FrameCopy({ frame, reduce }: { frame: Frame; reduce: boolean }) {
  return (
    <motion.div
      key={frame.key}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, y: -14 }}
      transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
      className="max-w-3xl"
    >
      <p className="font-mono text-[0.75rem] font-medium tracking-[0.14em] text-white/70 uppercase">
        {frame.time} · {frame.label}
      </p>
      <p className="mt-3 font-serif text-[2rem] leading-[1.08] tracking-[-0.01em] text-balance text-white sm:text-[2.75rem] lg:text-[3.25rem]">
        {frame.line}
      </p>
      <ul className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
        {frame.did.map((item, i) => (
          <motion.li
            key={item}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.25 + i * 0.12, ease: EASE_OUT_EXPO }}
            className="inline-flex items-center gap-2 text-[0.9375rem] text-white/85"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-white">
              <Check aria-hidden="true" className="size-3" strokeWidth={3} />
            </span>
            {item}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}

/* --------------------------------------------------------------------------
   Section
   -------------------------------------------------------------------------- */

export function SceneReel({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [active, setActive] = React.useState(0)

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.min(FRAMES.length - 1, Math.max(0, Math.floor(v * FRAMES.length)))
    setActive((cur) => (cur === next ? cur : next))
  })

  const jumpTo = (i: number) => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const travel = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + (travel * (i + 0.5)) / FRAMES.length, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (reduce) {
    return (
      <section aria-label="Three moments EZRA handles" className={cn('bg-navy-deep text-white', className)}>
        {FRAMES.map((frame) => (
          <div key={frame.key} className="relative isolate min-h-[70vh] overflow-hidden">
            <Image src={photoUrl(frame.photo, 1800, 72)} alt={frame.photo.alt} fill sizes="100vw" className="object-cover" style={{ objectPosition: frame.photo.focus }} />
            <div aria-hidden="true" className="absolute inset-0 bg-navy-deep/60" />
            <div className="relative mx-auto flex min-h-[70vh] max-w-7xl items-end px-4 pb-14 sm:px-6 lg:px-8">
              <FrameCopy frame={frame} reduce />
            </div>
          </div>
        ))}
      </section>
    )
  }

  return (
    <section
      ref={ref}
      aria-label="Three moments EZRA handles"
      className={cn('relative bg-navy-deep text-white', className)}
      style={{ height: `${FRAMES.length * 100 + 40}vh` }}
    >
      <div className="sticky top-0 h-dvh overflow-hidden">
        {FRAMES.map((frame, i) => (
          <ReelPhoto key={frame.key} frame={frame} index={i} progress={scrollYProgress} />
        ))}
        <div aria-hidden="true" className="absolute inset-0 bg-navy-deep/60" />

        <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end gap-8 px-4 pb-12 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:pb-16">
          <div className="min-h-[15rem] sm:min-h-[17rem]">
            <AnimatePresence mode="wait" initial={false}>
              <FrameCopy key={FRAMES[active].key} frame={FRAMES[active]} reduce={false} />
            </AnimatePresence>
          </div>

          {/* rail */}
          <ol aria-label="Moments" className="flex shrink-0 gap-2 lg:flex-col lg:gap-3">
            {FRAMES.map((frame, i) => {
              const isActive = i === active
              return (
                <li key={frame.key}>
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'group flex min-h-11 items-center gap-3 rounded-full px-3 py-2 text-left text-[0.8125rem] font-semibold transition-colors duration-300',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
                      isActive ? 'bg-white text-navy-deep' : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('h-1 rounded-full transition-all duration-500', isActive ? 'w-8 bg-primary' : 'w-3 bg-white/40')}
                    />
                    <span className="font-mono text-[0.75rem] tracking-[0.08em] uppercase">{frame.time}</span>
                    <span className="hidden sm:inline">{frame.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
