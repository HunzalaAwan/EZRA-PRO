import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Calculator, CircleCheck, Headset, ShieldCheck } from 'lucide-react'

import {
  AuroraBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { CtaSection } from '@/components/marketing/cta-section'
import { PricingSection } from '@/components/marketing/pricing-section'
import { PricingTable } from '@/components/marketing/pricing-table'
import { RoiCalculator } from '@/components/marketing/roi-calculator'
import { SectionHeading } from '@/components/marketing/section-heading'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { FAQS, PRICING_PLANS } from '@/content/marketing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Commission from 3% per booking, platform fees from $0, and free migration on every plan. Compare Starter, Growth, Scale and Enterprise — then run your own numbers in the savings calculator.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    url: '/pricing',
    title: 'EZRA Pro pricing — commission from 3%, migration free',
    description:
      'Starter matches the 6% everyone else charges. Growth drops it to 4.5%, Scale to 3%. No contract, no setup fee, free white-glove migration.',
  },
}

/* ==========================================================================
   ENTITIES

   FAQ answers are authored with HTML entities. React escapes strings, so they
   are resolved to real characters here rather than shipped as markup. A local
   copy rather than an import: `faq-section.tsx` is a `'use client'` module, and
   every export of a client module becomes a client reference when a server
   component imports it — the function would not be callable during render.
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': '’',
  '&amp;': '&',
}

const ENTITY_PATTERN = /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|quot|#39|amp);/g

function decodeEntities(input: string) {
  return input.replace(ENTITY_PATTERN, (match) => ENTITIES[match] ?? match)
}

/* ==========================================================================
   COMMISSION LADDER

   The page's one memorable moment. Commission is the number that decides an
   operator's year, so it gets stated before a single plan card appears: three
   rungs, each bar scaled against the 6% everyone else charges, so the drop is
   something you see rather than something you have to work out.
   ========================================================================== */

const LADDER_BASELINE = 6

const LADDER = PRICING_PLANS.filter((plan) => plan.id !== 'enterprise').map((plan) => ({
  id: plan.id,
  name: plan.name,
  percent: plan.commissionPercent,
  /** Kept share of a $100 booking, to the cent. */
  keeps: (100 - plan.commissionPercent).toFixed(2).replace(/\.00$/, ''),
  width: `${(plan.commissionPercent / LADDER_BASELINE) * 100}%`,
}))

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'No contract, cancel any time' },
  { icon: Calculator, label: 'Free migration on every plan' },
  { icon: Headset, label: 'Support 7 days a week, all plans' },
]

/* ==========================================================================
   PRICING-SPECIFIC FAQ

   The landing page runs the full sixteen. Here only the money questions are
   worth the room, so the set is narrowed to `pricing` and `payments` and
   rendered as a plain server-side accordion — no filter chips to get in the
   way of someone who is already reading a price list.
   ========================================================================== */

const MONEY_FAQS = FAQS.filter(
  (faq) => faq.category === 'pricing' || faq.category === 'payments',
)

export default function PricingPage() {
  return (
    <>
      {/* ================================================================
          PAGE HEADER
          ================================================================ */}
      <section
        aria-labelledby="pricing-page-title"
        className="relative isolate overflow-hidden bg-background pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-24"
      >
        <GridBackground fade="radial" seed="ezra-pricing-grid" className="opacity-70" />
        <AuroraBackground
          seed="ezra-pricing"
          blobs={4}
          intensity="subtle"
          palette={['lagoon', 'reef']}
        />
        <NoiseOverlay opacity={0.035} />
        <GlowOrb
          color="coral"
          size={460}
          opacity={0.13}
          blur={110}
          float={false}
          className="-top-40 right-[-10%]"
        />

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal direction="up" distance={8} blur={false}>
              <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
                <span aria-hidden="true" className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-primary/70" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                </span>
                Transparent pricing
              </span>
            </Reveal>

            <Reveal
              as="h1"
              id="pricing-page-title"
              delay={0.06}
              blur
              className="mt-6 font-display text-display-sm font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-display-md"
            >
              Commission is the only number that decides your year
            </Reveal>

            <Reveal
              as="p"
              delay={0.12}
              className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
            >
              Everyone else charges 6% and calls it standard. Starter matches it at no monthly
              cost, so moving is free — then Growth and Scale take it down to a number your
              competitors cannot run on. Migration is white-glove and free on every plan.
            </Reveal>

            <Reveal
              delay={0.18}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button
                asChild
                size="lg"
                variant="primary"
                rightIcon={<ArrowRight aria-hidden="true" />}
                className="w-full sm:w-auto"
              >
                <Link href="/signup">Start free — no card</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                leftIcon={<Calculator aria-hidden="true" />}
                className="w-full sm:w-auto"
              >
                <Link href="#roi">Run your numbers</Link>
              </Button>
            </Reveal>
          </div>

          {/* ---------- The ladder ---------- */}
          <StaggerGroup
            as="ul"
            stagger={0.09}
            startDelay={0.22}
            className="mx-auto mt-14 grid max-w-4xl gap-4 sm:mt-16 sm:grid-cols-3"
          >
            {LADDER.map((rung) => (
              <StaggerItem
                as="li"
                key={rung.id}
                distance={16}
                blur={false}
                className={cn(
                  'relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-sm',
                  'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
                  'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                )}
              >
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-subtle">
                  {rung.name}
                </p>
                <p className="mt-3 flex items-baseline gap-1.5 font-display text-display-sm font-semibold tracking-[-0.03em] text-foreground tabular">
                  {rung.percent}
                  <span className="text-xl font-semibold text-muted">%</span>
                </p>

                <div
                  aria-hidden="true"
                  className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: rung.width }}
                  />
                </div>

                <p className="mt-3 text-sm leading-relaxed text-muted">
                  You keep{' '}
                  <span className="font-semibold text-foreground tabular">${rung.keeps}</span> of
                  every $100 booked.
                </p>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal
            delay={0.4}
            className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
          >
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2 text-sm font-medium text-muted">
                <Icon className="size-4 shrink-0 text-success" aria-hidden="true" />
                {label}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          PLANS · CALCULATOR · MATRIX
          ================================================================ */}
      <PricingSection className="scroll-mt-4 border-y border-line bg-background-subtle" />

      <RoiCalculator className="scroll-mt-4 bg-background" />

      <PricingTable className="scroll-mt-4 border-y border-line bg-surface-sunken" />

      {/* ================================================================
          MONEY QUESTIONS
          ================================================================ */}
      <section id="faq" className="scroll-mt-4 bg-background py-20 sm:py-28">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Straight answers"
            title="Questions about the money"
            description="Commission, who pays it, when you actually get paid, and what happens when a guest disputes a charge."
          />

          <Reveal delay={0.08} className="mt-10">
            <Accordion type="single" collapsible variant="card" defaultValue={MONEY_FAQS[0]?.id}>
              {MONEY_FAQS.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="py-5 text-left">
                    <span className="text-[0.9375rem] leading-snug font-medium">
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 pr-2 sm:pr-8">
                    <p className="text-sm leading-relaxed text-muted">
                      {decodeEntities(faq.answer)}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>

          <Reveal
            delay={0.14}
            className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 text-center sm:flex-row sm:text-left"
          >
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <span>
                Still doing the arithmetic? Send us last season&rsquo;s numbers and we will tell you
                which plan wins — including when the answer is Starter.
              </span>
            </p>
            <Button
              asChild
              size="md"
              variant="secondary"
              rightIcon={<ArrowRight aria-hidden="true" />}
              className="shrink-0"
            >
              <Link href="/contact">Talk to sales</Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  )
}
