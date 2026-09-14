import type { Metadata } from 'next'

import { CURRENT_TENANT, CURRENT_USER, NOW, getUsersByTenant } from '@/lib/demo'
import { TeamPageClient } from '@/components/dashboard/team/team-page-client'

export const metadata: Metadata = {
  title: 'Team',
  description: 'Everyone with access to this workspace, and what they can do.',
}

export default function TeamPage() {
  return (
    <TeamPageClient
      tenant={CURRENT_TENANT}
      currentUserId={CURRENT_USER.id}
      initialMembers={getUsersByTenant(CURRENT_TENANT.id)}
      now={NOW}
    />
  )
}
