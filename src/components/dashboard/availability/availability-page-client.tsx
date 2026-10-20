'use client'

import Link from 'next/link'

import { PageHeader } from '@/components/dashboard/page-header'
import { ActivitySchedulesCard } from '@/components/dashboard/availability/activity-schedules-card'
import { ClosedDaysCard } from '@/components/dashboard/availability/closed-days-card'
import { Button } from '@/components/ui/button'
import type { Activity, Tenant } from '@/types'

/* ==========================================================================
   AVAILABILITY — the business-level view of when things run: the days the
   whole business is closed (its own closed days and public holidays, kept
   in Settings → Booking flow's store), and each activity's schedule in one
   line, with a link to that activity's Schedule step.
   ========================================================================== */

export interface AvailabilityPageClientProps {
  tenant: Tenant
  /** Live activities, as seeded; saved edits are laid over them here. */
  activities: Activity[]
  /** "YYYY-MM-DD", the demo's today. */
  todayKey: string
  /** The demo clock, local ISO. */
  nowIso: string
  /** Booked time slots per day ahead, for the closed-days form. */
  bookedByDay?: Record<string, number>
  /** Open the closed-days form straight away (Overview → Close a day). */
  openAdd?: boolean
}

export function AvailabilityPageClient({ tenant, activities, todayKey, nowIso, bookedByDay, openAdd = false }: AvailabilityPageClientProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Availability"
        description="Closed days for the whole business, and each activity’s schedule."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/calendar">Open calendar</Link>
          </Button>
        }
      />
      <ClosedDaysCard tenant={tenant} todayKey={todayKey} bookedByDay={bookedByDay} openAdd={openAdd} />
      <ActivitySchedulesCard tenantSlug={tenant.slug} activities={activities} todayKey={todayKey} nowIso={nowIso} />
    </div>
  )
}
