import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowRightLeft,
  CalendarCheck,
  Check,
  CircleCheck,
  Database,
  Rocket,
  ShieldCheck,
} from 'lucide-react'

import {
  AuroraBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { CtaSection } from '@/components/marketing/cta-section'
import { SectionHeading } from '@/components/marketing/section-heading'
import { TestimonialMarquee } from '@/components/marketing/testimonials'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { FAQS } from '@/content/marketing'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Switch to EZRA Pro',
  description:
    'Move off your current booking platform in a weekend, mid-season, without dropping a booking. We rebuild your activities, pricing, guests and future reservations for free — on every plan, including the free one.',
  alternates: { canonical: '/switch' },
  openGraph: {
    url: '/switch',
    title: 'Switch to EZRA Pro — free migration, live in a weekend',
    description:
      'Future bookings, deposits and guest records come with you, references intact. Free white-glove migration on every plan.',
  },
}

/* ==========================================================================
   ENTITIES — see the note in `pricing/page.tsx`. `faq-section.tsx` exports a
   `decodeEntities`, but it is a `'use client'` module: its exports become
   client references when a server component imports them, so the function
   would not be callable here. Six lines duplicated beats a runtime crash.
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
   WHAT THE MOVE COSTS
   ========================================================================== */

const MOVE_COST = [
  { figure: '$0', label: 'Migration cost', note: 'Free on every plan, including Starter.' },
  { figure: '1', label: 'Weekend to live', note: 'Most operators cut over Friday to Sunday.' },
  { figure: '0', label: 'Bookings lost', note: 'Future reservations transfer with their references.' },
]

/* ==========================================================================
   THE FOUR STEPS

   A real migration runbook, not a marketing abstraction — each step names who
   does the work and what the operator can still sell while it happens.
   ========================================================================== */

const STEPS = [
  {
    id: 'export',
    when: 'Day 0 · 20 minutes',
    title: 'Send us the export',
    icon: Database,
    body: 'A CSV out of your current system, or read-only access if you would rather we pull it. Nothing on your live site changes and you keep taking bookings exactly as you are.',
    checks: ['Activities & pricing tiers', 'Guest records & waivers', 'Every future departure'],
  },
  {
    id: 'rebuild',
    when: 'Days 1–3 · we work',
    title: 'We rebuild your catalogue',
    icon: CalendarCheck,
    body: 'Your activities, price tiers, add-ons, cancellation policies, resources and crew come back up inside EZRA Pro. Future bookings land with their original confirmation references, deposits paid and balances outstanding.',
    checks: ['Confirmation refs preserved', 'Deposits & balances intact', 'Resources and crew mapped'],
  },
  {
    id: 'review',
    when: 'Day 4 · you check',
    title: 'You check our work',
    icon: ShieldCheck,
    body: 'A staging workspace with your real data, side by side with your old system. Walk a booking end to end, test the odd pricing rule, put your dock lead in front of the manifest. Nothing goes live until you say so.',
    checks: ['Side-by-side reconciliation', 'Test checkout on your phone', 'Crew trained in one session'],
  },
  {
    id: 'launch',
    when: 'The weekend · you go live',
    title: 'Flip the switch',
    icon: Rocket,
    body: 'Point your domain or swap the widget snippet and the storefront is yours. Both systems stay readable for thirty days in case you want to compare a number, then the old one is just an archive.',
    checks: ['Domain or widget cutover', 'OTAs resynced the same day', '30 days of read-only overlap'],
  },
]

const MIGRATION_FAQS = FAQS.filter((faq) => faq.category === 'migration')

export default function SwitchPage() {
  return (
    <>
      {/* ================================================================
          HERO — written for someone already unhappy with their platform
          ================================================================ */}
      <section
        aria-labelledby="switch-title"
        className="relative isolate overflow-hidden bg-background pb-20 pt-14 sm:pb-24 sm:pt-20"
      >
        <GridBackground fade="radial" beams={1} seed="ezra-switch-grid" />
        <AuroraBackground
          seed="ezra-switch"
          blobs={4}
          intensity="subtle"
          palette={['lagoon', 'coral', 'reef']}
        />
        <NoiseOverlay opacity={0.04} />

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            {/* ---------- Copy ---------- */}
            <div>
              <Reveal direction="up" distance={8} blur={false}>
                <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  <ArrowRightLeft className="size-3.5" aria-hidden="true" />
                  Free white-glove migration
                </span>
              </Reveal>

              <Reveal
                as="h1"
                id="switch-title"
                delay={0.06}
                blur
                className="mt-6 font-display text-display-sm font-semibold tracking-[-0.032em] text-balance text-foreground sm:text-display-md"
              >
                Leaving your current platform?{' '}
                <span className="text-gradient-brand">We do the move.</span>
              </Reveal>

              <Reveal
                as="p"
                delay={0.12}
                className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
              >
                Everyone told these operators that switching mid-season was insane. It took a
                weekend. Send us an export and we rebuild your activities, pricing, guests and
                every future booking inside EZRA Pro — then you flip the switch when, and only
                when, you are ready.
              </Reveal>

              <Reveal
                delay={0.18}
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <Button
                  asChild
                  size="lg"
                  variant="primary"
                  rightIcon={<ArrowRight aria-hidden="true" />}
                  className="w-full sm:w-auto"
                >
                  <Link href="/contact?topic=migration">Plan my migration</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <Link href="#comparison">See the comparison</Link>
                </Button>
              </Reveal>

              <Reveal delay={0.24} className="mt-7">
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
                  <CircleCheck
                    className="mt-0.5 size-4 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span>
                    Mid-season is fine. We have moved operators in July, in the week before a
                    cruise-ship arrival, and once between two tide cycles.
                  </span>
                </p>
              </Reveal>
            </div>

            {/* ---------- The handover ----------
                One idea, stated plainly: two platforms on the left, one on the
                right, and the four things that travel between them. */}
            <Reveal delay={0.3} distance={26} blur={false}>
              <div className="relative">
                <GlowOrb
                  color="lagoon"
                  size={420}
                  opacity={0.18}
                  blur={100}
                  className="-right-16 -top-16"
                />

                <div className="glass-strong relative overflow-hidden rounded-3xl p-6 shadow-2xl sm:p-8">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-subtle">
                    What travels with you
                  </p>

                  <div className="mt-5 flex items-center gap-3 sm:gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {['Your current platform', 'Spreadsheets & inboxes'].map((name) => (
                        <span
                          key={name}
                          className="truncate rounded-xl border border-line bg-surface-sunken px-3 py-2.5 text-center text-[0.8125rem] font-medium text-muted"
                        >
                          {name}
                        </span>
                      ))}
                    </div>

                    <ArrowRight
                      className="size-5 shrink-0 text-primary"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <span className="flex h-[5.25rem] items-center justify-center rounded-xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_16%,var(--surface))_0%,var(--surface)_55%,color-mix(in_oklab,var(--accent)_14%,var(--surface))_100%)] px-3 text-center font-display text-[0.9375rem] font-semibold text-foreground shadow-sm">
                        EZRA Pro
                      </span>
                    </div>
                  </div>

                  <ul className="mt-6 flex flex-col gap-3 border-t border-line-subtle pt-6">
                    {[
                      'Future bookings, with their confirmation references',
                      'Guest profiles, trip history, signed waivers',
                      'Deposits paid and balances still outstanding',
                      'Activities, price tiers, add-ons and policies',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="mt-0.5 inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-success-soft">
                          <Check
                            className="size-3 text-success"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ---------- What the move costs ---------- */}
          <StaggerGroup
            as="ul"
            stagger={0.09}
            startDelay={0.1}
            className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-3"
          >
            {MOVE_COST.map((item) => (
              <StaggerItem
                as="li"
                key={item.label}
                distance={16}
                className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
              >
                <p className="font-display text-display-sm font-semibold tracking-[-0.03em] text-gradient-lagoon tabular">
                  {item.figure}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.note}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ================================================================
          THE HONEST TABLE
          ================================================================ */}

      {/* ================================================================
          HOW MIGRATION WORKS
          ================================================================ */}
      <section
        id="how-it-works"
        aria-labelledby="migration-steps-title"
        className="relative scroll-mt-4 bg-background py-20 sm:py-28 lg:py-32"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="migration-steps-title"
            align="center"
            eyebrow="How migration works"
            title="Four steps, and three of them are ours"
            description="This is the actual runbook. You spend about half an hour on it; we spend the rest of the week making sure nothing lands in the wrong column."
          />

          {/* The connectors are siblings of the <ol>, not children of it: an
              ordered list may only contain list items, and an AT-reported
              "6 items" for a four-step runbook would be a real regression. */}
          <div className="relative mt-14 sm:mt-16">
            {/* ---------- Connectors ----------
                Both rails live inside an `overflow-hidden` track and are drawn
                by a <Reveal> that slides a full-length gradient in from the
                start of the run, so the line reads as being drawn rather than
                faded on. Transform + opacity only; under reduced motion Reveal
                renders the finished state and the line is simply there. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-8 left-6 top-8 w-px overflow-hidden lg:hidden"
            >
              <Reveal
                direction="down"
                distance={560}
                duration={1.5}
                margin="-40px"
                className="h-full w-px bg-gradient-to-b from-primary via-accent to-transparent"
              />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-6 right-10 top-6 hidden h-px overflow-hidden lg:block"
            >
              <Reveal
                direction="left"
                distance={640}
                duration={1.4}
                margin="-40px"
                className="h-px w-full bg-gradient-to-r from-primary via-accent to-transparent"
              />
            </div>

            <ol className="grid gap-10 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                return (
                  <Reveal
                    as="li"
                    key={step.id}
                    delay={0.1 + index * 0.12}
                    distance={22}
                    blur={false}
                    className="relative pl-[4.5rem] lg:pl-0"
                  >
                    {/* Medallion — sits above the rail and hides the seam. */}
                    <div className="absolute left-0 top-0 lg:static">
                      <span
                        className={cn(
                          'relative z-10 flex size-12 items-center justify-center rounded-2xl',
                          'border border-[color-mix(in_oklab,var(--primary)_30%,transparent)]',
                          'bg-[linear-gradient(140deg,color-mix(in_oklab,var(--primary)_16%,var(--surface))_0%,var(--surface)_70%)]',
                          'text-primary shadow-md',
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                        <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.625rem] font-bold text-on-primary shadow-sm tabular">
                          {index + 1}
                        </span>
                      </span>
                    </div>

                    <p className="mt-0 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary lg:mt-6">
                      {step.when}
                    </p>
                    <h3 className="mt-2 font-display text-lg font-semibold tracking-[-0.015em] text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">{step.body}</p>

                    <ul className="mt-4 flex flex-col gap-2 border-t border-line-subtle pt-4">
                      {step.checks.map((check) => (
                        <li key={check} className="flex items-start gap-2 text-[0.8125rem] text-subtle">
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-success"
                            strokeWidth={2.75}
                            aria-hidden="true"
                          />
                          {check}
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                )
              })}
            </ol>
          </div>

          <Reveal
            delay={0.2}
            className="mt-14 flex flex-col items-center justify-between gap-5 rounded-3xl border border-line bg-surface-raised p-6 text-center shadow-lg sm:p-8 lg:flex-row lg:text-left"
          >
            <div className="max-w-xl">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Bring us your weirdest pricing rule
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Private charters priced per hull, tasting menus with timed seatings, class packs,
                resort desks reselling other operators. If it genuinely will not fit, we will tell
                you on the call instead of six weeks in.
              </p>
            </div>
            <Button
              asChild
              size="lg"
              variant="primary"
              rightIcon={<ArrowRight aria-hidden="true" />}
              className="w-full shrink-0 sm:w-auto"
            >
              <Link href="/contact?topic=migration">Book a migration call</Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          OPERATORS WHO ALREADY DID IT
          ================================================================ */}
      <section
        aria-label="Operators who have already switched"
        className="relative overflow-hidden border-y border-line bg-surface-sunken py-16 sm:py-20"
      >
        <Reveal className="px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
            They all said mid-season was impossible
          </h2>
        </Reveal>
        <div className="mt-10">
          <TestimonialMarquee speed={64} clipAt={150} />
        </div>
      </section>

      {/* ================================================================
          MIGRATION QUESTIONS
          ================================================================ */}
      <section id="faq" className="scroll-mt-4 bg-background py-20 sm:py-28">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Before you commit"
            title="What operators ask before they move"
            description="The three that come up on every migration call, answered the way we answer them on the call."
          />

          <Reveal delay={0.08} className="mt-10">
            <Accordion
              type="single"
              collapsible
              variant="card"
              defaultValue={MIGRATION_FAQS[0]?.id}
            >
              {MIGRATION_FAQS.map((faq) => (
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
        </div>
      </section>

      <CtaSection />
    </>
  )
}
