import { Check } from 'lucide-react'

import { EYEBROW, H2, TONE_BG, WRAP } from '@/components/marketing/booking-software/niche-sections'
import { CheckList } from '@/components/marketing/compare/compare-longform'
import type { Niche, NicheLong } from '@/content/booking-software'
import { EZRA_FEE_PERCENT } from '@/lib/fees'
import { cn } from '@/lib/utils'

/* ==========================================================================
   The long-form sections of a /booking-software page:

     intro       what the software does, and the businesses it suits
     day         a working day, hour by hour
     look for    six things to look for, each tied to a feature
     move        moving over from another system, four steps
     included    everything in the one plan

   Server components only.
   ========================================================================== */

export function IntroSection({ niche, long }: { niche: Niche; long: NicheLong }) {
  return (
    <section aria-labelledby="intro-title" className="bg-background pt-20 sm:pt-28">
      <div className={cn(WRAP, 'grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16')}>
        <div>
          <h2 id="intro-title" className={H2}>
            {long.introTitle}
          </h2>
          <div className="mt-6 max-w-[64ch] space-y-4 text-[1.0625rem] leading-[1.7] text-foreground/85">
            {long.intro.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </div>
        </div>

        <aside aria-labelledby="fits-title" className={cn('self-start rounded-[1.375rem] p-6 sm:p-7', TONE_BG[niche.tone])}>
          <h3 id="fits-title" className="text-[0.9375rem] font-semibold text-foreground">
            Built for
          </h3>
          <ul className="mt-4 space-y-3.5">
            {long.fits.map((fit) => (
              <li key={fit.label} className="flex gap-3">
                <Check aria-hidden="true" strokeWidth={2.5} className="mt-[0.3em] size-4 shrink-0 text-foreground" />
                <span className="text-[0.9375rem] leading-[1.45]">
                  <span className="block font-medium text-foreground">{fit.label}</span>
                  <span className="block text-foreground/70">{fit.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  )
}

export function DaySection({ niche, long }: { niche: Niche; long: NicheLong }) {
  return (
    <section aria-labelledby="day-title" className="bg-background py-20 sm:py-28">
      <div className={WRAP}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>Hour by hour</p>
          <h2 id="day-title" className={cn(H2, 'mt-3')}>
            A day with EZRA Pro
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">How a {niche.name.toLowerCase()} day runs, from opening to close.</p>
        </div>

        <ol className="mt-12 border-t border-line">
          {long.day.map((moment) => (
            <li key={moment.time} className="grid gap-x-8 gap-y-1.5 border-b border-line py-6 sm:grid-cols-[6rem_minmax(0,14rem)_minmax(0,1fr)] sm:py-7">
              <p className="font-display text-[1.25rem] leading-[1.3] font-medium tracking-[-0.02em] text-muted tabular">{moment.time}</p>
              <h3 className="text-[1.125rem] leading-[1.35] font-medium text-foreground">{moment.title}</h3>
              <p className="max-w-[60ch] text-base leading-[1.6] text-muted">{moment.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function LookForSection({ niche, long }: { niche: Niche; long: NicheLong }) {
  return (
    <section aria-labelledby="look-for-title" className="bg-background-subtle py-20 sm:py-28">
      <div className={WRAP}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>Choosing software</p>
          <h2 id="look-for-title" className={cn(H2, 'mt-3')}>
            What to look for in {niche.keywords.primary}
          </h2>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {long.lookFor.map((item, index) => (
            <li key={item.title} className="flex flex-col rounded-[1.375rem] border border-line bg-surface p-6 sm:p-7">
              <span aria-hidden="true" className="font-display text-[1.5rem] leading-none font-medium tracking-[-0.03em] text-foreground/30 tabular">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-5 font-display text-[1.1875rem] leading-[1.3] font-medium tracking-[-0.02em] text-foreground">{item.title}</h3>
              <p className="mt-2.5 text-[0.9375rem] leading-[1.6] text-pretty text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function MoveSection({ niche, long, included }: { niche: Niche; long: NicheLong; included: { label: string; hint?: string }[] }) {
  const steps = [
    {
      title: 'Send us an export',
      body: `Export your ${long.things}, prices, guests and future bookings from your current system as a spreadsheet. If it has no export, send what you have.`,
    },
    {
      title: 'We set it up',
      body: `We add your ${long.things}, prices, rules and waiver, and bring over every future booking and guest record. The move is free.`,
    },
    {
      title: 'Try a booking',
      body: 'Make a test booking from start to finish, change anything that looks wrong, and connect the account your payouts go to.',
    },
    {
      title: 'Swap the button',
      body: 'Point the Book now button on your website to EZRA Pro. Bookings already taken stay where they are, and new ones come in here.',
    },
  ]

  return (
    <section aria-labelledby="move-title" className="bg-background py-20 sm:py-28">
      <div className={WRAP}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>Switching</p>
          <h2 id="move-title" className={cn(H2, 'mt-3')}>
            Moving your {niche.name.toLowerCase()} business over
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">Most businesses move over a weekend, without pausing sales.</p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-[1.375rem] border border-line bg-surface p-6">
              <span
                aria-hidden="true"
                className="grid size-9 place-items-center rounded-full bg-foreground font-display text-[1rem] font-semibold text-background"
              >
                {index + 1}
              </span>
              <h3 className="mt-5 text-[1.125rem] leading-[1.3] font-medium text-foreground">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.6] text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-20 grid gap-10 border-t border-line pt-16 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <div>
            <h2 id="included-title" className={H2}>
              Everything in the {EZRA_FEE_PERCENT}%
            </h2>
            <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">One plan. No add-ons, no tiers and nothing held back for a bigger plan.</p>
          </div>
          <CheckList items={included} />
        </div>
      </div>
    </section>
  )
}
