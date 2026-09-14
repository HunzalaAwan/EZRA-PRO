'use client'

import { CloudRain, Hourglass, Users, ArrowDownRight } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { ScrollRevealText } from '@/components/motion/text-effects'
import { cn } from '@/lib/utils'

/* ==========================================================================
   StoryHook — the operator reality.
   ========================================================================== */

const MORNINGS = [
  {
    icon: Users,
    time: '08:52 AM',
    badge: 'Inventory Collision',
    title: 'Oversold the 9:00 again',
    body: 'Viator and your direct website both checked out the last two seats in the same minute. Now someone is getting turned away at the door.',
  },
  {
    icon: CloudRain,
    time: '05:10 AM',
    badge: 'Condition Hold',
    title: 'Weather call: forty guests to reach',
    body: 'Conditions deteriorate. Every guest needs an immediate SMS, a rebook into tomorrow or a clean refund before they leave their hotel.',
  },
  {
    icon: Hourglass,
    time: 'Day 9',
    badge: 'Cashflow Drag',
    title: 'Payout still marked "Processing"',
    body: "Last week's tours, this week's payroll. Your capital sits in legacy platforms for 10 days while you cover fuel, guides and gear.",
  },
] as const

export function StoryHook({ className }: { className?: string }) {
  return (
    <section className={cn('relative bg-background py-24 sm:py-32', className)}>
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="max-w-4xl">
          <p className="text-[0.75rem] font-semibold tracking-[0.14em] text-primary uppercase">
            The Reality of Experience Operations
          </p>
          <div className="mt-4">
            <ScrollRevealText
              as="h2"
              text="You don't just run an experience company. You coordinate live availability, guide rosters, four sales channels, weather alerts, and guest check-ins. Your booking software should carry that load."
              offset={['start 0.85', 'end 0.45']}
              className="font-display text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.2] font-semibold tracking-[-0.025em] text-balance text-foreground"
            />
          </div>
        </div>

        <StaggerGroup
          as="ul"
          stagger={0.1}
          className="mt-16 grid grid-cols-1 gap-6 sm:mt-20 md:grid-cols-3"
        >
          {MORNINGS.map((m) => {
            const Icon = m.icon
            return (
              <StaggerItem
                as="li"
                key={m.title}
                distance={16}
                className="group relative flex flex-col justify-between rounded-3xl border border-line bg-surface/80 p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg backdrop-blur-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 rounded-lg bg-surface-sunken px-2.5 py-1 font-mono text-[0.75rem] font-medium text-subtle tabular-nums">
                      <Icon aria-hidden="true" className="size-3.5 text-primary" strokeWidth={2.2} />
                      {m.time}
                    </span>
                    <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-muted">
                      {m.badge}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-lg font-semibold tracking-[-0.015em] text-foreground group-hover:text-primary transition-colors">
                    {m.title}
                  </h3>
                  <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted">
                    {m.body}
                  </p>
                </div>

                <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-primary/80 opacity-0 transition-opacity group-hover:opacity-100">
                  <span>Solved in EZRA Pro</span>
                  <ArrowDownRight className="size-3.5" />
                </div>
              </StaggerItem>
            )
          })}
        </StaggerGroup>

        <Reveal delay={0.1} distance={12} className="mt-16 sm:mt-20">
          <p className="font-serif text-[1.375rem] leading-snug text-muted italic sm:text-2xl">
            A single unified engine built specifically for tour and activity operators. Here is what an operating day looks like on it:
          </p>
        </Reveal>
      </div>
    </section>
  )
}
