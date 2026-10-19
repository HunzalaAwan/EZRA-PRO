import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { AutomationsClient } from '@/components/dashboard/marketing/automations-client'
import { getMarketingBasics, getMessageSample } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Automations',
  description: 'Emails, texts and to-dos that run on their own: ready-made ideas, your own automations and the messages every booking gets.',
}

type Search = Promise<Record<string, string | string[] | undefined>>

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || null

/**
 * ?recipe=<id> opens the ideas on that recipe and ?flow=<id> opens that
 * automation, so the Overview can link straight to them.
 */
export default async function AutomationsPage({ searchParams }: { searchParams: Search }) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/automations')
  const search = await searchParams
  return (
    <AutomationsClient
      tenant={tenant}
      nowIso={NOW_ISO}
      // Not the guest list: nothing here counts guests, and it runs to megabytes for a big business.
      data={getMarketingBasics(tenant)}
      sample={getMessageSample(tenant)}
      initialRecipe={one(search.recipe)}
      initialFlow={one(search.flow)}
    />
  )
}
