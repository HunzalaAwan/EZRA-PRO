import { redirect } from 'next/navigation'

/** Branding lives on the Storefront page now; old links still land somewhere useful. */
export default function BrandingSettingsPage() {
  redirect('/dashboard/storefront#brand')
}
