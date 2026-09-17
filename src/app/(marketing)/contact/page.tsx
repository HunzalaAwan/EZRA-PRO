import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe2, LifeBuoy, Mail, Phone, Timer } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { SITE } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import { ContactForm } from './contact-form'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Book a twenty-minute demo with someone who has moved operators onto EZRA Pro, or reach sales and support directly. A person replies, seven days a week.',
  alternates: { canonical: '/contact' },
  openGraph: {
    url: '/contact',
    title: 'Talk to EZRA Pro',
    description: 'Twenty minutes, your real numbers, an honest answer about whether we fit.',
  },
}

/* ==========================================================================
   /contact — the form, and every other way to reach a person.

   `?topic=` prefills the message (migration, enterprise, pricing, careers)
   so a deep link from elsewhere on the site means something. The careers
   topic also swaps the headline, since an applicant is not booking a demo.
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
    note: 'Weekdays 7am to 7pm HST. A person answers.',
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

const OFFICES = ['Honolulu', 'Lisbon', 'Auckland']

const HEADLINES: Record<string, { title: string; lede: string }> = {
  default: {
    title: 'Twenty minutes, your numbers, an honest answer.',
    lede: 'No discovery questionnaire and no slide deck. Tell us what you run and roughly how much of it, and we will show you your own season inside EZRA Pro, including the parts where we are not the right answer.',
  },
  careers: {
    title: 'Tell us what you would do here.',
    lede: 'A short note beats a cover letter. Say which role, what you have built or run before, and where we can see your work. A person on the team reads every one.',
  },
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string | string[] }>
}) {
  const { topic } = await searchParams
  const resolvedTopic = Array.isArray(topic) ? topic[0] : topic
  const copy = HEADLINES[resolvedTopic ?? ''] ?? HEADLINES.default

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="bg-cal-rain pt-8 pb-14 sm:pt-10 sm:pb-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-[0.9375rem] text-muted sm:text-base">
              <li>
                <Link href="/" className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-foreground">
                Contact
              </li>
            </ol>
          </nav>

          <div className="mx-auto mt-10 max-w-4xl text-center sm:mt-12">
            <Reveal as="h1" id="contact-title" blur distance={16} className="font-display text-[2.75rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.25rem]">
              {copy.title}
            </Reveal>
            <Reveal as="p" delay={0.08} distance={12} className="mx-auto mt-6 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem]">
              {copy.lede}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- form + channels ---------- */}
      <section aria-labelledby="contact-title" className="bg-background py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8">
          <Reveal delay={0.12} distance={24} blur={false} className="min-w-0 lg:col-span-7">
            <ContactForm topic={resolvedTopic} />
          </Reveal>

          <div className="flex flex-col gap-5 lg:col-span-5">
            {/* response time */}
            <Reveal delay={0.16} distance={20} blur={false}>
              <div className="rounded-[1.5rem] bg-cal-cloud p-6 sm:p-7">
                <span className="grid size-10 place-items-center rounded-xl bg-surface text-primary shadow-[var(--shadow-sm)]">
                  <Timer className="size-5" aria-hidden="true" />
                </span>
                <p className="mt-5 font-display text-[2.5rem] leading-none font-medium tracking-[-0.03em] text-foreground tabular-nums">4 min</p>
                <p className="mt-2 text-[0.9375rem] font-medium text-foreground">Median first reply, seven days a week</p>
                <p className="mt-2 text-[0.9375rem] leading-[1.5] text-muted">
                  Measured across sales and support during operating hours. We staff up for your season, not ours, which
                  is why the number holds in July.
                </p>
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-5">
                  <div>
                    <dt className="text-[0.8125rem] text-subtle">Demo requests</dt>
                    <dd className="mt-1 text-[0.9375rem] font-medium text-foreground">Within one business day</dd>
                  </div>
                  <div>
                    <dt className="text-[0.8125rem] text-subtle">Migration calls</dt>
                    <dd className="mt-1 text-[0.9375rem] font-medium text-foreground">Booked inside a week</dd>
                  </div>
                </dl>
              </div>
            </Reveal>

            {/* direct channels */}
            <StaggerGroup as="ul" stagger={0.07} startDelay={0.2} className="flex flex-col gap-3">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon
                const external = channel.href.startsWith('mailto:') || channel.href.startsWith('tel:')
                const inner = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cal-rain text-foreground transition-colors duration-300 group-hover:bg-cal-sky">
                      <Icon className="size-[1.125rem]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.8125rem] text-subtle">{channel.label}</span>
                      <span className="mt-0.5 block truncate text-[1rem] font-medium text-foreground">{channel.value}</span>
                      <span className="mt-1 block text-[0.875rem] leading-snug text-muted">{channel.note}</span>
                    </span>
                  </>
                )
                const classes = cn(
                  'group flex items-start gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]',
                  'transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]',
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

            {/* where we are */}
            <Reveal delay={0.3} distance={14}>
              <div className="flex items-start gap-3 rounded-2xl bg-background-subtle p-4">
                <Globe2 className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                <p className="text-[0.875rem] leading-snug text-muted">
                  Teams in {OFFICES.join(', ')}, and people on the water in between. Someone is awake whenever your season
                  is.{' '}
                  <Link href="/about" className="font-medium text-foreground underline-offset-4 hover:underline">
                    About us
                  </Link>
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
