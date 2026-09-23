import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW } from '@/lib/demo'
import { getCapacityBoard } from '@/lib/capacity'
import { addDays, toDateKey } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CapacityBoard } from '@/components/dashboard/operations/capacity-board'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Capacity',
  description: 'Shared fleets and boats: what is in use, what is in maintenance and where the day clashes.',
}

export default async function CapacityPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/capacity')
  const { day } = await searchParams
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(NOW, index)
    return {
      key: toDateKey(date),
      label: index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(date),
    }
  })
  const chosen = days.find((entry) => entry.key === day)?.key ?? days[0].key
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Capacity"
        description="Fleets are shared by every activity that uses them, and a private charter takes the whole boat. The storefront stops selling at the limit."
      />
      <CapacityBoard board={getCapacityBoard(tenant.id, new Date(`${chosen}T12:00:00`))} days={days} />
    </div>
  )
}
