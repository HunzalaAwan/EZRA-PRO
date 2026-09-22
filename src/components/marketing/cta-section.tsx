'use client'

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { AuroraBackground, NoiseOverlay, WaveDivider } from '@/components/motion/backgrounds'
import { Magnetic } from '@/components/motion/magnetic'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'
import { FINAL_CTA } from '@/content/marketing'
import { cn } from '@/lib/utils'

/* ==========================================================================
   FINAL CTA

   CONTRAST NOTE — this band is deliberately dark in BOTH themes rather than
   flipping with the palette. A gradient that re-tints per theme cannot be
   verified once, and a light-theme brand gradient is exactly where white text
   quietly fails AA.

   Every stop is drawn from the 800–950 end of the brand ramps, whose
   luminance sits between roughly 0.017 and 0.092 — white text lands between
   7:1 and 15:1 against them. The aurora is the only thing that can lighten
   the ground, so it is capped at half opacity and a dark radial scrim is
   painted over it, which pulls the centre back under 0.06 luminance where the
   headline and body sit. Body copy is never lighter than white/85 (≈5:1).
   ========================================================================== */

export interface CtaSectionProps {
  id?: string
  className?: string
}

export function CtaSection({ id = 'get-started', className }: CtaSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        'relative isolate overflow-hidden',
        'bg-[linear-gradient(115deg,var(--color-lagoon-950)_0%,var(--color-lagoon-900)_20%,var(--color-reef-900)_52%,var(--color-coral-900)_84%,var(--color-coral-800)_100%)]',
        className,
      )}
    >
      {/* Drifting brand light, held at half strength so it never lifts the
          ground far enough to threaten the text contrast. */}
      <AuroraBackground
        seed="ezra-final-cta"
        blobs={5}
        intensity="subtle"
        className="opacity-50"
      />

      {/* Scrim: a vignette that both adds depth and guarantees the centre of
          the band stays dark under the aurora. */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 -z-10',
          'bg-[radial-gradient(ellipse_82%_76%_at_50%_50%,color-mix(in_oklab,var(--color-ink-975)_58%,transparent)_0%,color-mix(in_oklab,var(--color-ink-975)_26%,transparent)_58%,transparent_100%)]',
        )}
      />

      <NoiseOverlay opacity={0.05} />

      <WaveDivider
        flip
        color="text-background"
        height={72}
        className="absolute inset-x-0 top-0 z-[1]"
      />

      <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-20 pt-28 text-center sm:px-6 sm:pb-24 sm:pt-32 lg:px-8">
        <Reveal direction="up" blur>
          <span
            className={cn(
              'inline-flex items-center gap-2.5 rounded-full border border-white/20 px-3.5 py-1.5',
              'bg-[color-mix(in_oklab,var(--color-ink-975)_45%,transparent)] backdrop-blur-sm',
              'text-xs font-semibold uppercase tracking-[0.16em] text-white',
            )}
          >
            <span aria-hidden="true" className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-white/70" />
              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
            </span>
            {FINAL_CTA.eyebrow}
          </span>
        </Reveal>

        <Reveal
          as="h2"
          direction="up"
          blur
          delay={0.06}
          className="mt-7 font-display text-display-md font-semibold tracking-[-0.03em] text-balance text-white sm:text-display-lg"
        >
          {FINAL_CTA.headline}
        </Reveal>

        <Reveal
          as="p"
          direction="up"
          delay={0.12}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-white/85 sm:text-lg"
        >
          {FINAL_CTA.body}
        </Reveal>

        <Reveal
          direction="up"
          delay={0.18}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <Magnetic strength={0.3} radius={80} className="w-full sm:w-auto">
            <Button
              asChild
              fullWidth
              size="xl"
              variant="secondary"
              rightIcon={<ArrowRight aria-hidden="true" />}
              className={cn(
                'border-transparent bg-white text-ink-950 shadow-lg',
                'hover:border-transparent hover:bg-lagoon-50 hover:text-ink-950 hover:shadow-xl',
                'active:bg-lagoon-100 active:shadow-md',
                'focus-visible:ring-white focus-visible:ring-offset-transparent',
                'sm:w-auto',
              )}
            >
              <Link href={FINAL_CTA.primary.href}>{FINAL_CTA.primary.label}</Link>
            </Button>
          </Magnetic>

          <Button
            asChild
            fullWidth
            size="xl"
            variant="ghost"
            className={cn(
              'border border-white/30 text-white',
              'hover:border-white/45 hover:bg-white/12 hover:text-white',
              'active:bg-white/18',
              'focus-visible:ring-white focus-visible:ring-offset-transparent',
              'sm:w-auto',
            )}
          >
            <Link href={FINAL_CTA.secondary.href}>{FINAL_CTA.secondary.label}</Link>
          </Button>
        </Reveal>

        <StaggerGroup
          as="ul"
          stagger={0.07}
          startDelay={0.26}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
        >
          {FINAL_CTA.reassurance.map((item) => (
            <StaggerItem
              as="li"
              key={item}
              distance={10}
              className="flex items-center gap-2 text-sm font-medium text-white/90"
            >
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Check className="size-3 text-white" strokeWidth={3} aria-hidden="true" />
              </span>
              {item}
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
