import type { Metadata } from 'next'

import { CHECKED_ON, EZRA_PLAN, PUBLISHED_ON } from '@/lib/data/competitors'
import { SITE } from '@/lib/site-config'

/* ==========================================================================
   Metadata and structured data for the compare pages.

   Dates in the schema are the same constants the pages print, so the
   visible "Last checked" date and dateModified can never disagree.
   SoftwareApplication describes EZRA Pro only, with its one plan as a single
   offer and no ratings: third-party ratings must never be marked up.
   ========================================================================== */

const abs = (path: string) => new URL(path, SITE.url).toString()

export function compareMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      siteName: SITE.name,
      url: path,
      title,
      description,
      publishedTime: PUBLISHED_ON,
      modifiedTime: CHECKED_ON,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: abs(item.path),
    })),
  }
}

export function articleSchema({ headline, description, path }: { headline: string; description: string; path: string }) {
  const org = { '@type': 'Organization', name: SITE.name, url: SITE.url }
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    datePublished: PUBLISHED_ON,
    dateModified: CHECKED_ON,
    author: org,
    publisher: org,
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(path) },
  }
}

export function ezraSoftwareSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    url: SITE.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: SITE.description,
    offers: {
      '@type': 'Offer',
      name: EZRA_PLAN.name,
      price: String(EZRA_PLAN.monthly),
      priceCurrency: 'USD',
      description: `$${EZRA_PLAN.monthly} a month. ${EZRA_PLAN.percent}% of each booking, paid by the business or passed to guests as a booking fee. No setup fee, no contract.`,
      url: abs('/pricing'),
    },
  }
}
