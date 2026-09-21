import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import { notFound } from 'next/navigation'

import { getActivityById } from '@/lib/demo'
import {
  NOW_ISO,
  getActivityDetail,
} from '@/components/dashboard/activities/activity-data'
import { ActivityDetail } from '@/components/dashboard/activities/activity-detail'

interface ActivityPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ActivityPageProps): Promise<Metadata> {
  const { id } = await params
  const activity = getActivityById(id)
  if (!activity) return { title: 'Activity not found' }
  return { title: activity.name, description: activity.tagline }
}

export default async function ActivityDetailPage({ params }: ActivityPageProps) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/activities')
  const { id } = await params
  const detail = getActivityDetail(id)
  if (!detail) notFound()

  return <ActivityDetail detail={detail} tenantSlug={tenant.slug} nowIso={NOW_ISO} />
}
