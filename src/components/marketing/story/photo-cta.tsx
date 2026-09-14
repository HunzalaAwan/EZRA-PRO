'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { FINAL_CTA } from '@/content/marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'
import { PHOTOS, photoUrl } from './photos'

/* ==========================================================================
   PhotoCta — the last frame: the day is over, the sun is down, sign up.
   ========================================================================== */

export function PhotoCta({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', reduce ? '-8%' : '8%'])

  return (
    <section
      ref={ref}
      id="get-started"
      className={cn('relative isolate overflow-hidden bg-ink-950 py-28 text-white sm:py-40', className)}
      aria-labelledby="cta-title"
    >
      <motion.div style={{ y }} className="absolute -inset-y-[10%] inset-x-0 -z-20">
        <Image
          src={photoUrl(PHOTOS.sunsetShore, 2000, 72)}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: PHOTOS.sunsetShore.focus }}
        />
      </motion.div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-950/55" />

      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <Reveal distance={18} className="max-w-3xl">
          <p className="text-[0.75rem] font-semibold tracking-[0.14em] text-lagoon-200 uppercase">
            {FINAL_CTA.eyebrow}
          </p>
          <h2
            id="cta-title"
            className="mt-4 font-display text-[clamp(2.25rem,5.2vw,4.5rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance"
          >
            {FINAL_CTA.headline}
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">{FINAL_CTA.body}</p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" variant="primary" rightIcon={<ArrowRight />}>
              <Link href={FINAL_CTA.primary.href}>{FINAL_CTA.primary.label}</Link>
            </Button>
            <Link
              href={FINAL_CTA.secondary.href}
              className={cn(
                'inline-flex h-12 items-center rounded-full border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm',
                'transition-colors duration-200 hover:bg-white/16',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              )}
            >
              {FINAL_CTA.secondary.label}
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem] text-white/80">
            {FINAL_CTA.reassurance.map((r) => (
              <li key={r} className="inline-flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-3.5 text-lagoon-200" strokeWidth={3} />
                {r}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
