'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, ChevronDown, Mail, MessageCircle } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { FAQS } from '@/content/marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { SITE } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import type { FaqItem } from '@/types'

/* ==========================================================================
   ENTITIES DECODER
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': '’',
  '&amp;': '&',
}

const ENTITY_PATTERN = /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|quot|#39|amp);/g

export function decodeEntities(input: string) {
  return input.replace(ENTITY_PATTERN, (match) => ENTITIES[match] ?? match)
}

/* ==========================================================================
   TOP 5 ESSENTIAL FAQS FOR COMPACT VIEW
   ========================================================================== */

const TOP_FAQ_IDS = ['faq-1', 'faq-3', 'faq-5', 'faq-7', 'faq-9']

type FaqFilter = 'popular' | 'all' | 'pricing' | 'product' | 'migration' | 'payments'

const FILTERS: { key: FaqFilter; label: string }[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'migration', label: 'Migration' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'payments', label: 'Payouts' },
  { key: 'product', label: 'Product' },
  { key: 'all', label: 'All (16)' },
]

export interface FaqSectionProps {
  id?: string
  className?: string
}

export function FaqSection({ id = 'faq', className }: FaqSectionProps) {
  const reduceMotion = useReducedMotionSafe()
  const [filter, setFilter] = useState<FaqFilter>('popular')
  const [open, setOpen] = useState<string>(TOP_FAQ_IDS[0])

  const visibleFaqs = useMemo(() => {
    if (filter === 'popular') {
      return FAQS.filter((f) => TOP_FAQ_IDS.includes(f.id))
    }
    if (filter === 'all') {
      return FAQS
    }
    return FAQS.filter((f) => f.category === filter)
  }, [filter])

  const handleSelectFilter = (next: FaqFilter) => {
    setFilter(next)
    const nextList =
      next === 'popular'
        ? FAQS.filter((f) => TOP_FAQ_IDS.includes(f.id))
        : next === 'all'
          ? FAQS
          : FAQS.filter((f) => f.category === next)
    setOpen(nextList[0]?.id ?? '')
  }

  return (
    <section id={id} className={cn('relative py-20 sm:py-24 bg-background border-t border-line/60', className)}>
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header - Compact & Centered */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">Questions</p>
          <h2 className="mt-3.5 font-display text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-[-0.03em] text-foreground text-balance">
            The questions operators ask most
          </h2>
          <p className="mt-2.5 text-sm sm:text-base text-muted text-pretty">
            Straight answers about migration, pricing rates, multi-channel syncing and payouts.
          </p>
        </div>

        {/* Filter Pills - Compact */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {FILTERS.map((f) => {
            const active = f.key === filter
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => handleSelectFilter(f.key)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 shadow-sm',
                  active
                    ? 'bg-primary text-on-primary shadow-primary/20'
                    : 'border border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>

        {/* Compact Accordion List */}
        <motion.div
          key={filter}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: DURATION.quick, ease: EASE_OUT_EXPO }}
          className="mt-8"
        >
          <Accordion
            type="single"
            collapsible
            variant="card"
            value={open}
            onValueChange={setOpen}
            className="space-y-3"
          >
            {visibleFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="rounded-2xl border border-line/80 bg-surface/70 px-5 shadow-xs transition-colors hover:border-line-strong"
              >
                <AccordionTrigger className="py-4 text-left hover:no-underline">
                  <span className="text-[0.9375rem] font-semibold text-foreground pr-4">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1 text-[0.875rem] leading-relaxed text-muted pr-6">
                  {decodeEntities(faq.answer)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        {/* View All / Collapse toggle if in popular view */}
        {filter === 'popular' && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => handleSelectFilter('all')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>View all 16 questions</span>
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        )}

        {/* Compact Contact Footer Bar */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-line/80 bg-surface-sunken/60 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-left">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Have a specific operational question?</p>
              <p className="text-xs text-muted">We reply within minutes. Free migration from your current platform.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <Button asChild size="sm" variant="primary" rightIcon={<ArrowRight className="size-3.5" />}>
              <Link href="/contact">Book 15-min demo</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" leftIcon={<Mail className="size-3.5" />}>
              <a href={`mailto:${SITE.supportEmail}`}>Email team</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
