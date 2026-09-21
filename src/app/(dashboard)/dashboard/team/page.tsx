import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { CURRENT_USER, NOW, getUsersByTenant } from '@/lib/demo'
import { TeamPageClient } from '@/components/dashboard/team/team-page-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Team',
  description: 'Everyone with access to this workspace, and what they can do.',
}

export default async function TeamPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/team')
  return (
    <TeamPageClient
      tenant={tenant}
      currentUserId={CURRENT_USER.id}
      initialMembers={getUsersByTenant(tenant.id)}
      now={NOW}
    />
  )
}
