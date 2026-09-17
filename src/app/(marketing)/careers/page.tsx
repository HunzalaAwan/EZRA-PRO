import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock3, Globe2, HeartPulse, MapPin, Palmtree, Ship, TrendingUp, Users } from 'lucide-react'

import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Work on the software that runs the day for eleven thousand tours, restaurants, classes and venues. Open roles in engineering, design, customer and sales, in Honolulu, Lisbon, Auckland and remote.',
  alternates: { canonical: '/careers' },
}

/* ==========================================================================
   /careers — how we work, what you get, and the roles open right now.
   Applications go through the contact form with the careers topic.
   ========================================================================== */

const WAYS = [
  {
    icon: Globe2,
    title: 'Remote, across three hubs',
    body: 'Honolulu, Lisbon and Auckland, and anywhere within four hours of one of them. We overlap for a few hours a day and write the rest down.',
  },
  {
    icon: Clock3,
    title: 'We ship every week',
    body: 'Small changes, reviewed, behind flags, out on Tuesdays. Operators see the difference in the same season they asked for it.',
  },
  {
    icon: Users,
    title: 'Everyone talks to operators',
    body: 'Engineers take support shifts. Designers go on the boat. Every quarter each of us spends a day running a real check-in.',
  },
]

const BENEFITS = [
  { icon: TrendingUp, title: 'Published salary bands', body: 'Every role has a range in the listing, and everyone in the same band is paid the same.' },
  { icon: Users, title: 'Equity for everyone', body: 'Every full-time role comes with options, vesting over four years.' },
  { icon: Palmtree, title: 'Five weeks off', body: 'Plus your local public holidays, and we mean it: the calendar is checked for people who have not taken them.' },
  { icon: HeartPulse, title: 'Health, dental and vision', body: 'Covered in full for you and your family in every country we hire in.' },
  { icon: MapPin, title: 'Home office and travel', body: 'A budget for your desk, and flights to a hub twice a year to see the people you work with.' },
  { icon: Ship, title: 'A day on a customer’s boat', body: 'Once a year the whole company spends a day with an operator, doing the work the software does.' },
]

const ROLES = [
  { title: 'Senior product engineer', team: 'Engineering', location: 'Lisbon or remote', type: 'Full-time' },
  { title: 'Mobile engineer, host app', team: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Data engineer', team: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Product designer', team: 'Design', location: 'Honolulu or remote', type: 'Full-time' },
  { title: 'Customer success manager, EMEA', team: 'Customer', location: 'Lisbon', type: 'Full-time' },
  { title: 'Migration specialist', team: 'Customer', location: 'Remote', type: 'Full-time' },
  { title: 'Support engineer, APAC', team: 'Customer', location: 'Auckland', type: 'Full-time' },
  { title: 'Account executive, Pacific', team: 'Sales', location: 'Honolulu', type: 'Full-time' },
]

export default function CareersPage() {
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
                Careers
              </li>
            </ol>
          </nav>

          <div className="mt-10 grid items-center gap-10 sm:mt-12 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-6">
              <Reveal as="h1" blur distance={16} className="font-display text-[2.75rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.25rem]">
                Come build the day for eleven thousand businesses.
              </Reveal>
              <Reveal as="p" delay={0.08} distance={12} className="mt-6 max-w-xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem]">
                The software that sells the seat, runs the check-in and pays the crew is made by forty-two people in
                three time zones. We are hiring eight more.
              </Reveal>
              <Reveal delay={0.16} className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="ink" size="xl" className="rounded-[10px] px-7" rightIcon={<ArrowRight aria-hidden="true" />}>
                  <a href="#roles">See open roles</a>
                </Button>
                <Button asChild variant="secondary" size="xl" className="rounded-[10px] px-7">
                  <Link href="/about">Meet the team</Link>
                </Button>
              </Reveal>
            </div>
            <Reveal direction="up" distance={24} delay={0.1} className="lg:col-span-6">
              <div className="rounded-[2rem] bg-cal-honeydew p-4 sm:p-6">
                <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-surface-sunken">
                  <Image src={photoUrl(PHOTOS.heroKayakGuide, 1200)} alt={PHOTOS.heroKayakGuide.alt} fill priority sizes="(min-width: 1024px) 40rem, 100vw" className="object-cover" style={{ objectPosition: PHOTOS.heroKayakGuide.focus }} />
                </figure>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- how we work ---------- */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal direction="up" distance={8}>
              <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">How we work</p>
            </Reveal>
            <Reveal as="h2" delay={0.06} blur distance={14} className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem]">
              Close to the dock, far from the meeting.
            </Reveal>
          </div>
          <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-12 grid gap-5 md:grid-cols-3">
            {WAYS.map((item) => {
              const Icon = item.icon
              return (
                <StaggerItem as="li" key={item.title} distance={18} className="min-w-0">
                  <article className="flex h-full flex-col rounded-[1.5rem] bg-surface p-7 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
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

      {/* ---------- benefits ---------- */}
      <section className="bg-background-subtle py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Reveal direction="up" distance={8}>
              <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">What you get</p>
            </Reveal>
            <Reveal as="h2" delay={0.06} blur distance={14} className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem]">
              The same terms for everyone, written down.
            </Reveal>
          </div>
          <StaggerGroup as="ul" stagger={0.06} margin="-10%" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((item) => {
              const Icon = item.icon
              return (
                <StaggerItem as="li" key={item.title} distance={16} className="min-w-0">
                  <div className="flex h-full gap-4 rounded-2xl bg-surface p-5 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cal-lime text-foreground">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-[1rem] font-medium text-foreground">{item.title}</p>
                      <p className="mt-1.5 text-[0.9375rem] leading-[1.5] text-muted">{item.body}</p>
                    </div>
                  </div>
                </StaggerItem>
              )
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ---------- open roles ---------- */}
      <section id="roles" className="scroll-mt-4 bg-background py-20 sm:py-24">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <Reveal direction="up" distance={8}>
                <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">Open roles</p>
              </Reveal>
              <Reveal as="h2" delay={0.06} blur distance={14} className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem]">
                Eight roles, open now.
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <p className="text-[0.9375rem] text-muted">Every listing has a salary band. Apply with a note, not a cover letter.</p>
            </Reveal>
          </div>

          <StaggerGroup as="ul" stagger={0.05} margin="-10%" className="mt-10 divide-y divide-line rounded-[1.5rem] bg-surface shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
            {ROLES.map((role) => (
              <StaggerItem as="li" key={role.title} distance={12}>
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:px-7">
                  <div className="min-w-0 flex-1">
                    <p className="text-[1.0625rem] font-medium text-foreground">{role.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem] text-subtle">
                      <span>{role.team}</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {role.location}
                      </span>
                      <span>{role.type}</span>
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="md" className="rounded-[10px] sm:shrink-0" rightIcon={<ArrowRight aria-hidden="true" />}>
                    <Link href="/contact?topic=careers">Apply</Link>
                  </Button>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal delay={0.1} className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl bg-cal-cloud p-5">
            <p className="text-[0.9375rem] text-foreground">Do not see your role? Tell us what you would do here and we will read it properly.</p>
            <Button asChild variant="ink" size="md" className="ml-auto rounded-[10px]" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/contact?topic=careers">Write to us</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </>
  )
}
