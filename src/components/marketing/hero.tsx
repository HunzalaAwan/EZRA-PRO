'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, Check, ChevronDown, Play, TrendingUp } from 'lucide-react'

import { BookingWidgetPreview } from '@/components/marketing/booking-widget-preview'
import { AuroraBackground, GlowOrb, GridBackground, NoiseOverlay } from '@/components/motion/backgrounds'
import type { BrandColor } from '@/components/motion/backgrounds'
import { Magnetic } from '@/components/motion/magnetic'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { TypewriterText } from '@/components/motion/text-effects'
import { TiltCard } from '@/components/motion/tilt-card'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { HERO } from '@/content/marketing'
import { DURATION, EASE_OUT_EXPO, STAGGER } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The hero.
 *
 * Composition notes, because the details are the point:
 *
 *  - Three background layers — grid, aurora, grain — with a radial scrim
 *    between the aurora and the content. The scrim is what keeps body copy at
 *    AA over the brightest part of the glow in both themes; without it the
 *    coral blob eats the subhead.
 *  - The entrance is one cascade, not five independent fades: the copy column
 *    is a `StaggerGroup`, and the product shot is timed to land just after the
 *    last rung of that cascade.
 *  - `blur={false}` on anything whose subtree contains a glass surface. A
 *    `filter` on an ancestor — even `blur(0px)` — creates a backdrop root, and
 *    the glass inside would sample nothing for the rest of the page's life.
 */

/* Hoisted: an inline array literal is a new identity every render, which would
   thrash the memo inside <AuroraBackground>. */
const AURORA_PALETTE: BrandColor[] = ['lagoon', 'coral', 'reef']
const HEADLINE_ROTATORS: string[] = [...HERO.headlineRotators]
const MICRO_PROOF: string[] = HERO.microProof.split(' · ')

export interface HeroProps {
  className?: string
}

export function Hero({ className }: HeroProps) {
  const reducedMotion = useReducedMotionSafe()

  return (
    <section
      className={cn(
        'relative isolate flex min-h-[92svh] items-center overflow-hidden bg-background',
        className,
      )}
    >
      {/* ---------- Atmosphere ---------- */}
      <GridBackground fade="radial" beams={2} seed="ezra-hero-grid" />
      <AuroraBackground seed="ezra-hero" blobs={5} intensity="medium" palette={AURORA_PALETTE} />
      {/* Readability scrim: pulls the page ground back over the brightest
          region so the headline and subhead keep their contrast ratio. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_82%_66%_at_36%_44%,color-mix(in_oklab,var(--bg)_68%,transparent)_0%,transparent_74%)]"
      />
      <NoiseOverlay opacity={0.04} />
      {/* Dissolve into whatever section follows. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-[linear-gradient(to_top,var(--bg),transparent)]"
      />

      {/* Container geometry matches the site header and every other marketing
          section, so the hero sits on the same vertical rhythm and gutter. */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8 lg:pb-28 lg:pt-32">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.82fr)] lg:gap-14 xl:gap-16">
          {/* ================= Copy column ================= */}
          <StaggerGroup
            stagger={STAGGER.loose}
            startDelay={0.1}
            className="flex flex-col items-center text-center lg:items-start lg:text-left"
          >
            {/* ---------- Eyebrow ---------- */}
            <StaggerItem blur={false} distance={10} className="max-w-full">
              <div className="glass inline-flex max-w-full flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full px-3 py-1.5 shadow-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="relative inline-flex size-2 shrink-0">
                    {!reducedMotion ? (
                      <span className="animate-pulse-ring absolute inset-0 rounded-full bg-primary" />
                    ) : null}
                    <span className="relative size-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-xs font-medium text-muted">{HERO.eyebrow}</span>
                </span>
                <span aria-hidden="true" className="hidden h-3.5 w-px bg-line-strong sm:block" />
                <Link
                  href="/product/analytics"
                  className="group/new inline-flex items-center gap-1 rounded-full text-xs font-semibold text-primary transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-primary-hover"
                >
                  What&rsquo;s new
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/new:translate-x-0.5"
                  />
                </Link>
              </div>
            </StaggerItem>

            {/* ---------- Headline ---------- */}
            <StaggerItem
              as="h1"
              distance={18}
              className="mt-6 font-display text-display-sm font-semibold text-foreground sm:mt-7 sm:text-display-md xl:text-[4.5rem] xl:leading-[1.02] xl:tracking-[-0.034em]"
            >
              <span className="block text-balance">{HERO.headlineLead}</span>
              <span className="mt-1 block sm:mt-2">
                <TypewriterText
                  phrases={HEADLINE_ROTATORS}
                  className="text-gradient-brand"
                  caretClassName="bg-accent"
                  typingSpeed={58}
                  deletingSpeed={26}
                  holdDuration={2100}
                />
              </span>
            </StaggerItem>

            {/* ---------- Subhead ---------- */}
            <StaggerItem
              as="p"
              distance={14}
              className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:mt-7 sm:text-lg"
            >
              {HERO.subhead}
            </StaggerItem>

            {/* ---------- CTAs ---------- */}
            <StaggerItem
              distance={14}
              className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4"
            >
              <Magnetic strength={0.3} radius={80} maxDisplacement={14} className="w-full sm:w-auto">
                <Button
                  asChild
                  size="lg"
                  fullWidth
                  className="sm:w-auto"
                  rightIcon={
                    <ArrowRight
                      aria-hidden="true"
                      className="transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/button:translate-x-0.5"
                    />
                  }
                >
                  <Link href={HERO.primaryCta.href}>{HERO.primaryCta.label}</Link>
                </Button>
              </Magnetic>

              <Button
                asChild
                size="lg"
                variant="outline"
                fullWidth
                className="sm:w-auto"
                leftIcon={
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-primary transition-colors duration-200 ease-[var(--ease-out-expo)] group-hover/button:bg-primary group-hover/button:text-on-primary"
                  >
                    <Play className="size-2.5" fill="currentColor" strokeWidth={0} />
                  </span>
                }
              >
                <Link href={HERO.secondaryCta.href}>{HERO.secondaryCta.label}</Link>
              </Button>
            </StaggerItem>

            {/* ---------- Micro-proof ---------- */}
            <StaggerItem
              as="ul"
              distance={10}
              className="mt-7 flex flex-col items-center gap-x-5 gap-y-2 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start"
            >
              {MICRO_PROOF.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-[0.8125rem] text-subtle">
                  <Check aria-hidden="true" className="size-3.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </StaggerItem>
          </StaggerGroup>

          {/* ================= Product shot ================= */}
          <Reveal
            direction="up"
            distance={44}
            duration={DURATION.slower}
            delay={0.56}
            blur={false}
            className="relative mx-auto w-full max-w-[26rem] lg:ml-auto lg:mr-0"
          >
            <GlowOrb color="lagoon" size={380} opacity={0.34} blur={86} className="-right-20 -top-16" />
            <GlowOrb
              color="coral"
              size={300}
              opacity={0.22}
              blur={80}
              float={false}
              className="-bottom-20 -left-16"
            />
            {/* Contact shadow: the card reads as hovering over the page. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 -bottom-6 -z-10 h-24 rounded-[50%] bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--primary)_38%,transparent)_0%,transparent_72%)] blur-2xl"
            />

            <div className={cn(!reducedMotion && 'animate-float-slow')}>
              <TiltCard
                maxTilt={7}
                hoverScale={1.012}
                perspective={1200}
                glareOpacity={0.18}
                innerClassName="rounded-3xl"
              >
                <BookingWidgetPreview />
              </TiltCard>
            </div>

            {/* Floating proof chip — drifts on a different clock to the card,
                which is what makes the pair read as depth rather than a sticker. */}
            <div
              className={cn(
                'pointer-events-none absolute -bottom-5 -left-3 hidden sm:block lg:-left-8',
                !reducedMotion && 'animate-float',
              )}
            >
              <div className="glass-strong flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 shadow-xl">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                  <TrendingUp aria-hidden="true" className="size-4" />
                </span>
                <div className="leading-tight">
                  <p className="tabular font-display text-sm font-semibold text-foreground">+31%</p>
                  <p className="text-xs text-subtle">direct bookings</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* ---------- Scroll cue ---------- */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-7 hidden justify-center lg:flex"
      >
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.slow, delay: 1.2, ease: EASE_OUT_EXPO }}
        >
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-faint">
            Scroll
          </span>
          <motion.span
            className="grid size-7 place-items-center rounded-full border border-line text-subtle"
            animate={reducedMotion ? undefined : { y: [0, 5, 0] }}
            transition={
              reducedMotion
                ? undefined
                : { duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }
            }
          >
            <ChevronDown className="size-3.5" />
          </motion.span>
        </motion.div>
      </div>
    </section>
  )
}
