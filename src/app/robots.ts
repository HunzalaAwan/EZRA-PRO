import type { MetadataRoute } from 'next'

import { SITE } from '@/lib/site-config'

/** The marketing site is public; the dashboard and sign-in screens are not for search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/login', '/signup', '/onboarding', '/forgot-password'] }],
    sitemap: new URL('/sitemap.xml', SITE.url).toString(),
  }
}
