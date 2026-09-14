'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, Mail, MessageCircle, Timer } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
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
   ENTITIES

   The answers are authored with HTML entities so they read correctly in any
   surface that renders them as markup. React escapes strings, so they are
   decoded here into real characters instead of shipping `&rsquo;` to the page.
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': '’',
  '&amp;': '&',
}

const ENTITY_PATTERN = /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|quot|#39|amp);/g

export function decodeEntities(input: string) {
  return input.replace(ENTITY_PATTERN, (match) => ENTITIES[match] ?? match)
}

/* ==========================================================================
   CATEGORIES
   ========================================================================== */

const CATEGORY_ORDER = ['pricing', 'product', 'migration', 'payments', 'support'] as const

type FaqCategory = FaqItem['category']
type FaqFilter = 'all' | FaqCategory

const FILTERS: FaqFilter[] = ['all', ...CATEGORY_ORDER]

const FILTER_LABEL: Record<FaqFilter, string> = {
  all: 'All questions',
  pricing: 'Pricing',
  product: 'Product',
  migration: 'Migration',
  payments: 'Payments',
  support: 'Support',
}

const FILTER_COUNT: Record<FaqFilter, number> = {
  all: FAQS.length,
  pricing: FAQS.filter((faq) => faq.category === 'pricing').length,
  product: FAQS.filter((faq) => faq.category === 'product').length,
  migration: FAQS.filter((faq) => faq.category === 'migration').length,
  payments: FAQS.filter((faq) => faq.category === 'payments').length,
  support: FAQS.filter((faq) => faq.category === 'support').length,
}

/* ==========================================================================
   Contact card — rendered once per breakpoint so the mobile order stays
   heading → answers → contact, while desktop keeps it in the sticky rail.
   ========================================================================== */

function ContactCard({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        'rounded-2xl border bg-surface p-5 shadow-sm sm:p-6',
        'bg-[linear-gradient(150deg,color-mix(in_oklab,var(--primary)_8%,var(--surface))_0%,var(--surface)_58%,color-mix(in_oklab,var(--accent)_7%,var(--surface))_100%)]',
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <MessageCircle className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-foreground">
        Still have questions?
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Talk to someone who has moved operators off FareHarbor and Peek Pro mid-season. Bring your
        weirdest pricing rule — we will tell you honestly whether it fits.
      </p>

      <p className="mt-4 flex items-center gap-2 text-xs font-medium text-muted">
        <Timer className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        Median first reply in under five minutes, seven days a week
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        <Button asChild size="md" variant="primary" fullWidth rightIcon={<ArrowRight aria-hidden="true" />}>
          <Link href="/contact">Book a 20-min demo</Link>
        </Button>
        <Button
          asChild
          size="md"
          variant="secondary"
          fullWidth
          leftIcon={<Mail aria-hidden="true" />}
        >
          <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>
        </Button>
      </div>
    </aside>
  )
}

/* ==========================================================================
   Section
   ========================================================================== */

export interface FaqSectionProps {
  id?: string
  className?: string
}

export function FaqSection({ id = 'faq', className }: FaqSectionProps) {
  const reduceMotion = useReducedMotionSafe()
  const [filter, setFilter] = useState<FaqFilter>('all')
  const [open, setOpen] = useState<string>(FAQS[0]?.id ?? '')

  const visible = useMemo(
    () => (filter === 'all' ? FAQS : FAQS.filter((faq) => faq.category === filter)),
    [filter],
  )

  const selectFilter = (next: FaqFilter) => {
    setFilter(next)
    const nextList = next === 'all' ? FAQS : FAQS.filter((faq) => faq.category === next)
    // Keep exactly one panel open, and make it the first of the new set.
    setOpen(nextList[0]?.id ?? '')
  }

  return (
    <section id={id} className={cn('relative py-20 sm:py-28', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
          {/* ---------- Sticky rail ---------- */}
          <div className="flex flex-col gap-8 lg:sticky lg:top-28">
            <SectionHeading
              align="left"
              eyebrow="FAQ"
              title="The questions operators actually ask"
              description="Sixteen straight answers about commission, migration, payouts and what happens when the signal drops at the dock."
            />
            <ContactCard className="max-lg:hidden" />
          </div>

          {/* ---------- Filters + accordion ---------- */}
          <div>
            <div
              role="group"
              aria-label="Filter questions by topic"
              className="flex flex-wrap gap-2"
            >
              {FILTERS.map((option) => {
                const active = option === filter
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectFilter(option)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5',
                      'text-[0.8125rem] font-medium whitespace-nowrap',
                      'transition-[color,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      active
                        ? 'border-[color-mix(in_oklab,var(--primary)_38%,transparent)] bg-primary-soft text-primary shadow-sm'
                        : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                    )}
                  >
                    {FILTER_LABEL[option]}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular',
                        active ? 'bg-surface text-primary' : 'bg-surface-sunken text-subtle',
                      )}
                    >
                      {FILTER_COUNT[option]}
                    </span>
                  </button>
                )
              })}
            </div>

            <motion.div
              key={filter}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduceMotion ? { duration: 0 } : { duration: DURATION.quick, ease: EASE_OUT_EXPO }
              }
              className="mt-6"
            >
              <Accordion
                type="single"
                collapsible
                variant="card"
                value={open}
                onValueChange={setOpen}
              >
                {visible.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger className="py-5 text-left">
                      <span className="flex flex-col gap-1.5">
                        {filter === 'all' ? (
                          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                            {FILTER_LABEL[faq.category]}
                          </span>
                        ) : null}
                        <span className="text-[0.9375rem] leading-snug font-medium">
                          {faq.question}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 pr-2 sm:pr-8">
                      <p className="text-sm leading-relaxed text-muted">
                        {decodeEntities(faq.answer)}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>

            <ContactCard className="mt-8 lg:hidden" />
          </div>
        </div>
      </div>
    </section>
  )
}
