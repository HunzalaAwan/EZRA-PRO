import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getStorefront } from '@/lib/demo'
import { getSeedCharterRequests } from '@/lib/operations'
import { QuoteView } from '@/components/storefront/quote-view'

export const metadata: Metadata = {
  title: 'Your quote',
  robots: { index: false },
}

export default async function QuotePage({ params }: { params: Promise<{ tenant: string; id: string }> }) {
  const { tenant: slug, id } = await params
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant, activities } = storefront
  // Quotes and invoices can be for any activity, not only charters.
  const charters = activities
    .map((activity) => ({
      slug: activity.slug,
      name: activity.name,
      image: activity.media.find((media) => media.isPrimary)?.url ?? activity.media[0]?.url ?? '',
      meetingPoint: activity.meetingPoint,
      tiers: activity.priceTiers.map((tier) => ({ id: tier.id, label: tier.label })),
    }))
  return (
    <QuoteView
      requestId={id}
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      currency={tenant.currency}
      seeded={getSeedCharterRequests(tenant.id)}
      charters={charters}
    />
  )
}
