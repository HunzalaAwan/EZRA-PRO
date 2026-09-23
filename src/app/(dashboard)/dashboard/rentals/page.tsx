import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getRentalBoard } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { RentalsBoard } from '@/components/dashboard/operations/rentals-board'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rentals',
  description: 'Every unit on a timeline: what is out, what is due back and what is late.',
}

export default async function RentalsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/rentals')
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Rentals"
        description="Today's units, one row each. Click a rental to hand it out or take it back."
      />
      <RentalsBoard board={getRentalBoard(tenant.id)} currency={tenant.currency} />
    </div>
  )
}
