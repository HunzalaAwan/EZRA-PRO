'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'

import { CountUp } from '@/components/motion/count-up'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { TESTIMONIALS } from '@/content/marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'
import { PHOTOS, photoUrl } from './photos'

/* ==========================================================================
   ProofBand — platform proof and operator outcomes.
   ========================================================================== */

const FIGURES = [
  { value: 2.4, decimals: 1, prefix: '$', suffix: 'B+', label: 'processed for operators', hint: 'gross booking volume processed' },
  { value: 11800, decimals: 0, prefix: '', suffix: '+', label: 'experiences live', hint: 'active tours & activities globally' },
  { value: 31, decimals: 0, prefix: '+', suffix: '%', label: 'lift in direct bookings', hint: 'median operator increase in 6 mo' },
  { value: 99.98, decimals: 2, prefix: '', suffix: '%', label: 'checkout uptime', hint: 'rolling 90-day availability' },
] as const

const QUOTE = TESTIMONIALS.find((t) => t.id === 'tst-4') ?? TESTIMONIALS[0]

function decode(input: string) {
  return input.replace(/&rsquo;/g, '’').replace(/&amp;/g, '&')
}

export function ProofBand({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', reduce ? '-10%' : '10%'])

  return (
    <section
      ref={ref}
      className={cn('relative isolate overflow-hidden bg-ink-950 py-24 text-white sm:py-32', className)}
      aria-labelledby="proof-title"
    >
      <motion.div style={{ y }} className="absolute -inset-y-[12%] inset-x-0 -z-20">
        <Image
          src={photoUrl(PHOTOS.balloonSunrise, 2000, 70)}
          alt="Sunrise landscape"
          aria-hidden="true"
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: PHOTOS.balloonSunrise.focus }}
        />
      </motion.div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-950/75 backdrop-blur-[2px]" />

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-14 px-6 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-10">
        <Reveal className="lg:col-span-7" distance={16}>
          <h2 id="proof-title" className="sr-only">
            What operators say, and the numbers behind it
          </h2>
          <blockquote>
            <p className="font-serif text-[clamp(1.625rem,3.2vw,2.75rem)] leading-[1.2] text-white text-balance italic">
              “{decode(QUOTE.quote)}”
            </p>
            <footer className="mt-8 flex items-center gap-4">
              <Image
                src={QUOTE.avatarUrl}
                alt={QUOTE.author}
                width={48}
                height={48}
                className="size-12 rounded-full object-cover ring-2 ring-white/20"
              />
              <div>
                <p className="text-[0.9375rem] font-semibold">{QUOTE.author}</p>
                <p className="text-[0.8125rem] text-white/70">
                  {QUOTE.role}, {QUOTE.company}
                </p>
              </div>
              {QUOTE.metric ? (
                <div className="ml-auto hidden text-right sm:block">
                  <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-primary tabular-nums">
                    {QUOTE.metric.value}
                  </p>
                  <p className="text-[0.6875rem] text-white/70">{QUOTE.metric.label}</p>
                </div>
              ) : null}
            </footer>
          </blockquote>
        </Reveal>

        <StaggerGroup
          as="dl"
          stagger={0.1}
          className="grid grid-cols-2 gap-x-6 gap-y-10 border-t border-white/15 pt-10 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10"
        >
          {FIGURES.map((f) => (
            <StaggerItem as="div" key={f.label} distance={14}>
              <dt className="order-2 text-[0.8125rem] text-white/75">{f.label}</dt>
              <dd className="order-1 font-display text-[clamp(2rem,3.4vw,2.75rem)] leading-none font-semibold tracking-[-0.035em] tabular-nums text-white">
                <CountUp
                  value={f.value}
                  decimals={f.decimals}
                  prefix={f.prefix}
                  suffix={f.suffix}
                  format="number"
                  duration={1.6}
                />
              </dd>
              <p className="mt-2 text-[0.6875rem] text-white/50">{f.hint}</p>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
