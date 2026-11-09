import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { MenuManager } from '@/components/dashboard/hospitality/menu-manager'
import { getMenu } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu',
  description: 'Every dish, its sizes, choices and meals, where it sells and how it did this month.',
}

export default async function MenuPage() {
  const { tenant, profile } = await requireWorkspaceRoute('/dashboard/menu')
  const menu = getMenu(tenant.id)

  return (
    <>
      <PageHeader
        title="Menu"
        description="Dishes, sizes, choices and meals. Switch a dish or a single option off when it runs out; it comes off the ordering page straight away."
      />
      <MenuManager menu={menu} tenantId={tenant.id} currency={tenant.currency} storefrontHref={`/book/${tenant.slug}#menu`} hotel={profile.modules.lodging} />
    </>
  )
}
