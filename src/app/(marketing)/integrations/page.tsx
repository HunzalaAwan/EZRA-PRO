import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Blocks, Code2, RefreshCw } from 'lucide-react'

import {
  AuroraBackground,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { CtaSection } from '@/components/marketing/cta-section'
import { Integrations } from '@/components/marketing/integrations'
import { SectionHeading } from '@/components/marketing/section-heading'
import { Button } from '@/components/ui/button'
import { INTEGRATIONS } from '@/content/marketing'
import { IntegrationsDirectory } from './integrations-directory'

export const metadata: Metadata = {
  title: 'Integrations',
  description:
    'Stripe, Square, PayPal, Viator, GetYourGuide, Expedia, Google Things to do, Klaviyo, QuickBooks, Xero, Twilio, Slack, Zapier and more — plus an open REST API and webhooks on every plan.',
  alternates: { canonical: '/integrations' },
  openGraph: {
    url: '/integrations',
    title: 'EZRA Pro integrations — 20 tools, one inventory',
    description:
      'Payments, OTAs, marketing, accounting, comms and ops. Two-way sync where it matters, and an open API for everything else.',
  },
}

const CATEGORY_COUNT = new Set(INTEGRATIONS.map((item) => item.category)).size

const HEADLINE_STATS = [
  {
    icon: Blocks,
    figure: `${INTEGRATIONS.length}`,
    label: 'Native integrations',
    note: `Across ${CATEGORY_COUNT} categories, all included on every plan.`,
  },
  {
    icon: RefreshCw,
    figure: '< 1s',
    label: 'OTA sync latency',
    note: 'Sell the last seat anywhere, it disappears everywhere.',
  },
  {
    icon: Code2,
    figure: 'Open',
    label: 'REST API & webhooks',
    note: 'Build the rest yourself — included on every plan, Starter included.',
  },
]

export default function IntegrationsPage() {
  return (
    <>
      {/* ================================================================
          PAGE HEADER
          ================================================================ */}
      <section
        aria-labelledby="integrations-title"
        className="relative isolate overflow-hidden bg-background pb-14 pt-12 sm:pb-16 sm:pt-16"
      >
        <GridBackground fade="radial" seed="ezra-integrations-grid" className="opacity-60" />
        <AuroraBackground
          seed="ezra-integrations"
          blobs={4}
          intensity="subtle"
          palette={['lagoon', 'reef', 'coral']}
        />
        <NoiseOverlay opacity={0.035} />

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Reveal direction="up" distance={8} blur={false}>
              <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
                <Blocks className="size-3.5" aria-hidden="true" />
                Integrations directory
              </span>
            </Reveal>

            <Reveal
              as="h1"
              id="integrations-title"
              delay={0.06}
              blur
              className="mt-6 font-display text-display-sm font-semibold tracking-[-0.032em] text-balance text-foreground sm:text-display-md"
            >
              Everything EZRA Pro plugs into
            </Reveal>

            <Reveal
              as="p"
              delay={0.12}
              className="mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
            >
              Your payment processor, your marketplaces, your email tool and your accountant all
              read from the same inventory and the same guest record. No CSV exports at midnight,
              no reconciliation ritual on a Monday.
            </Reveal>
          </div>

          <StaggerGroup
            as="ul"
            stagger={0.08}
            startDelay={0.18}
            className="mt-12 grid gap-4 sm:grid-cols-3"
          >
            {HEADLINE_STATS.map((stat) => {
              const Icon = stat.icon
              return (
                <StaggerItem
                  as="li"
                  key={stat.label}
                  distance={16}
                  className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
                >
                  <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] text-foreground tabular">
                    {stat.figure}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{stat.label}</p>
                  <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{stat.note}</p>
                </StaggerItem>
              )
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ================================================================
          THE CONSTELLATION — the showcase section, with its CTA repointed
          so the "explore" button on the directory page is not a self-link.
          ================================================================ */}
      <Integrations
        href="/contact?topic=integration"
        className="border-y border-line bg-background-subtle"
      />

      {/* ================================================================
          THE FULL DIRECTORY — searchable, filterable, grouped
          ================================================================ */}
      <section
        id="directory"
        aria-labelledby="directory-title"
        className="scroll-mt-4 border-y border-line bg-surface-sunken py-20 sm:py-28"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="directory-title"
            eyebrow="Browse everything"
            title="The full directory"
            description="Twenty integrations across six categories. Search by name, by category, or by the problem you are trying to solve."
          />

          <Reveal delay={0.08} className="mt-10">
            <IntegrationsDirectory />
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          BUILD YOUR OWN
          ================================================================ */}
      <section
        aria-labelledby="developers-title"
        className="bg-background py-16 sm:py-20"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
              <div className="max-w-2xl">
                <h2
                  id="developers-title"
                  className="font-display text-2xl font-semibold tracking-[-0.02em] text-foreground"
                >
                  Or build exactly what you need
                </h2>
                <p className="mt-3 text-base leading-relaxed text-muted">
                  A documented REST API, signed webhooks for every booking, payment and departure
                  event, and full data export on every plan. Your data has never been hostage to a
                  partnership we have not signed yet.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  rightIcon={<ArrowRight aria-hidden="true" />}
                >
                  <Link href="/developers">Developer docs</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact?topic=integration">Talk to an engineer</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  )
}
