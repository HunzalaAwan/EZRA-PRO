import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getStorefront } from '@/lib/demo'
import { StorefrontAdminClient } from '@/components/dashboard/storefront/storefront-admin-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Storefront',
  description: 'Your public booking site, embed code and domain settings.',
}

export default async function StorefrontAdminPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/storefront')
  return <StorefrontAdminClient tenant={tenant} storefront={getStorefront(tenant.slug)} />
}
