import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { OrderCheckout } from '@/components/storefront/restaurant/order-checkout'
import { NOW, TAX_RATE, getStorefront } from '@/lib/demo'
import { getDiningSettings } from '@/lib/hospitality'
import { getWorkspaceProfile } from '@/lib/workspace-profile'

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`
const TAX_LABEL: Record<string, string> = { tnt_saltline: 'VAT (13%)', tnt_casavela: 'IVA (13%)' }

export async function generateMetadata({ params }: { params: Promise<{ tenant: string }> }): Promise<Metadata> {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  return { title: { absolute: `Checkout · ${storefront?.tenant.name ?? 'Order'}` }, robots: { index: false, follow: false } }
}

export default async function OrderPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant } = storefront
  if (!getWorkspaceProfile(tenant.vertical).modules.dining) notFound()

  return (
    <OrderCheckout
      slug={tenant.slug}
      tenantName={tenant.name}
      tenantPhone={tenant.contact.phone}
      ordering={getDiningSettings(tenant.id).ordering}
      currency={tenant.currency}
      taxRate={TAX_RATE[tenant.id] ?? 0}
      taxLabel={TAX_LABEL[tenant.id] ?? 'Tax'}
      nowTime={NOW_TIME}
    />
  )
}
