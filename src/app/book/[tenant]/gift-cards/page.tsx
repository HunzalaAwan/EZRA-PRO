import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TODAY_KEY, getStorefront } from '@/lib/demo'
import { GiftCardShop } from '@/components/storefront/gift-card-shop'

export const metadata: Metadata = {
  title: 'Gift cards',
}

export default async function GiftCardsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant } = storefront
  return <GiftCardShop tenantSlug={tenant.slug} tenantName={tenant.name} currency={tenant.currency} todayKey={TODAY_KEY} />
}
