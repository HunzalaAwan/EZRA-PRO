import type { Metadata } from 'next'

import { breadcrumbSchema, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { HUB, type Niche } from '@/content/booking-software'
import { SITE } from '@/lib/site-config'

/* ==========================================================================
   Metadata and JSON-LD for /booking-software and its pages.

   SoftwareApplication is the one the compare pages use: EZRA Pro's single
   $0 offer that describes the 4%, and no ratings. FAQPage answers are the
   same strings the page prints, so the markup always matches what is shown.
   ========================================================================== */

const abs = (path: string) => new URL(path, SITE.url).toString()

export const nichePath = (niche: Pick<Niche, 'slug'>) => `${HUB.path}/${niche.slug}`

export function pageMetadata({ title, description, path, image, imageAlt }: { title: string; description: string; path: string; image?: string; imageAlt?: string }): Metadata {
  const images = image ? [{ url: image, width: 1200, alt: imageAlt ?? title }] : undefined
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: SITE.name, url: path, title, description, images },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  }
}

export function nicheMetadata(niche: Niche): Metadata {
  const photo = PHOTOS[niche.photo]
  return pageMetadata({ title: niche.title, description: niche.meta, path: nichePath(niche), image: photoUrl(photo, 1200), imageAlt: photo.alt })
}

function webPageSchema({ path, title, description, image, type = 'WebPage' }: { path: string; title: string; description: string; image?: string; type?: 'WebPage' | 'CollectionPage' }) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': abs(path),
    url: abs(path),
    name: title,
    description,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
    about: { '@type': 'SoftwareApplication', name: SITE.name, url: SITE.url },
    ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: image } } : {}),
  }
}

export function nicheSchema(niche: Niche) {
  const path = nichePath(niche)
  return [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Booking software', path: HUB.path },
      { name: niche.name, path },
    ]),
    webPageSchema({ path, title: niche.title, description: niche.meta, image: photoUrl(PHOTOS[niche.photo], 1200) }),
    ezraSoftwareSchema(),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: niche.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    },
  ]
}

export function hubSchema(niches: Niche[]) {
  return [
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Booking software', path: HUB.path },
    ]),
    {
      ...webPageSchema({ path: HUB.path, title: HUB.title, description: HUB.meta, type: 'CollectionPage' }),
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: niches.length,
        itemListElement: niches.map((niche, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: niche.software,
          url: abs(nichePath(niche)),
        })),
      },
    },
    ezraSoftwareSchema(),
  ]
}
