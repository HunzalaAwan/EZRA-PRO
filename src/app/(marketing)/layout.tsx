import type { ReactNode } from 'react'

import { PageTransition } from '@/components/motion/page-transition'
import { SmoothScroll } from '@/components/providers/smooth-scroll'
import { SiteFooter } from '@/components/marketing/site-footer'
import { SiteHeader } from '@/components/marketing/site-header'

/**
 * Public marketing shell.
 *
 * The header is fixed and sits over the hero, so `<main>` carries a static top
 * offset: 2.25rem for the announcement strip plus the bar itself (4rem, 4.5rem
 * from `lg`). The offset never changes — dismissing the strip slides the bar up
 * with a transform rather than collapsing flow — so the page below cannot shift.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <SmoothScroll>
    <div className="relative flex min-h-dvh flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-on-primary focus:shadow-lg"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main-content" className="flex-1 pt-[6.25rem] lg:pt-[6.75rem]">
        <PageTransition>{children}</PageTransition>
      </main>

      <SiteFooter />
    </div>
    </SmoothScroll>
  )
}
