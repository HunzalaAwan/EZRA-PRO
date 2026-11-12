import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CircleCheck, Headset, ShieldCheck, Truck } from 'lucide-react'

import { GridBackground } from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { CtaSection } from '@/components/marketing/cta-section'
import { PricingSection } from '@/components/marketing/pricing-section'
import { SectionHeading } from '@/components/marketing/section-heading'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { FAQS, PRICING_PLANS } from '@/content/marketing'
import { formatCurrency } from '@/lib/utils'

const PLAN = PRICING_PLANS[0]
const PERCENT = PLAN.commissionPercent

export const metadata: Metadata = {
  title: 'Pricing',
  description: `${PERCENT}% of each booking. That is the entire bill: $0 a month, no setup fee, no contract, every feature included. You choose who pays the ${PERCENT}%.`,
  alternates: { canonical: '/pricing' },
  openGraph: {
    url: '/pricing',
    title: `EZRA Pro pricing — ${PERCENT}% of each booking, $0 a month`,
    description: `${PERCENT}% of each booking. That is the entire bill. No monthly fee, no setup fee, no contract, and a free move from your current platform.`,
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
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': '’',
  '&amp;': '&',
}

const ENTITY_PATTERN = /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|quot|#39|amp);/g

function decodeEntities(input: string) {
  return input.replace(ENTITY_PATTERN, (match) => ENTITIES[match] ?? match)
}

/* ==========================================================================
   WHO PAYS THE 4%

   The one choice a business makes about the price, shown on a $100 booking
   so the arithmetic is on the page rather than in someone's head.
   ========================================================================== */

const EXAMPLE = 10_000
const EXAMPLE_FEE = Math.round((EXAMPLE * PERCENT) / 100)

const WHO_PAYS = [
  {
    title: 'You pay it',
    line: 'Guests pay the price you set. Nothing is added at checkout.',
    guestPays: EXAMPLE,
    youKeep: EXAMPLE - EXAMPLE_FEE,
  },
  {
    title: 'Guests pay it',
    line: `Checkout adds one “Booking fee (${PERCENT}%)” line on top of your price.`,
    guestPays: EXAMPLE + EXAMPLE_FEE,
    youKeep: EXAMPLE,
  },
]

const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'No contract, leave any time' },
  { icon: Truck, label: 'Free move from your current platform' },
  { icon: Headset, label: 'Support 7 days a week' },
]

/* ==========================================================================
   PRICING-SPECIFIC FAQ

   The landing page runs the full set. Here only the money questions are
   worth the room, so the set is narrowed to `pricing` and `payments` and
   rendered as a plain server-side accordion.
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
        className="relative isolate overflow-hidden bg-background pb-4 pt-14 sm:pt-20"
      >
        <GridBackground fade="radial" seed="ezra-pricing-grid" className="opacity-70" />

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal direction="up" distance={8} blur={false}>
              <span className="inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Pricing
              </span>
            </Reveal>

            <Reveal
              as="h1"
              id="pricing-page-title"
              delay={0.06}
              className="mt-6 font-display text-display-sm font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-display-md"
            >
              {PERCENT}% of each booking. That is the entire bill.
            </Reveal>

            <Reveal
              as="p"
              delay={0.12}
              className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
            >
              No monthly fee, no setup fee, no contract. Every feature is included, and you choose
              whether you pay the {PERCENT}% or your guests do.
            </Reveal>

            <Reveal
              delay={0.18}
              className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button
                asChild
                size="lg"
                variant="ink"
                rightIcon={<ArrowRight aria-hidden="true" />}
                className="w-full sm:w-auto"
              >
                <Link href="/signup">Start free — no card</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <Link href="#who-pays">Who pays the {PERCENT}%?</Link>
              </Button>
            </Reveal>

            <Reveal
              delay={0.24}
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
        </div>
      </section>

      {/* ================================================================
          THE PRICE
          ================================================================ */}
      <PricingSection className="scroll-mt-4 bg-background" />

      {/* ================================================================
          WHO PAYS
          ================================================================ */}
      <section id="who-pays" className="scroll-mt-4 border-y border-line bg-background-subtle py-20 sm:py-24">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Your choice"
            title={`Who pays the ${PERCENT}%`}
            description={`Set it once in Settings and change it whenever you like. Here is a ${formatCurrency(EXAMPLE)} booking either way.`}
          />

          <Reveal delay={0.08} className="mt-10 grid gap-4 sm:grid-cols-2">
            {WHO_PAYS.map((option) => (
              <div key={option.title} className="flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold tracking-[-0.015em] text-foreground">
                  {option.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{option.line}</p>
                <dl className="mt-5 divide-y divide-line-subtle border-t border-line-subtle text-sm">
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-muted">Guest pays</dt>
                    <dd className="font-semibold text-foreground tabular">
                      {formatCurrency(option.guestPays, 'USD', { decimals: true })}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-muted">You keep</dt>
                    <dd className="font-semibold text-foreground tabular">
                      {formatCurrency(option.youKeep, 'USD', { decimals: true })}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </Reveal>

          <p className="mt-6 text-center text-sm leading-relaxed text-muted">
            Card fees are between you and your payment provider. Guests never see a card fee line.
          </p>
        </div>
      </section>

      {/* ================================================================
          MONEY QUESTIONS
          ================================================================ */}
      <section id="faq" className="scroll-mt-4 bg-background py-20 sm:py-28">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Straight answers"
            title="Questions about the money"
            description="What it costs, who pays it, when you actually get paid, and what happens when a guest disputes a charge."
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
                Still doing the arithmetic? Send us last season&rsquo;s numbers and we will show you
                what {PERCENT}% comes to against what you pay today.
              </span>
            </p>
            <Button
              asChild
              size="md"
              variant="secondary"
              rightIcon={<ArrowRight aria-hidden="true" />}
              className="shrink-0"
            >
              <Link href="/contact?topic=pricing">Talk to us</Link>
            </Button>
          </Reveal>

          <p className="mt-6 text-center text-sm leading-relaxed text-muted">
            Weighing us against another system? See{' '}
            <Link href="/compare" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
              how EZRA Pro compares
            </Link>{' '}
            with other booking platforms, with sources, dates and a fee calculator.
          </p>
        </div>
      </section>

      <CtaSection />
    </>
  )
}
