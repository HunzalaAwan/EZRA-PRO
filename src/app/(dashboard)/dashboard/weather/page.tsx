import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getWeatherBoard } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { WeatherBoard } from '@/components/dashboard/operations/weather-board'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Weather & conditions',
  description: 'Hold, cancel or move the week’s departures together when the weather turns, with one message to every guest.',
}

export default async function WeatherPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/weather')
  const board = getWeatherBoard(tenant.id)
  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        className="mb-0"
        title="Weather & conditions"
        description="The week’s departures with guests and their forecast. Select the runs at risk and hold, move or cancel them together."
      />
      <WeatherBoard runs={board.runs} days={board.days} business={tenant.name} currency={tenant.currency} />
    </div>
  )
}
