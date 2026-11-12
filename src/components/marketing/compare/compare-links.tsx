import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { VsCards } from '@/components/marketing/compare/compare-ui'
import { EZRA_PRICE_LINE, VS_SLUGS, type VsSlug } from '@/lib/data/competitors'

/* ==========================================================================
   CompareLinks — a short "how we compare" row for product and solution
   pages: the three vs cards, the one most relevant to the page first, and
   a link to all four side by side.
   ========================================================================== */

/** Which comparison leads on each product and solution page. Unknown keys keep the default order. */
const LEAD: Record<string, VsSlug> = {
  // product pages
  booking: 'fareharbor',
  scheduling: 'bokun',
  analytics: 'bokun',
  payments: 'fareharbor',
  crm: 'peek-pro',
  channels: 'bokun',
  // solution pages
  watersports: 'peek-pro',
  tours: 'fareharbor',
  island: 'bokun',
  adventure: 'peek-pro',
  wellness: 'fareharbor',
}

export function CompareLinks({ pageKey }: { pageKey: string }) {
  const lead = LEAD[pageKey]
  const slugs = lead ? [lead, ...VS_SLUGS.filter((slug) => slug !== lead)] : VS_SLUGS

  return (
    <section aria-labelledby={`compare-links-${pageKey}`} className="border-t border-line bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h2
              id={`compare-links-${pageKey}`}
              className="font-display text-[1.75rem] leading-[1.15] font-medium tracking-[-0.03em] text-foreground sm:text-[2.125rem]"
            >
              How EZRA Pro compares
            </h2>
            <p className="mt-3 max-w-2xl text-[1.0625rem] leading-[1.6] text-muted">{EZRA_PRICE_LINE}</p>
          </div>
          <Link
            href="/compare"
            className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary"
          >
            EZRA Pro vs FareHarbor, Peek Pro and Bókun
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="mt-8">
          <VsCards slugs={slugs} />
        </div>
      </div>
    </section>
  )
}
