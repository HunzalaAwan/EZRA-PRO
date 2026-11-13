import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { ICONS, NicheCard, PRICE_LINE, WRAP } from '@/components/marketing/booking-software/niche-sections'
import { hubSchema, pageMetadata } from '@/components/marketing/booking-software/niche-schema'
import { Breadcrumbs, JsonLd } from '@/components/marketing/compare/compare-ui'
import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { HUB, NICHE_GROUPS, NICHE_LIST, SHARED_TOOLS } from '@/content/booking-software'
import { EZRA_FEE_PERCENT } from '@/lib/fees'
import { FOOTER_NAV } from '@/lib/site-config'
import { cn } from '@/lib/utils'

/* ==========================================================================
   /booking-software — the hub: every business with its own page, grouped
   as Rentals, Private trips and Rides, then the tools they all share.
   ========================================================================== */

export const metadata: Metadata = pageMetadata({
  title: HUB.title,
  description: HUB.meta,
  path: HUB.path,
  image: photoUrl(PHOTOS.pxMotorboatDock, 1200),
  imageAlt: PHOTOS.pxMotorboatDock.alt,
})

const RENTALS = NICHE_GROUPS.find((group) => group.key === 'rentals')!
const SMALL_GROUPS = NICHE_GROUPS.filter((group) => group.key !== 'rentals')

const SOLUTIONS = FOOTER_NAV.find((section) => section.heading === 'Solutions')?.links ?? []

export default function BookingSoftwareHub() {
  return (
    <>
      <JsonLd data={hubSchema(NICHE_LIST)} />

      {/* ---------- hero ---------- */}
      <section aria-labelledby="hub-title" className="bg-cal-linen pt-8 pb-16 sm:pt-10 sm:pb-24">
        <div className={WRAP}>
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Booking software' }]} />
          <div className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
            <h1
              id="hub-title"
              className="font-display text-[length:clamp(2.375rem,1.5rem_+_3.3vw,4rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance text-foreground"
            >
              {HUB.h1}
            </h1>
            <p className="mx-auto mt-6 max-w-[40ch] text-[1.1875rem] leading-[1.5] text-pretty text-muted sm:text-[1.3125rem]">{HUB.subhead}</p>
            <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Check aria-hidden="true" className="size-4 text-success" strokeWidth={2.5} />
              {PRICE_LINE}
            </p>
          </div>

          <nav aria-label="Jump to a business" className="mx-auto mt-10 max-w-3xl">
            <ul className="flex flex-wrap justify-center gap-2.5">
              {NICHE_LIST.map((niche) => (
                <li key={niche.slug}>
                  <Link
                    href={`/booking-software/${niche.slug}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-[0.9375rem] font-medium text-foreground ring-1 ring-black/[0.08] transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {niche.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </section>

      {/* ---------- the businesses, grouped ---------- */}
      <div className="bg-background py-20 sm:py-28">
        <div className={WRAP}>
          <section aria-labelledby="group-rentals">
            <GroupHeading id="group-rentals" label={RENTALS.label} line={RENTALS.line} large />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {NICHE_LIST.filter((niche) => niche.group === 'rentals').map((niche) => (
                <li key={niche.slug}>
                  <NicheCard niche={niche} priceLine />
                </li>
              ))}
            </ul>
          </section>

          {/* the two one-business groups share a row with the "not listed" tile */}
          <div className="mt-20 grid gap-x-5 gap-y-14 sm:mt-24 sm:grid-cols-2 lg:grid-cols-3">
            {SMALL_GROUPS.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`} className="flex flex-col">
                <GroupHeading id={`group-${group.key}`} label={group.label} line={group.line} />
                <ul className="mt-6 flex-1">
                  {NICHE_LIST.filter((niche) => niche.group === group.key).map((niche) => (
                    <li key={niche.slug} className="h-full">
                      <NicheCard niche={niche} priceLine />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section aria-labelledby="other-title" className="flex flex-col sm:col-span-2 lg:col-span-1">
              <GroupHeading id="other-title" label="Something else?" line="Tours, classes, venues and more." />
              <div className="mt-6 flex flex-1 flex-col rounded-[1.375rem] bg-cal-linen p-6 sm:p-7">
                <p className="text-[1.0625rem] leading-[1.55] text-foreground">Start with your industry. Same plan, same tools.</p>
                <ul className="mt-5 flex flex-col gap-3 text-[0.9375rem]">
                  {SOLUTIONS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1.5 font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary"
                      >
                        {link.label}
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <Button asChild variant="ink" size="lg" className="rounded-[10px] px-6" rightIcon={<ArrowRight aria-hidden="true" />}>
                    <Link href="/pricing">See pricing</Link>
                  </Button>
                </div>
              </div>
            </section>
          </div>

          <p className="mt-10 text-sm text-muted">Example booking prices. You set your own.</p>
        </div>
      </div>

      {/* ---------- what they all get ---------- */}
      <section aria-labelledby="shared-title" className="bg-background-subtle py-20 sm:py-24">
        <div className={WRAP}>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <h2 id="shared-title" className="font-display text-[1.875rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.5rem]">
                Every rental booking tool, one plan
              </h2>
              <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">Whatever you rent or run, you get all of it for {EZRA_FEE_PERCENT}% of each booking.</p>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SHARED_TOOLS.map((tool) => {
                const Icon = ICONS[tool.icon]
                return (
                  <li key={tool.label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cal-linen text-foreground">
                      <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.75} />
                    </span>
                    <span className="text-[0.9375rem] font-medium text-foreground">{tool.label}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      <ClosingCta />
    </>
  )
}

function GroupHeading({ id, label, line, large = false }: { id: string; label: string; line: string; large?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5', !large && 'flex-col items-start')}>
      <h2
        id={id}
        className={cn(
          'font-display leading-[1.1] font-medium tracking-[-0.03em] text-foreground',
          large ? 'text-[1.875rem] sm:text-[2.5rem]' : 'text-[1.5rem] sm:text-[1.75rem]',
        )}
      >
        {label}
      </h2>
      <p className={cn('text-muted', large ? 'text-[1.0625rem]' : 'text-[0.9375rem]')}>{line}</p>
    </div>
  )
}
