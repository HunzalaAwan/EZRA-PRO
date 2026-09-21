import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ReserveFlow } from '@/components/storefront/restaurant/reserve-flow'
import { NOW, TODAY_KEY, getStorefront } from '@/lib/demo'
import { getDiningSettings } from '@/lib/hospitality'
import { getWorkspaceProfile } from '@/lib/workspace-profile'

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export async function generateMetadata({ params }: { params: Promise<{ tenant: string }> }): Promise<Metadata> {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  return { title: { absolute: `Reserve a table · ${storefront?.tenant.name ?? ''}` }, robots: { index: false, follow: false } }
}

export default async function ReservePage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tenant: slug } = await params
  const query = await searchParams
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant } = storefront
  if (!getWorkspaceProfile(tenant.vertical).modules.dining) notFound()

  const date = typeof query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : undefined
  const time = typeof query.time === 'string' && /^\d{2}:\d{2}$/.test(query.time) ? query.time : undefined
  const party = typeof query.party === 'string' && Number(query.party) > 0 ? Math.min(20, Math.floor(Number(query.party))) : undefined

  return (
    <ReserveFlow
      slug={tenant.slug}
      tenantName={tenant.name}
      tenantPhone={tenant.contact.phone}
      addressLine={tenant.contact.addressLine}
      settings={getDiningSettings(tenant.id)}
      currency={tenant.currency}
      todayKey={TODAY_KEY}
      nowTime={NOW_TIME}
      initial={{ date, time, party }}
    />
  )
}
