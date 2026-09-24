import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getRentalBoard } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { RentalsBoard } from '@/components/dashboard/operations/rentals-board'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rentals',
  description: 'What to hand out, what is out and what is due back, in time order.',
}

export default async function RentalsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/rentals')
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Rentals"
        description="What to hand out next, what is out, and what is due back. One button per rental."
      />
      <RentalsBoard board={getRentalBoard(tenant.id)} currency={tenant.currency} />
    </div>
  )
}
