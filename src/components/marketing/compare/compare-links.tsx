import { VS_CONTENT } from '@/components/marketing/compare/compare-content'
import { LinkCards, WRAP } from '@/components/marketing/compare/compare-ui'
import { VENDORS, type VsSlug } from '@/lib/data/competitors'

/* ==========================================================================
   CompareLinks — a short "how we compare" row for product and solution
   pages, pointing at the comparisons most relevant to that page.
   ========================================================================== */

/** Which comparisons each product and solution page leads to. Unknown keys get the hub only. */
const RELEVANT: Record<string, VsSlug[]> = {
  // product pages
  booking: ['fareharbor', 'xola', 'peek-pro'],
  scheduling: ['checkfront', 'bokun', 'rezdy'],
  analytics: ['bokun', 'rezdy'],
  payments: ['xola', 'fareharbor', 'checkfront'],
  crm: ['peek-pro', 'xola'],
  channels: ['bokun', 'rezdy', 'fareharbor'],
  // solution pages
  watersports: ['peek-pro', 'fareharbor', 'checkfront'],
  tours: ['fareharbor', 'bokun', 'rezdy'],
  island: ['bokun', 'rezdy', 'xola'],
  adventure: ['peek-pro', 'xola', 'checkfront'],
  wellness: ['xola', 'checkfront'],
}

export function CompareLinks({ pageKey }: { pageKey: string }) {
  const slugs = RELEVANT[pageKey] ?? []
  const links = [
    ...slugs.map((slug) => ({
      href: `/compare/${slug}`,
      label: VS_CONTENT[slug].h1,
      note: VENDORS[VS_CONTENT[slug].vendor].model.text,
    })),
    { href: '/compare', label: 'All comparisons', note: 'Eleven booking systems, a fee calculator and our sources.' },
  ]

  return (
    <section aria-labelledby={`compare-links-${pageKey}`} className="border-t border-line bg-background py-16 sm:py-20">
      <div className={WRAP}>
        <p className="text-xs font-medium tracking-[0.08em] text-primary uppercase">Compare</p>
        <h2
          id={`compare-links-${pageKey}`}
          className="mt-3 font-display text-[1.75rem] leading-[1.15] font-medium tracking-[-0.03em] text-foreground sm:text-[2.125rem]"
        >
          How EZRA Pro compares
        </h2>
        <p className="mt-3 max-w-2xl text-[1.0625rem] leading-[1.6] text-muted">
          Fees, features and who each system suits, with a source and a date beside every fact.
        </p>
        <div className="mt-8">
          <LinkCards links={links} />
        </div>
      </div>
    </section>
  )
}
