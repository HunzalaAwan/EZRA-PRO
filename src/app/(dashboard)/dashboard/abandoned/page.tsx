import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { AbandonedClient } from '@/components/dashboard/recovery/abandoned-client'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { CURRENT_TENANT } from '@/lib/demo'
import { getAbandonedCheckouts } from '@/lib/data/abandoned'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Abandoned carts',
  description: 'Guests who picked a date and seats but did not pay, and the reminders that bring them back.',
}

/* ==========================================================================
   /dashboard/abandoned — every checkout that stopped before payment, with
   what it was worth, where it stopped, and one click to follow up.
   ========================================================================== */

export default function AbandonedPage() {
  const tenant = CURRENT_TENANT
  const rows = getAbandonedCheckouts(tenant)
  const open = rows.filter((row) => row.status === 'open' || row.status === 'reminded')
  const openValue = open.reduce((sum, row) => sum + row.total, 0)

  return (
    <>
      <PageHeader
        title="Abandoned carts"
        description={`${open.length} ${open.length === 1 ? 'guest' : 'guests'} picked a date and seats but did not pay, worth ${formatCurrency(openValue, tenant.currency, { compact: true })}. Most come back after one reminder.`}
      />
      <AbandonedClient rows={rows} currency={tenant.currency} nowIso={NOW_ISO} recoveryDelayMinutes={45} recoveryDiscountPercent={10} />
    </>
  )
}
