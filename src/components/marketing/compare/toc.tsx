'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   TocNav — "On this page".

   aside:  a sticky list beside the article on desktop; the section in view
           is marked.
   mobile: a jump menu (a native <details>) that closes after a pick.

   Plain anchor links, so it works before hydration and without JS.
   ========================================================================== */

export interface TocItem {
  id: string
  label: string
  /** Indented under the item above (an alternative under "The alternatives"). */
  sub?: boolean
}

function useActive(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el))
    if (els.length === 0) return
    const onScroll = () => {
      const line = window.innerHeight * 0.3
      let current: string | null = null
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [ids])
  return active
}

export function TocNav({ items, variant }: { items: TocItem[]; variant: 'aside' | 'mobile' }) {
  const ids = useMemo(() => items.map((item) => item.id), [items])
  const active = useActive(variant === 'aside' ? ids : [])
  const details = useRef<HTMLDetailsElement>(null)

  if (variant === 'mobile') {
    return (
      <details ref={details} className="group rounded-[1rem] bg-surface ring-1 ring-black/[0.08]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-[0.9375rem] font-medium text-foreground [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown aria-hidden="true" className="size-4 text-subtle transition-transform group-open:rotate-180" />
        </summary>
        <nav aria-label="On this page" className="border-t border-line-subtle px-2 py-2">
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={() => {
                    if (details.current) details.current.open = false
                  }}
                  className={cn('block rounded-lg px-3 py-2 text-[0.9375rem] text-muted hover:bg-cal-cloud hover:text-foreground', item.sub && 'pl-7')}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </details>
    )
  }

  return (
    <nav aria-label="On this page">
      <p className="text-xs font-medium tracking-[0.08em] text-subtle uppercase">On this page</p>
      <ul className="mt-4 space-y-0.5 border-l border-line">
        {items.map((item) => {
          const isActive = active === item.id
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  '-ml-px block border-l-2 py-1.5 text-sm leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                  item.sub ? 'pl-7' : 'pl-4',
                  isActive ? 'border-foreground font-medium text-foreground' : 'border-transparent text-muted hover:text-foreground',
                )}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
