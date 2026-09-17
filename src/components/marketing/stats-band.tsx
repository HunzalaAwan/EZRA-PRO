'use client'

import { Info } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { SimpleTooltip, TooltipProvider } from '@/components/ui/tooltip'
import { STATS } from '@/content/marketing'
import { DURATION, STAGGER } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The proof band under the logo cloud.
 *
 * `STATS` are authored as display strings ("$2.4B+", "11,800+", "+31%"), not
 * numbers, because the copy owns the formatting. To animate them we split each
 * string once, at module scope, into the parts `<CountUp>` needs — a leading
 * symbol, the figure itself, a trailing unit, and how many decimals to hold —
 * so the band counts up without the content file having to know anything about
 * the motion layer. Anything that fails to parse falls back to the raw string.
 */

/** prefix (any non-digits) · figure (digits, commas, optional decimals) · suffix. */
const STAT_PATTERN = /^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/

interface ParsedStat {
  prefix: string
  target: number
  suffix: string
  decimals: number
}

function parseStatValue(value: string): ParsedStat | null {
  const match = STAT_PATTERN.exec(value)
  if (!match) return null

  const [, prefix, figure, suffix] = match
  const target = Number.parseFloat(figure.replace(/,/g, ''))
  if (!Number.isFinite(target)) return null

  const decimalPart = figure.split('.')[1]
  return { prefix, target, suffix, decimals: decimalPart ? decimalPart.length : 0 }
}

const PARSED_STATS = STATS.map((stat) => ({ ...stat, parsed: parseStatValue(stat.value) }))

/**
 * Hairlines: a 2×2 grid on mobile needs real borders, while the desktop row
 * uses the gradient rules below — so each cell's mobile border is switched off
 * again at `lg`.
 */
const CELL_BORDERS = [
  '',
  'border-l border-line lg:border-l-0',
  'border-t border-line lg:border-t-0',
  'border-l border-t border-line lg:border-0',
]

export interface StatsBandProps {
  className?: string
}

export function StatsBand({ className }: StatsBandProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <section
        aria-labelledby="stats-band-heading"
        className={cn(
          'relative isolate overflow-hidden border-y border-line bg-surface-sunken',
          className,
        )}
      >
        <h2 id="stats-band-heading" className="sr-only">
          EZRA Pro by the numbers
        </h2>

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <StaggerGroup
            as="ul"
            stagger={STAGGER.loose}
            startDelay={0.05}
            className="grid grid-cols-2 lg:grid-cols-4"
          >
            {PARSED_STATS.map((stat, index) => (
              <StaggerItem
                as="li"
                key={stat.label}
                distance={16}
                className={cn(
                  'relative flex flex-col items-start px-4 py-8 sm:px-6 sm:py-10 lg:py-12',
                  CELL_BORDERS[index],
                )}
              >
                {/* Desktop divider: fades out top and bottom instead of ending
                    on a hard edge. */}
                {index > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-8 left-0 hidden w-px bg-line lg:block"
                  />
                ) : null}

                <p className="font-display text-[1.75rem] font-semibold leading-none tracking-[-0.032em] text-foreground sm:text-display-sm">
                  {stat.parsed ? (
                    <CountUp
                      value={stat.parsed.target}
                      prefix={stat.parsed.prefix}
                      suffix={stat.parsed.suffix}
                      decimals={stat.parsed.decimals}
                      duration={DURATION.slowest}
                      delay={index * 0.06}
                      margin="-40px"
                    />
                  ) : (
                    <span className="tabular">{stat.value}</span>
                  )}
                </p>

                <span
                  aria-hidden="true"
                  className="mt-4 block h-px w-9 rounded-full bg-primary sm:mt-5"
                />

                <div className="mt-3 flex items-start gap-1.5 sm:mt-4">
                  <span className="text-[0.8125rem] leading-snug text-muted sm:text-sm">
                    {stat.label}
                  </span>

                  {stat.hint ? (
                    <SimpleTooltip provider={false} label={stat.hint} side="top" sideOffset={8}>
                      <button
                        type="button"
                        aria-label={`How ${stat.label} is measured`}
                        className="mt-px inline-grid size-4 shrink-0 place-items-center rounded-full text-faint transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-primary focus-visible:text-primary"
                      >
                        <Info aria-hidden="true" className="size-3.5" />
                      </button>
                    </SimpleTooltip>
                  ) : null}
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>
    </TooltipProvider>
  )
}
