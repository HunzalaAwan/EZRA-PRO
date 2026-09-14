'use client'

import { CloudRain, Hourglass, Users } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { ScrollRevealText } from '@/components/motion/text-effects'
import { cn } from '@/lib/utils'

/* ==========================================================================
   StoryHook — the problem, in the operator's own words.

   The statement brightens word by word as it is scrolled through, and the
   three things underneath are the mornings every operator recognises. The
   third sits deliberately off-grid: this is not a feature row.
   ========================================================================== */

const MORNINGS = [
  {
    icon: Users,
    time: '08:52',
    title: 'Oversold the 9:00 again',
    body: 'Viator and the website both sold the last two spots. Someone is getting turned away.',
  },
  {
    icon: CloudRain,
    time: '05:10',
    title: 'Weather call, forty guests to reach',
    body: 'Storm is coming. Every one of them needs a text, a refund or a rebook — before they leave the hotel.',
  },
  {
    icon: Hourglass,
    time: 'Day 9',
    title: 'Payout still "processing"',
    body: 'Last week\u2019s bookings, this week\u2019s payroll. The money is somewhere between the guest and you.',
  },
] as const

export function StoryHook({ className }: { className?: string }) {
  return (
    <section className={cn('relative bg-background py-24 sm:py-32', className)}>
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="max-w-4xl">
          <ScrollRevealText
            as="h2"
            text="You don\u2019t run a tour company. You run a calendar, a crew roster, three locations, two marketplaces and eleven WhatsApp threads. Your booking software should carry some of that weight."
            offset={['start 0.85', 'end 0.45']}
            className="font-display text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.15] font-semibold tracking-[-0.025em] text-balance"
          />
        </div>

        <StaggerGroup
          as="ul"
          stagger={0.1}
          className="mt-16 grid grid-cols-1 gap-x-8 gap-y-10 sm:mt-20 md:grid-cols-12"
        >
          {MORNINGS.map((m, i) => {
            const Icon = m.icon
            return (
              <StaggerItem
                as="li"
                key={m.title}
                distance={16}
                className={cn(
                  'md:col-span-4',
                  i === 2 && 'md:col-start-6',
                )}
              >
                <p className="flex items-center gap-2 font-mono text-[0.75rem] font-medium text-subtle tabular-nums">
                  <Icon aria-hidden="true" className="size-4 text-primary" strokeWidth={2} />
                  {m.time}
                </p>
                <h3 className="mt-3 font-display text-lg font-semibold tracking-[-0.015em] text-foreground">
                  {m.title}
                </h3>
                <p className="mt-2 max-w-xs text-[0.9375rem] leading-relaxed text-muted">{m.body}</p>
              </StaggerItem>
            )
          })}
        </StaggerGroup>

        <Reveal delay={0.1} distance={12} className="mt-16 sm:mt-20">
          <p className="font-serif text-[1.375rem] leading-snug text-muted italic sm:text-2xl">
            Three mornings, one product. Here is what a day looks like on it.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
