import type { Metadata } from 'next'

import { CURRENT_TENANT, getStorefront } from '@/lib/demo'
import { StorefrontAdminClient } from '@/components/dashboard/storefront/storefront-admin-client'

export const metadata: Metadata = {
  title: 'Storefront',
  description: 'Your public booking site, embed code and domain settings.',
}

export default function StorefrontAdminPage() {
  return <StorefrontAdminClient tenant={CURRENT_TENANT} storefront={getStorefront(CURRENT_TENANT.slug)} />
}
