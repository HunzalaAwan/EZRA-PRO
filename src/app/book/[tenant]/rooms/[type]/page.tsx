import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RoomDetail } from '@/components/storefront/hotel/room-detail'
import { TODAY_KEY, getStorefront } from '@/lib/demo'
import { getLodging, nightKeys } from '@/lib/hospitality'
import { getWorkspaceProfile } from '@/lib/workspace-profile'
import { addDays, toDateKey } from '@/lib/utils'

interface Params {
  tenant: string
  type: string
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tenant: slug, type } = await params
  const storefront = getStorefront(slug)
  if (!storefront) return { title: { absolute: 'Room not found' } }
  const roomType = getLodging(storefront.tenant).roomTypes.find((t) => t.slug === type)
  return { title: { absolute: `${roomType?.name ?? 'Room'} · ${storefront.tenant.name}` }, description: roomType?.description }
}

export default async function RoomTypePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tenant: slug, type } = await params
  const query = await searchParams
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant } = storefront
  if (!getWorkspaceProfile(tenant.vertical).modules.lodging) notFound()

  const lodging = getLodging(tenant)
  const roomType = lodging.roomTypes.find((t) => t.slug === type)
  if (!roomType) notFound()

  const end = toDateKey(addDays(new Date(`${TODAY_KEY}T12:00:00`), 90))
  const booked = new Map<string, number>()
  for (const s of lodging.stays) {
    if (s.roomTypeId !== roomType.id || s.status === 'cancelled' || s.status === 'no_show' || s.checkOut < TODAY_KEY || s.checkIn > end) continue
    for (const night of nightKeys(s.checkIn, s.checkOut)) if (night >= TODAY_KEY && night <= end) booked.set(night, (booked.get(night) ?? 0) + 1)
  }
  const roomCount = lodging.rooms.filter((r) => r.typeId === roomType.id && r.housekeeping !== 'out_of_order').length

  const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined)
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const initial = {
    checkIn: dateRe.test(str(query.in) ?? '') ? str(query.in) : undefined,
    checkOut: dateRe.test(str(query.out) ?? '') ? str(query.out) : undefined,
    adults: Number(str(query.adults)) > 0 ? Number(str(query.adults)) : undefined,
    children: Number(str(query.children)) >= 0 && str(query.children) !== undefined ? Number(str(query.children)) : undefined,
  }

  return (
    <RoomDetail
      roomType={roomType}
      otherTypes={lodging.roomTypes.filter((t) => t.id !== roomType.id)}
      settings={lodging.settings}
      booked={[...booked.entries()].map(([night, count]) => ({ night, booked: count }))}
      roomCount={roomCount}
      currency={tenant.currency}
      slug={tenant.slug}
      todayKey={TODAY_KEY}
      initial={initial}
    />
  )
}
