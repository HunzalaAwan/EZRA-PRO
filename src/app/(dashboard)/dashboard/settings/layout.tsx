import type { Metadata } from 'next'
import Link from 'next/link'
import { ExternalLink, LifeBuoy } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { SettingsNav } from '@/components/dashboard/settings/settings-nav'
import { Button } from '@/components/ui/button'
import { CURRENT_TENANT } from '@/lib/demo'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Business profile, branding, booking rules, payments and billing.',
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Settings"
        description={`Everything that shapes how ${CURRENT_TENANT.name} sells, schedules and gets paid.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leftIcon={<LifeBuoy />} asChild>
              <Link href="/help">Help center</Link>
            </Button>
            <Button variant="outline" size="sm" rightIcon={<ExternalLink />} asChild>
              <Link href={`/book/${CURRENT_TENANT.slug}`}>View storefront</Link>
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
