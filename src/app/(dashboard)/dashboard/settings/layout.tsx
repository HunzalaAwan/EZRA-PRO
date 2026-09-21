import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import Link from 'next/link'
import { ExternalLink, LifeBuoy } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { SettingsNav } from '@/components/dashboard/settings/settings-nav'
import { Button } from '@/components/ui/button'


export const metadata: Metadata = {
  title: 'Settings',
  description: 'Business profile, branding, booking rules, payments and billing.',
}

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Settings"
        description={`Everything that shapes how ${tenant.name} sells, schedules and gets paid.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<LifeBuoy />} asChild>
              <Link href="/contact">Help</Link>
            </Button>
            <Button variant="outline" size="sm" rightIcon={<ExternalLink />} asChild>
              <Link href={`/book/${tenant.slug}`}>View storefront</Link>
            </Button>
          </div>
        }
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <SettingsNav />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </div>
  )
}
