import type { Metadata } from 'next'
import Link from 'next/link'
import { Headset, LifeBuoy, Mail, MapPin, Phone, Star, Timer } from 'lucide-react'

import {
  AuroraBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Avatar } from '@/components/ui/avatar'
import { TESTIMONIALS } from '@/content/marketing'
import { SITE } from '@/lib/site-config'
import { cn, truncate } from '@/lib/utils'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact sales',
  description:
    'Book a 20-minute demo with someone who has migrated operators onto EZRA Pro. No slide deck — your own numbers, in the product. Median first reply under five minutes, seven days a week.',
  alternates: { canonical: '/contact' },
  openGraph: {
    url: '/contact',
    title: 'Talk to EZRA Pro',
    description:
      'Twenty minutes, your real numbers, an honest answer about whether we fit. Sales and support reply seven days a week.',
  },
}

/* ==========================================================================
   ENTITIES — quotes are authored with HTML entities; React escapes strings.
   See the note in `pricing/page.tsx` for why this is not imported.
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
   CHANNELS
   ========================================================================== */

const CHANNELS = [
  {
    id: 'sales',
    icon: Mail,
    label: 'Sales',
    value: SITE.supportEmail,
    href: `mailto:${SITE.supportEmail}`,
    note: 'Pricing, migration plans and anything contractual.',
  },
  {
    id: 'phone',
    icon: Phone,
    label: 'Phone',
    value: SITE.phone,
    href: `tel:${SITE.phone.replace(/[^+\d]/g, '')}`,
    note: 'Weekdays 7am – 7pm HST. A person answers.',
  },
  {
    id: 'support',
    icon: LifeBuoy,
    label: 'Existing operator?',
    value: 'In-app chat',
    href: '/login',
    note: 'Sign in and use the chat in the bottom corner of the dashboard.',
  },
]

/** Three short proofs that the response-time promise is real. */
const SNIPPETS = TESTIMONIALS.filter((item) =>
  ['tst-5', 'tst-1', 'tst-4'].includes(item.id),
)

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>
}) {
  const { topic } = await searchParams
  const resolvedTopic = Array.isArray(topic) ? topic[0] : topic

  return (
    <section
      aria-labelledby="contact-title"
      className="relative isolate overflow-hidden bg-background pb-24 pt-12 sm:pt-16"
    >
      <GridBackground fade="radial" seed="ezra-contact-grid" className="opacity-60" />
      <AuroraBackground
        seed="ezra-contact"
        blobs={4}
        intensity="subtle"
        palette={['lagoon', 'reef']}
      />
      <NoiseOverlay opacity={0.035} />
      <GlowOrb
        color="coral"
        size={420}
        opacity={0.12}
        blur={110}
        float={false}
        className="-bottom-32 left-[-8%]"
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ---------- Page title ---------- */}
        <div className="max-w-2xl">
          <Reveal direction="up" distance={8} blur={false}>
            <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
              <Headset className="size-3.5" aria-hidden="true" />
              Talk to a human
            </span>
          </Reveal>

          <Reveal
            as="h1"
            id="contact-title"
            delay={0.06}
            blur
            className="mt-6 font-display text-display-sm font-semibold tracking-[-0.032em] text-balance text-foreground sm:text-display-md"
          >
            Twenty minutes, your numbers, an honest answer
          </Reveal>

          <Reveal
            as="p"
            delay={0.12}
            className="mt-5 text-base leading-relaxed text-pretty text-muted sm:text-lg"
          >
            No discovery questionnaire and no slide deck. Tell us what you run and roughly how
            much of it, and we will show you your own season inside EZRA Pro — including the parts
            where we are not the right answer.
          </Reveal>
        </div>

        {/* ---------- Split ---------- */}
        <div className="mt-12 grid items-start gap-10 sm:mt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-14">
          {/* ================= Form ================= */}
          <Reveal delay={0.16} distance={24} blur={false}>
            <ContactForm topic={resolvedTopic} />
          </Reveal>

          {/* ================= Panel ================= */}
          <div className="flex flex-col gap-6">
            {/* ---------- Response-time promise ---------- */}
            <Reveal delay={0.2} distance={20} blur={false}>
              <div
                className={cn(
                  'relative overflow-hidden rounded-3xl border border-line p-6 shadow-sm sm:p-7',
                  'bg-[linear-gradient(145deg,color-mix(in_oklab,var(--primary)_11%,var(--surface))_0%,var(--surface)_55%,color-mix(in_oklab,var(--accent)_9%,var(--surface))_100%)]',
                )}
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Timer className="size-5" aria-hidden="true" />
                </span>

                <p className="mt-5 font-display text-display-sm font-semibold tracking-[-0.03em] text-gradient-lagoon tabular">
                  4 min
                </p>
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  Median first response, seven days a week
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  Measured across sales and support during operating hours. We staff up for your
                  season, not ours — which is why the number holds in July.
                </p>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line-subtle pt-5">
                  <div>
                    <dt className="text-xs text-subtle">Demo requests</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      Within 1 business day
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Migration calls</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground">
                      Booked inside a week
                    </dd>
                  </div>
                </dl>
              </div>
            </Reveal>

            {/* ---------- Direct channels ---------- */}
            <StaggerGroup as="ul" stagger={0.07} startDelay={0.24} className="flex flex-col gap-3">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon
                const external = channel.href.startsWith('mailto:') || channel.href.startsWith('tel:')

                const inner = (
                  <>
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-primary transition-colors duration-300 ease-[var(--ease-out-expo)] group-hover:bg-primary-soft">
                      <Icon className="size-[1.125rem]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                        {channel.label}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                        {channel.value}
                      </span>
                      <span className="mt-1 block text-[0.8125rem] leading-relaxed text-muted">
                        {channel.note}
                      </span>
                    </span>
                  </>
                )

                const classes = cn(
                  'group flex items-start gap-4 rounded-2xl border border-line bg-surface p-4',
                  'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
                  'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                )

                return (
                  <StaggerItem as="li" key={channel.id} distance={14}>
                    {external ? (
                      <a href={channel.href} className={classes}>
                        {inner}
                      </a>
                    ) : (
                      <Link href={channel.href} className={classes}>
                        {inner}
                      </Link>
                    )}
                  </StaggerItem>
                )
              })}
            </StaggerGroup>

            {/* ---------- Where we are ---------- */}
            <Reveal delay={0.3} distance={14}>
              <p className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-subtle">
                <MapPin className="mt-0.5 size-4 shrink-0 text-faint" aria-hidden="true" />
                Remote-first across nine time zones, with people on the water in Hawai&rsquo;i,
                Queensland and the Algarve. Someone is awake whenever your season is.
              </p>
            </Reveal>

            {/* ---------- What the calls are actually like ---------- */}
            <Reveal delay={0.34} distance={20}>
              <div className="rounded-3xl border border-line bg-surface-sunken p-6 shadow-sm">
                <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-subtle">
                  What operators say afterwards
                </h2>

                <ul className="mt-5 flex flex-col gap-5">
                  {SNIPPETS.map((item) => (
                    <li key={item.id} className="border-t border-line-subtle pt-5 first:border-0 first:pt-0">
                      <figure>
                        <div
                          role="img"
                          aria-label={`Rated ${item.rating} out of 5`}
                          className="flex items-center gap-0.5"
                        >
                          {Array.from({ length: item.rating }, (_, index) => (
                            <Star
                              key={index}
                              className="size-3.5 fill-current text-sunset-500"
                              aria-hidden="true"
                            />
                          ))}
                        </div>

                        <blockquote className="mt-2.5 text-sm leading-relaxed text-pretty text-foreground">
                          &ldquo;{truncate(decodeEntities(item.quote), 148)}&rdquo;
                        </blockquote>

                        <figcaption className="mt-3 flex items-center gap-3">
                          <Avatar name={item.author} src={item.avatarUrl} size="sm" />
                          <span className="min-w-0 text-xs text-muted">
                            <span className="font-semibold text-foreground">{item.author}</span>
                            <span className="block truncate">{item.company}</span>
                          </span>
                        </figcaption>
                      </figure>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
