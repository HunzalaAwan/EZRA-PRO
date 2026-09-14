import type { Metadata } from 'next'

import { BrandingEditor } from '@/components/dashboard/settings/branding-editor'

export const metadata: Metadata = {
  title: 'Branding settings',
  description: 'Logo, cover image and the colours guests see on your storefront and checkout.',
}

export default function BrandingSettingsPage() {
  return (
    <section aria-labelledby="branding-heading" className="flex min-w-0 flex-col gap-1">
      <h2 id="branding-heading" className="sr-only">
        Branding
      </h2>
      <BrandingEditor />
    </section>
  )
}
