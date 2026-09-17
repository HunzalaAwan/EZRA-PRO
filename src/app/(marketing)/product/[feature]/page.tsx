import { Fragment } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { PricingSection } from '@/components/marketing/pricing-section'
import { PRODUCT_CONTENT, PRODUCT_KEYS, type ProductKey } from '@/components/marketing/product/product-content'
import { FieldPanel, KeyPoints, ProductHero, ProductRows, RelatedProducts } from '@/components/marketing/product/product-sections'

/* ==========================================================================
   /product/[feature] — one page per piece of the product.

   The order a first visit needs:
     hero      the claim, with the product working beside it
     points    three things it does
     rows      two things in detail, with a graphic each
     field     an operator, and what the product did for them
     pricing   the price, plainly
     related   the rest of the product
     closing   the ask
   ========================================================================== */

function resolve(slug: string): ProductKey | null {
  return (PRODUCT_KEYS as string[]).includes(slug) ? (slug as ProductKey) : null
}

export function generateStaticParams() {
  return PRODUCT_KEYS.map((feature) => ({ feature }))
}

export async function generateMetadata({ params }: { params: Promise<{ feature: string }> }): Promise<Metadata> {
  const { feature } = await params
  const key = resolve(feature)
  if (!key) return { title: 'Product not found' }
  const content = PRODUCT_CONTENT[key]
  return {
    title: content.label,
    description: content.description,
    alternates: { canonical: `/product/${key}` },
    openGraph: { url: `/product/${key}`, title: `${content.label} — EZRA Pro`, description: content.description },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params
  const key = resolve(feature)
  if (!key) notFound()

  const content = PRODUCT_CONTENT[key]
  const related = PRODUCT_KEYS.filter((k) => k !== key).map((k) => ({
    key: k,
    label: PRODUCT_CONTENT[k].label,
    icon: PRODUCT_CONTENT[k].icon,
    line: PRODUCT_CONTENT[k].headline,
  }))

  return (
    <>
      <ProductHero content={content}>{content.hero.node}</ProductHero>
      <KeyPoints points={content.points} />
      <ProductRows rows={content.rows}>
        {content.rows.map((row) => (
          <Fragment key={row.title}>{row.node}</Fragment>
        ))}
      </ProductRows>
      <FieldPanel field={content.field} />
      <PricingSection className="scroll-mt-4 border-t border-line bg-background-subtle py-20 sm:py-24" />
      <RelatedProducts items={related} />
      <ClosingCta />
    </>
  )
}
