import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, getCalendarEvents } from '@/lib/demo'
import { addDays } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CalendarShell } from '@/components/dashboard/calendar/calendar-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Calendar',
  description:
    'Every departure, seat and crew assignment on one timeline — month, week, day and agenda views.',
}

/**
 * The initial window comfortably covers the default week view plus a month
 * in either direction, so the first several navigations never round-trip.
 */
const INITIAL_WINDOW = { from: addDays(NOW, -35), to: addDays(NOW, 42) }

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calendar"
        description="Every departure, seat and crew assignment on one timeline. Switch views with M, W, D or A — and press T to jump back to today."
      />
      <CalendarShell
        initialWindow={INITIAL_WINDOW}
        initialEvents={getCalendarEvents(CURRENT_TENANT.id, INITIAL_WINDOW.from, INITIAL_WINDOW.to)}
      />
    </div>
  )
}
