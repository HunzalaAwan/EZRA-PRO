import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { MenuManager } from '@/components/dashboard/hospitality/menu-manager'
import { getMenu } from '@/lib/hospitality'
import { formatNumber } from '@/lib/utils'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Every dish, its price, where it sells and how it did this month.',
}

export default async function MenuPage() {
  const { tenant, profile } = await requireWorkspaceRoute('/dashboard/menu')
  const menu = getMenu(tenant.id)
  const onSale = menu.items.filter((i) => i.status === 'available').length

  return (
    <>
      <PageHeader
        title="Menu"
        description={`${formatNumber(onSale)} dishes on sale across ${menu.categories.length} sections. Switch a dish off when it runs out; it disappears from the storefront and the QR card straight away.`}
      />
      <MenuManager menu={menu} currency={tenant.currency} storefrontHref={`/book/${tenant.slug}#menu`} hotel={profile.modules.lodging} />
    </>
  )
}
