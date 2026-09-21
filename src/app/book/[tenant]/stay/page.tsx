import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { StayCheckout } from '@/components/storefront/hotel/stay-checkout'
import { TODAY_KEY, getStorefront } from '@/lib/demo'
import { getLodging } from '@/lib/hospitality'
import { defaultStaySearch } from '@/lib/stay-search'
import { getWorkspaceProfile } from '@/lib/workspace-profile'

export async function generateMetadata({ params }: { params: Promise<{ tenant: string }> }): Promise<Metadata> {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  return { title: { absolute: `Book a stay · ${storefront?.tenant.name ?? ''}` }, robots: { index: false, follow: false } }
}

export default async function StayPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tenant: slug } = await params
  const query = await searchParams
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant } = storefront
  if (!getWorkspaceProfile(tenant.vertical).modules.lodging) notFound()

  const lodging = getLodging(tenant)
  const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)
  const roomType = lodging.roomTypes.find((t) => t.slug === str(query.type)) ?? null
  if (!roomType) redirect(`/book/${tenant.slug}#rooms`)

  const fallback = defaultStaySearch(TODAY_KEY)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const checkIn = dateRe.test(str(query.in) ?? '') && (str(query.in) as string) >= TODAY_KEY ? (str(query.in) as string) : fallback.checkIn
  const checkOutRaw = str(query.out)
  const checkOut = dateRe.test(checkOutRaw ?? '') && (checkOutRaw as string) > checkIn ? (checkOutRaw as string) : checkIn === fallback.checkIn ? fallback.checkOut : `${checkIn.slice(0, 8)}${String(Math.min(28, Number(checkIn.slice(8)) + 2)).padStart(2, '0')}`
  const adults = Math.min(roomType.maxAdults, Math.max(1, Number(str(query.adults)) || fallback.adults))
  const children = Math.min(Math.max(0, roomType.maxGuests - adults), Math.max(0, Number(str(query.children)) || 0))
  const plan = lodging.settings.ratePlans.find((p) => p.id === str(query.plan)) ?? lodging.settings.ratePlans[0]
  const extraIds = (str(query.extras) ?? '').split(',').filter((id) => lodging.settings.extras.some((e) => e.id === id))

  return (
    <StayCheckout
      slug={tenant.slug}
      tenantName={tenant.name}
      tenantPhone={tenant.contact.phone}
      addressLine={tenant.contact.addressLine}
      roomType={roomType}
      plan={plan}
      extraIds={extraIds}
      search={{ checkIn, checkOut, adults, children }}
      settings={lodging.settings}
      currency={tenant.currency}
    />
  )
}
