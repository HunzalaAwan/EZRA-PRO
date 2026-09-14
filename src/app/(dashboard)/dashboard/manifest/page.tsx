import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, getManifest } from '@/lib/demo'
import { PageHeader } from '@/components/dashboard/page-header'
import { ManifestView } from '@/components/dashboard/bookings/manifest-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Daily manifest · EZRA Pro',
  description:
    'The dock run sheet — every departure, crew, vessel and guest for the day, with one-tap check-in.',
}

export default function ManifestPage() {
  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-3 print:pb-0">
      <div className="print:hidden">
        <PageHeader
          className="mb-0"
          title="Daily manifest"
          description="The dock run sheet. Check guests in, flag no-shows, and see who is on the water — built to be read on a phone in full sun."
        />
      </div>

      <ManifestView initialManifest={getManifest(CURRENT_TENANT.id, NOW)} />
    </div>
  )
}
