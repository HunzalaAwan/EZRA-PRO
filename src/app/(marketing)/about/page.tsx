import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Banknote, CalendarCheck2, Globe2, Smartphone, Unlock } from 'lucide-react'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { CountUp } from '@/components/motion/count-up'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About',
  description:
    'EZRA Pro is booking and operations software built by people who ran tours, dives and restaurants themselves. Where it came from, what it stands for, and who makes it.',
  alternates: { canonical: '/about' },
}

/* ==========================================================================
   /about — where EZRA Pro came from, what it stands for, and who makes it.
   ========================================================================== */

const PRINCIPLES = [
  {
    icon: CalendarCheck2,
    title: 'Sell every seat, never twice',
    body: 'One inventory behind every channel. If the last seat goes on a marketplace, the website knows before the guest has put the phone down.',
  },
  {
    icon: Smartphone,
    title: 'The day matters more than the dashboard',
    body: 'Software for this trade is judged at 06:40 on a dock with one bar of signal, not in a boardroom. We build for the host first.',
  },
  {
    icon: Banknote,
    title: 'Money should move fast',
    body: 'A booking taken on Tuesday is in the bank on Wednesday, itemised, with the fee shown plainly. Cash flow is not a feature; it is the point.',
  },
  {
    icon: Unlock,
    title: 'No lock-in',
    body: 'No contract, no setup fee, and your data exports in standard formats any time. We keep customers by being better next season, not by holding the keys.',
  },
]

const NUMBERS = [
  { value: 11800, suffix: '+', label: 'tours, tables, classes and events selling on EZRA today' },
  { value: 40, suffix: '+', label: 'countries with an operator on the platform' },
  { value: 2.4, prefix: '$', suffix: 'B', decimals: 1, label: 'taken through EZRA checkouts in the last twelve months' },
]

const TEAM: { name: string; role: string; photo: Photo; line: string }[] = [
  { name: 'Leilani Kahale', role: 'Co-founder and chief executive', photo: PHOTOS.dessertCafe, line: 'Ran a snorkel operation in Maui for nine years before there was software worth the name.' },
  { name: 'Marcus Oduya', role: 'Co-founder and chief technology officer', photo: PHOTOS.scubaDeck, line: 'Built payment systems for a decade, then spent a season as a dive boat deckhand to see what broke.' },
  { name: 'Priya Raman', role: 'Head of product', photo: PHOTOS.storeTablet, line: 'Spends one week a month in the field with operators, and brings the notes back to the roadmap.' },
  { name: 'Tomás Ferreira', role: 'Engineering lead, host app', photo: PHOTOS.heroBartender, line: 'Owns the phone that works in a basement. Tests it in one, regularly.' },
  { name: 'Hana Sato', role: 'Head of design', photo: PHOTOS.cafeSmile, line: 'Believes a manifest should read as clearly as a menu, and makes sure it does.' },
  { name: 'Noa Ben-David', role: 'Head of operations', photo: PHOTOS.chefClass, line: 'Ran two restaurants and a supper club, and keeps EZRA honest about what a service really needs.' },
]

const OFFICES = [
  { city: 'Honolulu', role: 'Headquarters', note: 'Where it started, a short walk from the harbour.' },
  { city: 'Lisbon', role: 'Europe', note: 'Engineering, migrations and support for EMEA.' },
  { city: 'Auckland', role: 'Asia-Pacific', note: 'Support that is awake when the Pacific is.' },
]

export default function AboutPage() {
  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="bg-cal-rain pt-8 pb-14 sm:pt-10 sm:pb-16 lg:pt-12 lg:pb-20">
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
                About
              </li>
            </ol>
          </nav>

          <div className="mx-auto mt-10 max-w-4xl text-center sm:mt-12">
            <Reveal as="h1" blur distance={16} className="font-display text-[2.75rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.5rem]">
              Built by people who ran the dock.
            </Reveal>
            <Reveal as="p" delay={0.08} distance={12} className="mx-auto mt-6 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem]">
              EZRA Pro is booking and operations software for tours, restaurants, events, classes and venues, made by
              people who sold the seats, ran the sittings and chased the payouts themselves.
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- the story ---------- */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <Reveal direction="up" distance={18} className="lg:col-span-6">
            <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">Where it came from</p>
            <h2 className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.5rem]">
              A snorkel boat, a spreadsheet, and a very bad Saturday.
            </h2>
            <div className="mt-6 flex max-w-[62ch] flex-col gap-4 text-[1.0625rem] leading-[1.6] text-muted">
              <p>
                In 2021 Leilani was running two boats out of Maui on a marketplace listing, a website widget, a phone
                and a paper manifest. One Saturday all four sold the same six seats. Eleven guests stood on the dock for
                a boat that held five more, and the refunds took a week to arrive.
              </p>
              <p>
                Marcus had spent ten years building payment systems and happened to be on the boat that did leave. By
                the end of the season the two of them had a rule: one basket of seats, every channel reads it, and the
                money lands the next business day. EZRA Pro is that rule, built out for every kind of business that
                sells a place at a time.
              </p>
              <p>
                Today it runs the calendar, the checkout, the host app and the payouts for more than eleven thousand
                products in forty countries, and the team still spends a week a month on somebody&rsquo;s dock, pass or
                studio floor.
              </p>
            </div>
          </Reveal>
          <Reveal direction="up" distance={24} delay={0.08} className="lg:col-span-6">
            <div className="rounded-[2rem] bg-cal-cloud p-4 sm:p-6">
              <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-surface-sunken">
                <Image src={photoUrl(PHOTOS.guideGroup, 1200)} alt={PHOTOS.guideGroup.alt} fill sizes="(min-width: 1024px) 40rem, 100vw" className="object-cover" style={{ objectPosition: PHOTOS.guideGroup.focus }} />
              </figure>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------- principles ---------- */}
      <section className="bg-background-subtle py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal direction="up" distance={8}>
              <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">What we stand for</p>
            </Reveal>
            <Reveal as="h2" delay={0.06} blur distance={14} className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem]">
              Four rules, and we do not bend them for a deal.
            </Reveal>
          </div>
          <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((item) => {
              const Icon = item.icon
              return (
                <StaggerItem as="li" key={item.title} distance={18} className="min-w-0">
                  <article className="flex h-full flex-col rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
                    <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 font-display text-[1.25rem] leading-[1.25] font-medium tracking-[-0.02em] text-foreground">{item.title}</h3>
                    <p className="mt-3 text-[0.9375rem] leading-[1.5] text-muted">{item.body}</p>
                  </article>
                </StaggerItem>
              )
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ---------- numbers ---------- */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
          {NUMBERS.map((n, i) => (
            <Reveal key={n.label} delay={i * 0.08} className="rounded-[1.5rem] bg-cal-cloud p-7 text-center">
              <p className="font-display text-[2.75rem] leading-none font-medium tracking-[-0.03em] text-foreground tabular-nums sm:text-[3.25rem]">
                <CountUp value={n.value} prefix={n.prefix} suffix={n.suffix} decimals={n.decimals} duration={1.4} />
              </p>
              <p className="mx-auto mt-4 max-w-[18rem] text-[0.9375rem] leading-snug text-muted">{n.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- team ---------- */}
      <section className="bg-background pb-20 sm:pb-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Reveal direction="up" distance={8}>
              <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">The people</p>
            </Reveal>
            <Reveal as="h2" delay={0.06} blur distance={14} className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem]">
              Forty-two of us, in three time zones, most with a trade before this one.
            </Reveal>
          </div>
          <StaggerGroup as="ul" stagger={0.06} margin="-10%" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TEAM.map((person) => (
              <StaggerItem as="li" key={person.name} distance={18} className="min-w-0">
                <article className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-surface shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
                  <figure className="relative m-0 aspect-[4/3] overflow-hidden bg-surface-sunken">
                    <Image src={photoUrl(person.photo, 900)} alt={person.photo.alt} fill sizes="(min-width: 1024px) 26rem, 100vw" className="object-cover" style={{ objectPosition: person.photo.focus }} />
                  </figure>
                  <div className="p-6">
                    <h3 className="text-[1.125rem] font-medium text-foreground">{person.name}</h3>
                    <p className="mt-1 text-[0.875rem] text-subtle">{person.role}</p>
                    <p className="mt-3 text-[0.9375rem] leading-[1.5] text-muted">{person.line}</p>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal delay={0.1} className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl bg-background-subtle p-5">
            <p className="text-[0.9375rem] text-muted">Thirty-six more people build, support and migrate. Some of them could be you.</p>
            <Button asChild variant="ink" size="md" className="ml-auto rounded-[10px]" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/careers">See open roles</Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ---------- offices ---------- */}
      <section className="border-t border-line bg-background-subtle py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">Where we are</h2>
          <StaggerGroup as="ul" stagger={0.06} className="mt-8 grid gap-4 sm:grid-cols-3">
            {OFFICES.map((office) => (
              <StaggerItem as="li" key={office.city} distance={14}>
                <div className="flex h-full items-start gap-4 rounded-2xl bg-surface p-5 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cal-sky text-foreground">
                    <Globe2 className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[1rem] font-medium text-foreground">{office.city}</p>
                    <p className="text-[0.8125rem] text-subtle">{office.role}</p>
                    <p className="mt-2 text-[0.9375rem] leading-snug text-muted">{office.note}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <ClosingCta />
    </>
  )
}
