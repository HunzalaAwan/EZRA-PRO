'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import {
  ArrowRight,
  CalendarDays,
  ChartSpline,
  Check,
  CloudRain,
  CreditCard,
  FileCheck2,
  Globe,
  Play,
  RefreshCw,
  Repeat2,
  Share2,
  ShoppingCart,
  Smartphone,
  Star,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Chip, Panel, Point, ProductContent, ProductIcon, Row } from './product-content'

/* ==========================================================================
   The sections of a product page, in the landing page's voice: a two-column
   hero with the product on a pastel panel, three points, alternating rows
   with a graphic each, an operator in the field with two chips, and the
   other five products. Reduced motion gets every final state.
   ========================================================================== */

const ICONS: Record<ProductIcon, LucideIcon> = {
  ShoppingCart,
  CalendarDays,
  ChartSpline,
  CreditCard,
  Users,
  Share2,
  Smartphone,
  CloudRain,
  Wallet,
  FileCheck2,
  Star,
  RefreshCw,
  Repeat2,
  Utensils,
  Check,
  Globe,
}

const PANEL: Record<Panel, string> = {
  cloud: 'bg-cal-cloud',
  honeydew: 'bg-cal-honeydew',
  haze: 'bg-cal-haze',
  sunbeam: 'bg-cal-sunbeam',
  lavender: 'bg-cal-lavender',
  seafoam: 'bg-cal-seafoam',
}

const TONE: Record<Chip['tone'], string> = {
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-white',
  ink: 'bg-foreground text-background',
  warning: 'bg-warning text-white',
}

function ChipCard({ chip, className }: { chip: Chip; className?: string }) {
  const Icon = ICONS[chip.icon]
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05] sm:p-3.5', className)}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE[chip.tone])}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{chip.title}</span>
        <span className="block truncate text-[0.75rem] text-subtle">{chip.detail}</span>
      </span>
    </div>
  )
}

function Points({ points, className }: { points: string[]; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {points.map((point) => (
        <li key={point} className="flex items-start gap-3 text-[0.9375rem] text-foreground">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
            <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
          </span>
          {point}
        </li>
      ))}
    </ul>
  )
}

/* --------------------------------------------------------------------------
   Hero — copy on the left, the product on a pastel panel on the right.
   -------------------------------------------------------------------------- */

export function ProductHero({ content, children }: { content: ProductContent; children: ReactNode }) {
  const reduce = useReducedMotionSafe()
  const Icon = ICONS[content.icon]
  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section aria-labelledby="product-title" className="relative isolate bg-cal-rain pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pt-12 lg:pb-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-subtle">
            <li>
              <Link href="/" className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-muted">Product</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-foreground">
              {content.label}
            </li>
          </ol>
        </nav>

        <div className="mt-8 grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="min-w-0 lg:col-span-5">
            <motion.p {...enter(0)} className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-primary text-on-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="text-[0.9375rem] font-medium text-foreground">{content.label}</span>
              {content.badge ? <span className="rounded-md bg-surface px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted ring-1 ring-black/[0.05]">{content.badge}</span> : null}
            </motion.p>

            <motion.h1
              id="product-title"
              {...enter(0.06)}
              className="mt-5 font-display text-[2.5rem] leading-[1.06] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.25rem] lg:text-[3.75rem]"
            >
              {content.headline}
            </motion.h1>

            <motion.p {...enter(0.12)} className="mt-6 text-[1.125rem] leading-[1.45] text-pretty text-muted lg:text-[1.25rem]">
              {content.body}
            </motion.p>

            <motion.div {...enter(0.18)} className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild variant="ink" size="xl" className="rounded-[10px] px-7" rightIcon={<ArrowRight aria-hidden="true" />}>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild variant="secondary" size="xl" className="rounded-[10px] px-7" leftIcon={<Play aria-hidden="true" />}>
                <Link href="/dashboard">See it running</Link>
              </Button>
            </motion.div>

            <motion.p {...enter(0.24)} className="mt-5 text-[0.875rem] text-subtle">
              <span className="font-medium text-foreground tabular-nums">{content.proofStat}</span> {content.proofLabel} · No card to start
            </motion.p>

            <motion.div {...enter(0.3)}>
              <Points points={content.promises} className="mt-7" />
            </motion.div>
          </div>

          <motion.div {...enter(0.2)} className="min-w-0 lg:col-span-7">
            <div className={cn('flex min-h-[26rem] items-center justify-center overflow-hidden rounded-[2rem] p-4 sm:p-10 lg:min-h-[32rem] [&>*]:max-w-full', PANEL[content.hero.panel])}>{children}</div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Three points — what it does, in three cards.
   -------------------------------------------------------------------------- */

export function KeyPoints({ points }: { points: Point[] }) {
  return (
    <section aria-label="What it does" className="bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="grid gap-5 md:grid-cols-3">
          {points.map((point) => {
            const Icon = ICONS[point.icon]
            return (
              <StaggerItem as="li" key={point.title} distance={18} className="min-w-0">
                <article className="flex h-full flex-col rounded-[1.5rem] bg-surface p-7 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-display text-[1.25rem] leading-[1.25] font-medium tracking-[-0.02em] text-foreground">{point.title}</h2>
                  <p className="mt-3 text-[0.9375rem] leading-[1.5] text-muted">{point.body}</p>
                </article>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Rows — text one side, the product the other, swapping sides as they go.
   -------------------------------------------------------------------------- */

export function ProductRows({ rows, children }: { rows: Row[]; children: ReactNode[] }) {
  return (
    <section aria-label="In detail" className="bg-background pb-8 sm:pb-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-20 px-4 sm:gap-24 sm:px-6 lg:gap-28 lg:px-8">
        {rows.map((row, index) => {
          const flip = index % 2 === 1
          return (
            <article key={row.title} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
              <Reveal direction="up" distance={18} className={cn('min-w-0 lg:col-span-5', flip && 'lg:order-2 lg:col-start-8')}>
                <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">{row.label}</p>
                <h2 className="mt-4 font-display text-[1.875rem] leading-[1.12] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.25rem]">{row.title}</h2>
                <p className="mt-5 text-[1rem] leading-[1.5] text-pretty text-muted sm:text-[1.0625rem]">{row.body}</p>
                <Points points={row.points} className="mt-6" />
              </Reveal>
              <Reveal direction="up" distance={26} delay={0.08} className={cn('min-w-0 lg:col-span-7', flip && 'lg:order-1 lg:col-start-1')}>
                <div className={cn('flex min-h-[24rem] items-center justify-center overflow-hidden rounded-[2rem] p-4 sm:p-10 lg:min-h-[28rem] [&>*]:max-w-full', PANEL[row.panel])}>{children[index]}</div>
              </Reveal>
            </article>
          )
        })}
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   In the field — an operator, and two things the product did.
   -------------------------------------------------------------------------- */

export function FieldPanel({ field }: { field: ProductContent['field'] }) {
  const photo = PHOTOS[field.photo]
  return (
    <section aria-label="In the field" className="bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal direction="up" distance={24} className="grid items-center gap-10 rounded-[2rem] bg-background-subtle p-6 sm:p-10 lg:grid-cols-12 lg:gap-12 lg:p-12">
          <div className="relative min-w-0 lg:col-span-7">
            <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-surface-sunken">
              <Image src={photoUrl(photo, 1200)} alt={photo.alt} fill sizes="(min-width: 1024px) 40rem, 100vw" className="object-cover" style={{ objectPosition: photo.focus }} />
            </figure>
            <ChipCard chip={field.chips[0]} className="absolute top-[10%] -right-2 w-[15rem] sm:-right-4 sm:w-[17rem]" />
            <ChipCard chip={field.chips[1]} className="absolute bottom-[10%] -left-2 w-[15rem] sm:-left-4 sm:w-[17rem]" />
          </div>
          <div className="lg:col-span-5">
            <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">In the field</p>
            <p className="mt-4 font-serif text-[1.5rem] leading-[1.3] text-foreground sm:text-[1.75rem]">&ldquo;{field.line}&rdquo;</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   The other five.
   -------------------------------------------------------------------------- */

export function RelatedProducts({ items }: { items: { key: string; label: string; icon: ProductIcon; line: string }[] }) {
  return (
    <section aria-labelledby="related-title" className="border-t border-line bg-background-subtle py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="related-title" className="text-center text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">
          The rest of the product
        </h2>
        <StaggerGroup as="ul" stagger={0.05} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((item) => {
            const Icon = ICONS[item.icon]
            return (
              <StaggerItem as="li" key={item.key} distance={12}>
                <Link
                  href={`/product/${item.key}`}
                  className={cn(
                    'group flex h-full flex-col rounded-2xl bg-surface p-4 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]',
                    'transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-faint transition-[transform,color] duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                  </span>
                  <span className="mt-3 text-sm font-medium text-foreground">{item.label}</span>
                  <span className="mt-1 text-[0.8125rem] leading-relaxed text-muted">{item.line}</span>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}
