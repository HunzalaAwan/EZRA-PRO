import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { TODAY_KEY } from '@/lib/demo'
import { getTicketList } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { CheckInScanner } from '@/components/dashboard/operations/check-in-scanner'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Check-in',
  description: 'Scan a ticket QR code or type the confirmation code to check a party in.',
}

export default async function CheckInPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/check-in')
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Check-in"
        description="Scan the QR code on a guest’s ticket, or type their confirmation code."
      />
      <CheckInScanner tickets={getTicketList(tenant.id)} currency={tenant.currency} todayKey={TODAY_KEY} />
    </div>
  )
}
