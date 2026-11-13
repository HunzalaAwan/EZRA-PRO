import Image from 'next/image'
import Link from 'next/link'
import {
  Anchor,
  ArrowRight,
  ArrowUpRight,
  Bike,
  CalendarClock,
  CarFront,
  Check,
  ClipboardCheck,
  CloudRain,
  Fuel,
  Gift,
  GraduationCap,
  IdCard,
  Layers,
  LayoutList,
  MapPin,
  MessageSquareText,
  PackagePlus,
  Plane,
  Plus,
  Route,
  Ruler,
  Sailboat,
  ShieldCheck,
  Ship,
  Signature,
  Snowflake,
  Store,
  Timer,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
import { Breadcrumbs, type Crumb } from '@/components/marketing/compare/compare-ui'
import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import type {
  BoardTone,
  Niche,
  NicheBoard,
  NicheChip,
  NicheCost,
  NicheFaq,
  NicheIcon,
  NicheProblem,
  NicheStep,
  NicheTone,
} from '@/content/booking-software'
import { BOOKING_FEE_LABEL, EZRA_FEE_PERCENT, ezraFee } from '@/lib/fees'
import { cn, formatCurrency } from '@/lib/utils'

/* ==========================================================================
   The /booking-software pages, one business at a time.

     hero        headline, two buttons, the photo with two pieces of product
     handled     four day-to-day problems, each with the feature that fixes it
     screen      the screen the business works from, in an app frame
     cost        one example booking both ways, a busy month, a quiet month
     setup       three steps, named as the wizard names them
     questions   native <details>, readable without JavaScript
     related     three neighbouring businesses and a row of plain links

   Server components only: nothing here ships JavaScript.
   ========================================================================== */

export const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

export const TONE_BG: Record<NicheTone, string> = {
  rain: 'bg-cal-rain',
  honeydew: 'bg-cal-honeydew',
  sunbeam: 'bg-cal-sunbeam',
  seafoam: 'bg-cal-seafoam',
  lavender: 'bg-cal-lavender',
  linen: 'bg-cal-linen',
  cloud: 'bg-cal-cloud',
}

export const ICONS: Record<NicheIcon, LucideIcon> = {
  Anchor,
  Bike,
  CalendarClock,
  CarFront,
  ClipboardCheck,
  CloudRain,
  Fuel,
  Gift,
  GraduationCap,
  IdCard,
  Layers,
  LayoutList,
  MapPin,
  MessageSquareText,
  PackagePlus,
  Plane,
  Route,
  Ruler,
  Sailboat,
  ShieldCheck,
  Ship,
  Signature,
  Snowflake,
  Store,
  Timer,
  Users,
  Wallet,
  Wrench,
}

const money = (minor: number, decimals = minor % 100 !== 0) => formatCurrency(minor, 'USD', { decimals })

/** "Boat rental software" from "boat rental software". */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const H2 = 'font-display text-[1.875rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.5rem]'
const EYEBROW = 'text-sm font-medium text-muted'

/** The one line every page carries about the price. */
export const PRICE_LINE = `${EZRA_FEE_PERCENT}% per booking · $0 a month · no contract`

/* ------------------------------------------------------------------- hero */

function FloatingChip({ chip, className }: { chip: NicheChip; className?: string }) {
  const Icon = ICONS[chip.icon]
  return (
    <div
      className={cn(
        'absolute z-10 flex max-w-[15.5rem] items-center gap-3 rounded-2xl bg-surface p-3 pr-4 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06]',
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-foreground text-background">
        <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.9375rem] font-medium text-foreground">{chip.title}</span>
        <span className="block text-[0.8125rem] leading-snug text-muted">{chip.detail}</span>
      </span>
    </div>
  )
}

export function NicheHero({ niche, crumbs }: { niche: Niche; crumbs: Crumb[] }) {
  const photo = PHOTOS[niche.photo]
  return (
    <section aria-labelledby="niche-title" className={cn('overflow-hidden pt-8 pb-16 sm:pt-10 sm:pb-24', TONE_BG[niche.tone])}>
      <div className={WRAP}>
        <Breadcrumbs items={crumbs} />

        <div className="mt-10 grid items-center gap-12 sm:mt-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3.5 py-1.5 text-sm font-medium text-foreground ring-1 ring-black/[0.06]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-foreground" />
              For {niche.name.toLowerCase()} businesses
            </p>
            <h1
              id="niche-title"
              className="mt-6 font-display text-[length:clamp(2.375rem,1.5rem_+_3.3vw,4rem)] leading-[1.02] font-medium tracking-[-0.04em] text-balance text-foreground"
            >
              {niche.h1}
            </h1>
            <p className="mt-6 max-w-[36ch] text-[1.1875rem] leading-[1.5] text-pretty text-muted sm:text-[1.3125rem]">{niche.subhead}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="ink" size="lg" className="rounded-[10px] px-6" rightIcon={<ArrowRight aria-hidden="true" />}>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="rounded-[10px] px-6">
                <Link href="#cost">What it costs</Link>
              </Button>
            </div>

            <p className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Check aria-hidden="true" className="size-4 text-success" strokeWidth={2.5} />
              {PRICE_LINE}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[27rem] lg:max-w-none">
            <figure className="relative m-0 aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-surface shadow-[var(--shadow-xl)] ring-1 ring-black/10">
              <Image
                src={photoUrl(photo, 1200)}
                alt={photo.alt}
                fill
                priority
                sizes="(min-width: 1024px) 42vw, (min-width: 640px) 27rem, 92vw"
                className="object-cover"
                style={{ objectPosition: photo.focus }}
              />
            </figure>
            <FloatingChip chip={niche.chips[0]} className="top-6 left-3 sm:top-10 sm:-left-10" />
            <FloatingChip chip={niche.chips[1]} className="right-3 bottom-6 sm:right-[-2.5rem] sm:bottom-12" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------- the day-to-day */

export function ProblemGrid({ niche }: { niche: Niche }) {
  return (
    <section aria-labelledby="handled-title" className="bg-background py-20 sm:py-28">
      <div className={WRAP}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>The day-to-day</p>
          <h2 id="handled-title" className={cn(H2, 'mt-3')}>
            {sentence(niche.keywords.primary)} that handles the hard parts
          </h2>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 sm:gap-5">
          {niche.problems.map((item) => (
            <ProblemCard key={item.problem} item={item} tone={niche.tone} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function ProblemCard({ item, tone }: { item: NicheProblem; tone: NicheTone }) {
  const Icon = ICONS[item.icon]
  return (
    <li className="flex flex-col rounded-[1.375rem] border border-line bg-surface p-6 sm:p-8">
      <span className={cn('grid size-12 place-items-center rounded-2xl text-foreground', TONE_BG[tone])}>
        <Icon aria-hidden="true" className="size-[1.375rem]" strokeWidth={1.75} />
      </span>
      <h3 className="mt-6 font-display text-[1.25rem] leading-[1.25] font-medium tracking-[-0.02em] text-foreground sm:text-[1.375rem]">
        {item.problem}
      </h3>
      <p className="mt-2.5 text-base leading-[1.6] text-pretty text-muted">{item.fix}</p>
      <p className="mt-auto pt-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background-subtle px-3 py-1 text-[0.8125rem] font-medium text-foreground ring-1 ring-line">
          <Check aria-hidden="true" className="size-3.5 text-success" strokeWidth={2.5} />
          {item.feature}
        </span>
      </p>
    </li>
  )
}

/* ------------------------------------------------------------- the screen */

const STATUS_TONE: Record<BoardTone, string> = {
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  neutral: 'bg-background-subtle text-muted ring-1 ring-line',
  danger: 'bg-danger-soft text-danger',
}

function BoardMock({ board }: { board: NicheBoard }) {
  return (
    <div className="p-3 sm:p-5">
      <div className="rounded-xl border border-line bg-surface">
        <div className="flex items-baseline justify-between gap-3 border-b border-line-subtle px-4 py-3.5 sm:px-5">
          <p className="font-display text-[1.0625rem] font-semibold tracking-[-0.01em] text-foreground">{board.heading}</p>
          <p className="truncate text-[0.8125rem] text-muted">{board.sub}</p>
        </div>
        <ul className="divide-y divide-line-subtle">
          {board.rows.map((row) => (
            <li key={`${row.lead}-${row.title}-${row.detail}`} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
              <span className="w-11 shrink-0 text-[0.8125rem] font-medium text-subtle tabular">{row.lead}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] leading-snug font-medium text-foreground sm:truncate">{row.title}</span>
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted sm:truncate">{row.detail}</span>
              </span>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_TONE[row.tone])}>{row.status}</span>
              {row.action ? (
                <span
                  aria-hidden="true"
                  className="hidden w-[6.25rem] shrink-0 rounded-lg bg-foreground px-2 py-1.5 text-center text-[0.8125rem] font-medium text-background sm:inline-block"
                >
                  {row.action}
                </span>
              ) : (
                <span aria-hidden="true" className="hidden w-[6.25rem] shrink-0 sm:inline-block" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function ScreenSection({ niche }: { niche: Niche }) {
  const { board } = niche
  return (
    <section aria-labelledby="screen-title" className="bg-background-subtle py-20 sm:py-28">
      <div className={cn(WRAP, 'grid items-center gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16')}>
        <div className="max-w-md">
          <p className={EYEBROW}>On the day</p>
          <h2 id="screen-title" className={cn(H2, 'mt-3')}>
            One screen for the whole day
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">{board.caption}</p>
          <p className="mt-6 inline-flex flex-wrap items-center gap-2 text-sm text-muted">
            Set up as
            <span className="rounded-full bg-surface px-3 py-1 font-medium text-foreground ring-1 ring-line">{niche.setupAs}</span>
          </p>
        </div>

        <figure className="m-0 min-w-0">
          <AppFrame url={`app.ezrapro.com/dashboard/${board.screen.toLowerCase().replace(/\s+/g, '-')}`}>
            <BoardMock board={board} />
          </AppFrame>
          <figcaption className="sr-only">
            {board.heading}, {board.sub}: an example of the screen in EZRA Pro.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- cost */

function ReceiptRow({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className={cn('text-[0.9375rem]', muted ? 'text-muted' : 'text-foreground')}>{label}</dt>
      <dd className={cn('text-[0.9375rem] tabular', strong ? 'font-semibold text-foreground' : 'text-foreground')}>{value}</dd>
    </div>
  )
}

function MonthTile({ month, tone, kind }: { month: NicheCost['busy']; tone: NicheTone; kind: 'busy' | 'quiet' }) {
  const fee = ezraFee(month.bookings * month.avg)
  return (
    <div className={cn('rounded-[1.375rem] p-6 sm:p-7', kind === 'busy' ? TONE_BG[tone] : 'border border-line bg-surface')}>
      <p className="text-sm font-medium text-foreground">{month.label}</p>
      <p className="mt-1 text-[0.9375rem] text-muted">
        {month.bookings > 0
          ? `${month.bookings.toLocaleString('en-US')} bookings averaging ${money(month.avg)}`
          : 'No bookings, no bill'}
      </p>
      <p className="mt-5 font-display text-[2.5rem] leading-none font-medium tracking-[-0.03em] text-foreground tabular sm:text-[2.75rem]">
        {money(fee)}
      </p>
      <p className="mt-2 text-sm text-muted">EZRA Pro for the month</p>
    </div>
  )
}

export function CostSection({ niche }: { niche: Niche }) {
  const { cost } = niche
  const fee = ezraFee(cost.price)
  const feeLine = `EZRA Pro (${EZRA_FEE_PERCENT}%)`

  return (
    <section id="cost" aria-labelledby="cost-title" className="scroll-mt-28 bg-background py-20 sm:py-28">
      <div className={WRAP}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>The price</p>
          <h2 id="cost-title" className={cn(H2, 'mt-3')}>
            What it costs {/^[aeiou]/i.test(niche.name) ? 'an' : 'a'} {niche.name.toLowerCase()} business
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">
            {EZRA_FEE_PERCENT}% of each booking, $0 a month, no setup, no contract. You choose who pays it.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          {/* the receipt */}
          <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-[var(--shadow-lg)] sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-dashed border-line-strong pb-6">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted">Example booking</p>
                <h3 className="mt-1 text-[1.1875rem] leading-snug font-medium text-pretty text-foreground">{cost.example}</h3>
              </div>
              <p className="font-display text-[2.25rem] leading-none font-medium tracking-[-0.03em] text-foreground tabular">{money(cost.price)}</p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-background-subtle p-5">
                <p className="text-[0.9375rem] font-semibold text-foreground">You pay it</p>
                <p className="mt-1 text-sm text-muted">Guests pay your price.</p>
                <dl className="mt-3 divide-y divide-line-subtle">
                  <ReceiptRow label="Guest pays" value={money(cost.price)} />
                  <ReceiptRow label={feeLine} value={`−${money(fee, true)}`} muted />
                  <ReceiptRow label="You keep" value={money(cost.price - fee, true)} strong />
                </dl>
              </div>
              <div className="rounded-2xl bg-background-subtle p-5">
                <p className="text-[0.9375rem] font-semibold text-foreground">Guests pay it</p>
                <p className="mt-1 text-sm text-muted">Added at checkout.</p>
                <dl className="mt-3 divide-y divide-line-subtle">
                  <ReceiptRow label={BOOKING_FEE_LABEL} value={`+${money(fee, true)}`} muted />
                  <ReceiptRow label="Guest pays" value={money(cost.price + fee, true)} />
                  <ReceiptRow label="You keep" value={money(cost.price, true)} strong />
                </dl>
              </div>
            </div>

            {cost.also ? (
              <p className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl border border-line px-5 py-3.5 text-[0.9375rem]">
                <span className="text-foreground">{cost.also.label}</span>
                <span className="text-muted tabular">
                  {feeLine}: <span className="font-semibold text-foreground">{money(ezraFee(cost.also.price), true)}</span>
                </span>
              </p>
            ) : null}

            <p className="mt-6 text-sm leading-relaxed text-muted">
              Example prices. You set your own. Card processing is between you and your payment provider, and guests never see a card fee line.
            </p>
          </div>

          {/* two months */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <MonthTile month={cost.busy} tone={niche.tone} kind="busy" />
            <MonthTile month={cost.quiet} tone={niche.tone} kind="quiet" />
          </div>
        </div>

        <p className="mt-8">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary"
          >
            How the {EZRA_FEE_PERCENT}% works
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ setup */

export function SetupSteps({ steps, name }: { steps: NicheStep[]; name: string }) {
  return (
    <section aria-labelledby="setup-title" className="bg-background-subtle py-20 sm:py-28">
      <div className={WRAP}>
        <div className="max-w-2xl">
          <p className={EYEBROW}>Setup</p>
          <h2 id="setup-title" className={cn(H2, 'mt-3')}>
            Take {name.toLowerCase()} bookings in three steps
          </h2>
        </div>

        <ol className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {steps.map((step, index) => (
            <li key={step.title} className="relative flex flex-col rounded-[1.375rem] border border-line bg-surface p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-full bg-foreground font-display text-[1.0625rem] font-semibold text-background"
                >
                  {index + 1}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-muted">
                  <span className="rounded-md bg-background-subtle px-2 py-0.5 text-foreground ring-1 ring-line">{step.wizard}</span>
                  {step.then ? (
                    <>
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                      <span className="rounded-md bg-background-subtle px-2 py-0.5 text-foreground ring-1 ring-line">{step.then}</span>
                    </>
                  ) : null}
                </span>
              </div>
              <h3 className="mt-6 font-display text-[1.25rem] leading-[1.25] font-medium tracking-[-0.02em] text-foreground">
                <span className="sr-only">Step {index + 1}: </span>
                {step.title}
              </h3>
              <p className="mt-2.5 text-base leading-[1.6] text-pretty text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- FAQ */

export function FaqList({ faqs, title }: { faqs: NicheFaq[]; title: string }) {
  return (
    <section aria-labelledby="faq-title" className="bg-background py-20 sm:py-28">
      <div className={cn(WRAP, 'grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16')}>
        <div>
          <p className={EYEBROW}>Questions</p>
          <h2 id="faq-title" className={cn(H2, 'mt-3')}>
            {title}
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-muted">
            Something else?{' '}
            <Link href="/contact" className="font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary">
              Ask a person
            </Link>
            .
          </p>
        </div>

        <div className="divide-y divide-line border-y border-line">
          {faqs.map((faq, index) => (
            <details key={faq.q} className="group" open={index === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <h3 className="text-[1.0625rem] leading-snug font-medium text-foreground sm:text-[1.125rem]">{faq.q}</h3>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background-subtle text-foreground ring-1 ring-line transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none">
                  <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
                </span>
              </summary>
              <p className="max-w-[60ch] pb-6 text-base leading-[1.65] text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- related */

export function NicheCard({ niche, priceLine = false, headingLevel = 'h3' }: { niche: Niche; priceLine?: boolean; headingLevel?: 'h2' | 'h3' }) {
  const photo = PHOTOS[niche.photo]
  const Heading = headingLevel
  const fee = ezraFee(niche.cost.price)
  return (
    <Link
      href={`/booking-software/${niche.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.375rem] border border-line bg-surface transition-shadow duration-200 hover:shadow-[var(--shadow-lg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="relative block aspect-[4/3] overflow-hidden bg-background-subtle">
        <Image
          src={photoUrl(photo, 800)}
          alt=""
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 92vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          style={{ objectPosition: photo.focus }}
        />
      </span>
      <span className="flex flex-1 flex-col p-5 sm:p-6">
        <Heading className="flex items-center justify-between gap-3 font-display text-[1.1875rem] leading-tight font-medium tracking-[-0.02em] text-foreground">
          {niche.software}
          <ArrowUpRight aria-hidden="true" className="size-[1.125rem] shrink-0 text-muted transition-colors group-hover:text-foreground" />
        </Heading>
        <span className="mt-2 block text-[0.9375rem] leading-[1.55] text-muted">{niche.card}</span>
        {priceLine ? (
          <span className="mt-auto block pt-4 text-[0.8125rem] font-medium text-foreground tabular">
            {money(niche.cost.price)} booking → {money(fee)} to EZRA Pro
          </span>
        ) : null}
      </span>
    </Link>
  )
}

export function RelatedSection({ niche, related }: { niche: Niche; related: Niche[] }) {
  const links = [
    ...niche.product,
    { href: '/pricing', label: 'Pricing' },
    { href: '/compare', label: 'How EZRA Pro compares' },
    { href: '/booking-software', label: 'All booking software' },
  ]
  return (
    <section aria-labelledby="related-title" className="border-t border-line bg-background py-20 sm:py-24">
      <div className={WRAP}>
        <h2 id="related-title" className={H2}>
          Also on EZRA Pro
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {related.map((item) => (
            <li key={item.slug}>
              <NicheCard niche={item} />
            </li>
          ))}
        </ul>

        <nav aria-label="More about EZRA Pro" className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.9375rem]">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}

/* ------------------------------------------- link row for other pages */

/**
 * A short "By business" row for the solutions and product pages: a pill for
 * each matching /booking-software page, named for the business.
 */
export function BusinessLinks({ niches, title = 'By business', className }: { niches: Niche[]; title?: string; className?: string }) {
  if (niches.length === 0) return null
  return (
    <section aria-labelledby="business-links-title" className={cn('border-t border-line bg-background py-14 sm:py-16', className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <h2 id="business-links-title" className="font-display text-[1.5rem] leading-[1.15] font-medium tracking-[-0.025em] text-foreground sm:text-[1.75rem]">
            {title}
          </h2>
          <p className="mt-2 text-[0.9375rem] text-muted">How EZRA Pro is set up for your kind of business.</p>
        </div>
        <ul className="flex flex-wrap gap-2.5">
          {niches.map((niche) => (
            <li key={niche.slug}>
              <Link
                href={`/booking-software/${niche.slug}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-[0.9375rem] font-medium text-foreground ring-1 ring-line transition-colors hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {niche.software}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
