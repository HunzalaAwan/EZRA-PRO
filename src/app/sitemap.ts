import type { MetadataRoute } from 'next'

import { ALTERNATIVES_SLUGS, CHECKED_ON, VS_SLUGS } from '@/lib/data/competitors'
import { FOOTER_NAV, MARKETING_NAV, SITE } from '@/lib/site-config'

/**
 * The public marketing site. Product, solution, company and legal pages are
 * read from the navigation (every one of them is linked there), so a new page
 * in the nav lands here too. The compare pages carry their real check date.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE.url).toString()

  const navPaths = [
    ...MARKETING_NAV.flatMap((group) => [group.href, ...(group.items ?? []).map((item) => item.href)]),
    ...FOOTER_NAV.flatMap((section) => section.links.map((link) => link.href)),
  ].filter((href): href is string => Boolean(href) && href!.startsWith('/') && !href!.startsWith('/compare') && !href!.startsWith('/alternatives'))

  const general = [...new Set(['/', '/pricing', ...navPaths])].map((path) => ({
    url: url(path),
    changeFrequency: 'monthly' as const,
    priority: path === '/' ? 1 : path === '/pricing' ? 0.9 : 0.7,
  }))

  const compare = [
    { path: '/compare', priority: 0.8 },
    ...VS_SLUGS.map((slug) => ({ path: `/compare/${slug}`, priority: 0.7 })),
    ...ALTERNATIVES_SLUGS.map((slug) => ({ path: `/alternatives/${slug}`, priority: 0.7 })),
  ].map(({ path, priority }) => ({
    url: url(path),
    lastModified: CHECKED_ON,
    changeFrequency: 'monthly' as const,
    priority,
  }))

  return [...general, ...compare]
}
