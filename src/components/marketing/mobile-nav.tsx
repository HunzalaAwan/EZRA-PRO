'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import {
  ArrowRight,
  ArrowRightLeft,
  Blocks,
  CalendarDays,
  ChartSpline,
  Code2,
  Compass,
  CreditCard,
  LifeBuoy,
  Mountain,
  Palmtree,
  Quote,
  Share2,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Users,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react'

import { MARKETING_NAV, type NavGroup } from '@/lib/site-config'
import { HERO } from '@/content/marketing'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO, STAGGER } from '@/lib/motion'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet'
import { Logo } from '@/components/marketing/logo'

/* ==========================================================================
   NAV ICON RESOLUTION

   `site-config` stores lucide icon *names* so it stays a plain data module.
   The lookup table lives here rather than in `site-header` because the header
   already imports this file for <MobileNav />; putting it the other way round
   would make the import graph cyclic.
   ========================================================================== */

export const NAV_ICONS: Record<string, LucideIcon> = {
  ArrowRightLeft,
  Blocks,
  CalendarDays,
  ChartSpline,
  Code2,
  Compass,
  CreditCard,
  LifeBuoy,
  Mountain,
  Palmtree,
  Quote,
  Share2,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
  Users,
  Waves,
}

/** Resolve a configured icon name, falling back to a neutral brand glyph. */
export function navIcon(name?: string): LucideIcon {
  return (name && NAV_ICONS[name]) || Sparkles
}

/* ==========================================================================
   MOTION
   ========================================================================== */

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER.base, delayChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO },
  },
}

/* ==========================================================================
   <MobileNav>
   ========================================================================== */

export interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Full-screen navigation for viewports below `lg`.
 *
 * Built on the Sheet primitive, so Radix owns the focus trap, the Escape
 * handler and the body scroll lock for as long as the panel is open — there is
 * deliberately no second scroll-lock effect here to fight it on close.
 */
export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const reducedMotion = useReducedMotionSafe()
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  const groups = MARKETING_NAV
  const firstExpandable = groups.find((group) => group.items?.length)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="full"
        showCloseButton={false}
        className="border-l-0 bg-background p-0"
      >
        <SheetTitle className="sr-only">Site navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Browse EZRA Pro product, solutions, pricing and resources.
        </SheetDescription>

        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line-subtle px-5">
          <Link href="/" onClick={close} aria-label="EZRA Pro home">
            <Logo size="sm" />
          </Link>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            shape="circle"
            aria-label="Close menu"
            onClick={close}
          >
            <X aria-hidden="true" />
          </IconButton>
        </div>

        <SheetBody className="px-2 py-2">
          <motion.div
            variants={reducedMotion ? undefined : listVariants}
            initial={reducedMotion ? undefined : 'hidden'}
            animate={reducedMotion ? undefined : 'visible'}
          >
            <Accordion
              type="multiple"
              variant="plain"
              defaultValue={firstExpandable ? [firstExpandable.label] : []}
              className="px-2"
            >
              {/* The motion wrapper makes every AccordionItem an only child, so
                  the variant's own `last:border-b-0` can no longer tell which
                  row is last — the rule moves out here instead. */}
              {groups.map((group) => (
                <motion.div
                  key={group.label}
                  variants={reducedMotion ? undefined : itemVariants}
                  className="border-b border-line-subtle last:border-b-0"
                >
                  {group.items?.length ? (
                    <MobileNavSection group={group} onNavigate={close} />
                  ) : (
                    <Link
                      href={group.href ?? '/'}
                      onClick={close}
                      className={cn(
                        'group/link flex items-center justify-between py-4',
                        'font-display text-base font-semibold tracking-tight text-foreground',
                        'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-primary',
                      )}
                    >
                      {group.label}
                      <ArrowRight
                        aria-hidden="true"
                        className={cn(
                          'size-4 text-faint',
                          'transition-transform duration-300 ease-[var(--ease-out-expo)]',
                          'group-hover/link:translate-x-0.5 group-hover/link:text-primary',
                        )}
                      />
                    </Link>
                  )}
                </motion.div>
              ))}
            </Accordion>

            <motion.div
              variants={reducedMotion ? undefined : itemVariants}
              className="mt-6 px-4 pb-2"
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
                Already a customer
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/help"
                  onClick={close}
                  className="text-sm text-muted transition-colors duration-200 hover:text-primary"
                >
                  Help center
                </Link>
                <Link
                  href="/status"
                  onClick={close}
                  className="text-sm text-muted transition-colors duration-200 hover:text-primary"
                >
                  System status
                </Link>
              </div>
            </motion.div>
          </motion.div>
        </SheetBody>

        <SheetFooter className="flex-col gap-3 border-line-subtle bg-background/90 px-5 py-5 sm:flex-col">
          <Button asChild variant="primary" size="lg" fullWidth rightIcon={<ArrowRight />}>
            <Link href="/signup" onClick={close}>
              Start free
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg" fullWidth>
            <Link href="/login" onClick={close}>
              Sign in
            </Link>
          </Button>
          <p className="text-center text-[0.6875rem] leading-relaxed text-faint">
            {HERO.microProof}
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function MobileNavSection({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const items = group.items ?? []
  const FeatureIcon = navIcon(group.feature?.icon)

  return (
    <AccordionItem value={group.label} className="border-b-0">
      <AccordionTrigger className="py-4 font-display text-base font-semibold tracking-tight">
        {group.label}
      </AccordionTrigger>
      <AccordionContent className="pb-4 pt-0">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const Icon = navIcon(item.icon)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'group/row -mx-2 flex items-start gap-3 rounded-xl px-2 py-2.5',
                    'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                    'hover:bg-surface-sunken active:bg-surface-sunken',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg',
                      'border border-line-subtle bg-surface text-primary',
                      'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                      'group-hover/row:border-[color-mix(in_oklab,var(--primary)_35%,transparent)]',
                      'group-hover/row:bg-primary-soft',
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      {item.label}
                      {item.badge ? (
                        <Badge size="sm" variant="accent">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </span>
                    {item.description ? (
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        {group.feature ? (
          <Link
            href={group.feature.href}
            onClick={onNavigate}
            className={cn(
              'mt-3 flex items-start gap-3 rounded-xl border border-line-subtle p-3',
              'bg-primary-soft/50',
              'transition-colors duration-200 ease-[var(--ease-out-expo)]',
              'hover:border-[color-mix(in_oklab,var(--primary)_38%,transparent)]',
            )}
          >
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
              <FeatureIcon className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {group.feature.title}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                {group.feature.description}
              </span>
            </span>
          </Link>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  )
}
