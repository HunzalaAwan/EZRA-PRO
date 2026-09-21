'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Lock,
  Monitor,
  RefreshCw,
  Search,
  Share2,
  Smartphone,
  Star,
  CalendarCheck,
  LayoutGrid,
  LayoutList,
  LayoutTemplate,
  RectangleVertical,
  ShieldCheck,
  Zap,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { useStorefrontSettings } from '@/hooks/use-storefront-settings'
import type { Storefront } from '@/lib/demo'
import { SITE } from '@/lib/site-config'
import {
  DESKTOP_LAYOUTS,
  MOBILE_LAYOUTS,
  SECTION_META,
  type DesktopLayout,
  type MobileLayout,
  type StorefrontSettings,
} from '@/lib/storefront-settings'
import { cn, formatCurrency, formatDuration, formatNumber, truncate } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   DATA — derived from the tenant, fetched server-side
   ========================================================================== */

const CUSTOM_DOMAIN = 'book.bluehorizonmaui.com'

function embedSnippetsFor(
  tenant: Tenant,
  publicUrl: string,
): Record<string, { label: string; hint: string; code: string }> {
  return {
    inline: {
      label: 'Inline calendar',
      hint: 'Drops the full availability calendar into any page.',
      code: `<div id="ezra-booking"></div>
<script
  src="https://embed.ezrapro.com/v1/widget.js"
  data-tenant="${tenant.slug}"
  data-mode="inline"
  data-target="#ezra-booking"
  data-accent="${tenant.branding.accentColor}"
  async
></script>`,
    },
    button: {
      label: 'Book-now button',
      hint: 'Opens the checkout in a modal over your site.',
      code: `<button
  class="ezra-book"
  data-tenant="${tenant.slug}"
  data-activity="molokini-crater-dawn-patrol"
>
  Book now
</button>
<script src="https://embed.ezrapro.com/v1/widget.js" async></script>`,
    },
    link: {
      label: 'Direct link',
      hint: 'For newsletters, Instagram bios and QR codes.',
      code: publicUrl,
    },
  }
}

const DNS_RECORDS = [
  { type: 'CNAME', host: 'book', value: 'storefront.ezrapro.com', status: 'verified' },
  { type: 'TXT', host: '_ezra-verify', value: 'ezra-site-verify=8f2c41ab', status: 'verified' },
  { type: 'CAA', host: '@', value: '0 issue "letsencrypt.org"', status: 'pending' },
] as const

/* ==========================================================================
   PAGE
   ========================================================================== */

type EmbedKey = 'inline' | 'button' | 'link'

export interface StorefrontAdminClientProps {
  tenant: Tenant
  storefront: Storefront | undefined
}

/**
 * `storefront` is fetched server-side — this file never imports `@/lib/demo`
 * itself, so the synthetic dataset stays out of the client bundle.
 */
export function StorefrontAdminClient({
  tenant: CURRENT_TENANT,
  storefront: STOREFRONT,
}: StorefrontAdminClientProps) {
  const PUBLIC_PATH = `/book/${CURRENT_TENANT.slug}`
  const PUBLIC_URL = `https://ezrapro.com${PUBLIC_PATH}`
  const EMBED_SNIPPETS = React.useMemo(
    () => embedSnippetsFor(CURRENT_TENANT, PUBLIC_URL),
    [CURRENT_TENANT, PUBLIC_URL],
  )

  const reduceMotion = useReducedMotionSafe()
  const { settings, update, reset, isDefault } = useStorefrontSettings(CURRENT_TENANT.slug, CURRENT_TENANT.vertical)
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop')
  const [embed, setEmbed] = React.useState<EmbedKey>('inline')
  const [domain, setDomain] = React.useState(CUSTOM_DOMAIN)

  const [seo, setSeo] = React.useState({
    title: `Boat tours, snorkel & dive trips in Maui | ${CURRENT_TENANT.branding.logoText}`,
    description:
      'Small-group catamaran sails, Molokini snorkel trips and two-tank dives out of Maalaea Harbor. Free cancellation up to 24 hours before departure.',
    socialImage:
      CURRENT_TENANT.branding.coverImage ??
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  })

  if (!STOREFRONT) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Storefront"
        description="Your public booking site — the link you put in your bio, the widget on your own website, and how both look in search."
        actions={
          <Button size="sm" rightIcon={<ExternalLink />} asChild>
            <Link href={PUBLIC_PATH}>View storefront</Link>
          </Button>
        }
      />

      {/* ---------------- Public URL ---------------- */}
      <Card variant="gradient">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface shadow-sm ring-1 ring-line"
            >
              <Globe className="size-5 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                  Your storefront is live
                </h3>
                <Badge variant="success" size="sm" dot>
                  Published
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {STOREFRONT.activities.length} live{' '}
                {STOREFRONT.activities.length === 1 ? 'experience' : 'experiences'} ·{' '}
                {STOREFRONT.featured.length} featured on the homepage
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <CopyRow label="EZRA Pro address" value={PUBLIC_URL} />
            <CopyRow label="Custom domain" value={`https://${domain}`} />
          </div>
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* ---------------- Layout and sections ---------------- */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <LayoutTemplate className="size-4 text-primary" aria-hidden="true" />
                  Layout and sections
                </CardTitle>
                <CardDescription>
                  Choose what the homepage shows and how experiences are laid out. The preview
                  follows as you go, and so does the live site.
                </CardDescription>
              </div>
              <CardToolbar>
                <Button variant="ghost" size="xs" onClick={reset} disabled={isDefault}>
                  Reset to defaults
                </Button>
              </CardToolbar>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <ul className="divide-y divide-line-subtle rounded-xl border border-line">
                {SECTION_META.map((meta) => {
                  const on = settings.sections[meta.key]
                  return (
                    <li key={meta.key} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                          {meta.label}
                          {meta.key === 'departures' && CURRENT_TENANT.vertical !== 'tours' ? (
                            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-subtle">
                              Off by default outside tours
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{meta.hint}</p>
                        {meta.key === 'trust' && on ? (
                          <label className="mt-2.5 inline-flex items-center gap-2 text-xs text-muted">
                            <Switch
                              size="sm"
                              checked={settings.trustOnPhones}
                              onCheckedChange={(value) => update({ trustOnPhones: value === true })}
                              aria-label="Also show the trust strip on phones"
                            />
                            Also show on phones
                          </label>
                        ) : null}
                      </div>
                      <Switch
                        checked={on}
                        onCheckedChange={(value) =>
                          update((current) => ({
                            ...current,
                            sections: { ...current.sections, [meta.key]: value === true },
                          }))
                        }
                        aria-label={`Show ${meta.label}`}
                      />
                    </li>
                  )
                })}
              </ul>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Experiences on phones</p>
                  <p className="mt-0.5 min-h-8 text-xs text-muted">
                    {MOBILE_LAYOUTS.find((l) => l.value === settings.mobileLayout)?.hint}
                  </p>
                  <Segmented
                    size="sm"
                    label="Phone layout"
                    value={settings.mobileLayout}
                    onValueChange={(value: MobileLayout) => update({ mobileLayout: value })}
                    options={MOBILE_LAYOUTS.map((l) => ({
                      value: l.value,
                      label: l.label,
                      icon: l.value === 'cards' ? RectangleVertical : l.value === 'grid' ? LayoutGrid : LayoutList,
                    }))}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Experiences on desktop</p>
                  <p className="mt-0.5 min-h-8 text-xs text-muted">
                    {DESKTOP_LAYOUTS.find((l) => l.value === settings.desktopLayout)?.hint}
                  </p>
                  <Segmented
                    size="sm"
                    label="Desktop layout"
                    value={settings.desktopLayout}
                    onValueChange={(value: DesktopLayout) => update({ desktopLayout: value })}
                    options={DESKTOP_LAYOUTS.map((l) => ({
                      value: l.value,
                      label: l.label,
                      icon: l.value === 'grid' ? LayoutGrid : LayoutList,
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------- Embed ---------------- */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Code2 className="size-4 text-primary" aria-hidden="true" />
                  Embed on your own site
                </CardTitle>
                <CardDescription>
                  Paste once. The widget inherits your branding, availability and cancellation
                  policy automatically.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Tabs
                value={embed}
                onValueChange={(v) => setEmbed(v as EmbedKey)}
                variant="pill"
              >
                <TabsList>
                  {Object.entries(EMBED_SNIPPETS).map(([key, snippet]) => (
                    <TabsTrigger key={key} value={key}>
                      {snippet.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {Object.entries(EMBED_SNIPPETS).map(([key, snippet]) => (
                  <TabsContent key={key} value={key} className="flex flex-col gap-2">
                    <p className="text-xs text-muted">{snippet.hint}</p>
                    <CodeBlock code={snippet.code} label={snippet.label} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* ---------------- SEO ---------------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="size-4 text-primary" aria-hidden="true" />
                Search & social
              </CardTitle>
              <CardDescription>
                What Google shows in results and what unfurls when someone pastes your link into
                Instagram, WhatsApp or Slack.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5 pt-0">
              <Field
                label="Page title"
                description="Front-load the place and the activity. Google truncates around 60 characters."
                hint={`${seo.title.length}/60`}
                error={seo.title.length > 60 ? 'Search results will cut this off.' : undefined}
              >
                <Input
                  value={seo.title}
                  onChange={(e) => setSeo((prev) => ({ ...prev, title: e.target.value }))}
                />
              </Field>

              <Field
                label="Meta description"
                description="One sentence on what you sell, one on why it is low-risk to book."
                hint={`${seo.description.length}/160`}
                error={
                  seo.description.length > 160 ? 'Anything past 160 characters is dropped.' : undefined
                }
              >
                <Textarea
                  rows={3}
                  value={seo.description}
                  onChange={(e) => setSeo((prev) => ({ ...prev, description: e.target.value }))}
                />
              </Field>

              <Field
                label="Social share image"
                description="1200 × 630. Use a photograph with people in it — it doubles click-through."
              >
                <Input
                  value={seo.socialImage}
                  leftIcon={<ImageIcon className="size-4" />}
                  onChange={(e) => setSeo((prev) => ({ ...prev, socialImage: e.target.value }))}
                  inputClassName="font-mono text-xs"
                />
              </Field>

              {/* SERP preview */}
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
                  Google result
                </p>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <span className="grid size-4 place-items-center rounded-full bg-primary text-[0.5rem] font-bold text-on-primary">
                      {CURRENT_TENANT.branding.logoText.slice(0, 1)}
                    </span>
                    {domain}
                    <span className="text-faint">› experiences</span>
                  </p>
                  <p className="mt-1 text-base leading-snug text-info hover:underline">
                    {truncate(seo.title, 60)}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    {truncate(seo.description, 160)}
                  </p>
                </div>

                <p className="text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
                  Link preview
                </p>
                <div className="max-w-md overflow-hidden rounded-xl border border-line bg-surface">
                  <div className="aspect-[1200/630] overflow-hidden bg-surface-sunken">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={seo.socialImage}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-3">
                    <p className="text-[0.6875rem] tracking-wide text-faint uppercase">{domain}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {seo.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
                      {seo.description}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ---------------- Domain ---------------- */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="size-4 text-primary" aria-hidden="true" />
                  Domain
                </CardTitle>
                <CardDescription>
                  Guests trust a booking page on your own domain. SSL is issued and renewed for
                  you.
                </CardDescription>
              </div>
              <CardToolbar>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCw />}
                  onClick={() =>
                    toast.success('DNS re-checked', {
                      description: 'Two of three records verified. CAA is still propagating.',
                    })
                  }
                >
                  Re-check DNS
                </Button>
              </CardToolbar>
            </CardHeader>

            <CardContent className="flex flex-col gap-4 pt-0">
              <Field
                label="Custom domain"
                description="A subdomain such as book.yourdomain.com is the fastest to verify."
              >
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.trim().toLowerCase())}
                  leftIcon={<Globe className="size-4" />}
                  suffix={
                    <span className="inline-flex items-center gap-1 text-success">
                      <Lock className="size-3" aria-hidden="true" />
                      SSL
                    </span>
                  }
                />
              </Field>

              <div className="overflow-hidden rounded-xl border border-line">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-sunken">
                        <Th>Type</Th>
                        <Th>Host</Th>
                        <Th>Points to</Th>
                        <Th align="right">Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {DNS_RECORDS.map((record) => (
                        <tr key={`${record.type}-${record.host}`} className="border-b border-line-subtle last:border-0">
                          <Td>
                            <Badge variant="outline" size="sm" className="font-mono">
                              {record.type}
                            </Badge>
                          </Td>
                          <Td className="font-mono text-xs">{record.host}</Td>
                          <Td className="font-mono text-xs text-muted">{record.value}</Td>
                          <Td align="right">
                            <Badge
                              variant={record.status === 'verified' ? 'success' : 'warning'}
                              size="sm"
                              dot
                            >
                              {record.status === 'verified' ? 'Verified' : 'Propagating'}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-subtle">
                Records are checked every 15 minutes. Full propagation can take up to 48 hours
                depending on your registrar.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---------------- Live preview ---------------- */}
        <div className="min-w-0">
          <Card variant="raised" className="xl:sticky xl:top-20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Storefront preview</CardTitle>
              <CardToolbar>
                <Segmented
                  size="sm"
                  label="Preview device"
                  value={device}
                  onValueChange={setDevice}
                  options={[
                    { value: 'desktop', label: 'Desktop', icon: Monitor },
                    { value: 'mobile', label: 'Phone', icon: Smartphone },
                  ]}
                />
              </CardToolbar>
            </CardHeader>

            <CardContent className="pt-0">
              <motion.div
                layout={!reduceMotion}
                transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'mx-auto overflow-hidden rounded-2xl border border-line bg-surface-sunken shadow-lg',
                  device === 'mobile' ? 'w-[19rem] max-w-full' : 'w-full',
                )}
              >
                {/* Browser chrome */}
                <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
                  <span aria-hidden="true" className="flex gap-1">
                    <span className="size-2 rounded-full bg-danger/60" />
                    <span className="size-2 rounded-full bg-warning/60" />
                    <span className="size-2 rounded-full bg-success/60" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-surface-sunken px-2 py-1 text-[0.6875rem] text-muted">
                    <Lock className="size-2.5 shrink-0 text-success" aria-hidden="true" />
                    <span className="truncate">{domain}</span>
                  </span>
                </div>

                <StorefrontFrame compact={device === 'mobile'} storefront={STOREFRONT} settings={settings} />
              </motion.div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-subtle">
                  Rendered from live data — {formatNumber(STOREFRONT.activities.length)} bookable
                  experiences.
                </p>
                <Button variant="ghost" size="xs" rightIcon={<ExternalLink />} asChild>
                  <Link href={PUBLIC_PATH}>Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   PIECES
   ========================================================================== */

function useCopy() {
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = React.useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not reach the clipboard', {
        description: 'Select the text and copy it manually.',
      })
    }
  }, [])

  return { copied, copy }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy()

  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-faint uppercase">
          {label}
        </p>
        <p className="truncate font-mono text-xs text-foreground">{value}</p>
      </div>
      <Button
        variant="ghost"
        size="xs"
        leftIcon={copied ? <Check /> : <Copy />}
        onClick={() => copy(value, label)}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  const { copied, copy } = useCopy()

  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-surface-sunken">
      <Button
        variant="secondary"
        size="xs"
        className="absolute top-2.5 right-2.5 z-10"
        leftIcon={copied ? <Check /> : <Copy />}
        onClick={() => copy(code, label)}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <pre className="no-scrollbar overflow-x-auto p-4 pr-24 text-xs leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2 text-[0.6875rem] font-semibold tracking-[0.08em] whitespace-nowrap text-subtle uppercase',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={cn('px-3 py-2.5 align-middle', align === 'right' ? 'text-right' : 'text-left', className)}
    >
      {children}
    </td>
  )
}

/* ==========================================================================
   MINI STOREFRONT
   ========================================================================== */

function StorefrontFrame({
  compact,
  storefront,
  settings,
}: {
  compact: boolean
  storefront: Storefront
  settings: StorefrontSettings
}) {
  if (!storefront) return null
  const { tenant, activities } = storefront
  const layout = compact ? settings.mobileLayout : settings.desktopLayout
  const count = layout === 'grid' ? (compact ? 4 : 6) : layout === 'list' ? 3 : compact ? 2 : 3
  const cards = activities.slice(0, count)
  const showTrust = settings.sections.trust && (!compact || settings.trustOnPhones)
  const rating = activities.length
    ? activities.reduce((sum, a) => sum + a.rating, 0) / activities.length
    : 5

  return (
    <div className="bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-[0.625rem] font-bold text-on-primary"
          >
            {tenant.branding.logoText.slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate font-display text-[0.8125rem] font-semibold tracking-tight text-foreground">
            {tenant.branding.logoText}
          </span>
        </div>
        <span className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[0.6875rem] font-semibold text-on-accent">
          Book now
        </span>
      </div>

      {/* Hero */}
      <div className="relative h-28 overflow-hidden">
        {tenant.branding.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.branding.coverImage} alt="" className="size-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-ink-200 uppercase">
            {tenant.city} · {SITE.name} storefront
          </p>
          <p className="font-display text-base leading-tight font-semibold tracking-tight text-ink-50">
            {tenant.name}
          </p>
        </div>
      </div>

      {/* Trust strip */}
      {showTrust ? (
        <div className={cn('grid gap-1.5 border-b border-line px-3.5 py-2.5', compact ? 'grid-cols-2' : 'grid-cols-4')}>
          {[
            { icon: ShieldCheck, label: 'Secure checkout' },
            { icon: Zap, label: 'Instant confirmation' },
            { icon: CalendarCheck, label: 'Free cancellation' },
            { icon: Star, label: `${rating.toFixed(1)} rated` },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5 text-[0.625rem] font-medium text-muted">
              <item.icon className="size-3 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Next departures */}
      {settings.sections.departures ? (
        <div className="border-b border-line px-3.5 py-2.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-primary">Next departures</p>
          <div className="mt-1.5 flex gap-1.5 overflow-hidden">
            {activities.slice(0, compact ? 2 : 3).map((activity, i) => (
              <span key={activity.id} className="flex min-w-0 flex-1 flex-col rounded-lg border border-line bg-surface-raised px-2 py-1.5">
                <span className="text-[0.625rem] font-semibold text-primary tabular">{['9:00 AM', '1:00 PM', '4:30 PM'][i]}</span>
                <span className="truncate text-[0.6875rem] font-medium text-foreground">{activity.name}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Experiences */}
      <div
        className={cn(
          'grid p-3.5',
          layout === 'grid' ? (compact ? 'grid-cols-2 gap-2' : 'grid-cols-3 gap-2.5') : 'grid-cols-1 gap-2.5',
        )}
      >
        {cards.map((activity) => {
          const image =
            activity.media.find((m) => m.isPrimary)?.url ?? activity.media[0]?.url ?? undefined
          const price = formatCurrency(activity.basePrice, activity.currency)
          if (layout === 'list') {
            return (
              <article key={activity.id} className="flex gap-3 overflow-hidden rounded-xl border border-line bg-surface-raised p-2">
                <span className="size-16 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="size-full object-cover" loading="lazy" />
                  ) : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{activity.name}</p>
                    <p className="truncate text-[0.6875rem] text-muted">{activity.tagline}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[0.625rem] text-subtle">
                      <Star className="size-2.5 fill-warning text-warning" aria-hidden="true" />
                      {activity.rating.toFixed(2)} · {formatDuration(activity.durationMinutes)}
                    </span>
                    <span className="text-xs font-bold text-primary tabular">{price}</span>
                  </div>
                </div>
              </article>
            )
          }
          return (
            <article key={activity.id} className="overflow-hidden rounded-xl border border-line bg-surface-raised">
              <span className={cn('block w-full overflow-hidden bg-surface-sunken', layout === 'grid' ? 'aspect-square' : compact ? 'h-24' : 'h-20')}>
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="size-full object-cover" loading="lazy" />
                ) : null}
              </span>
              <div className={cn('flex min-w-0 flex-col', layout === 'grid' ? 'gap-0.5 p-2' : 'gap-1 p-2.5')}>
                <p className="truncate text-xs font-semibold text-foreground">{activity.name}</p>
                {layout === 'cards' ? <p className="line-clamp-1 text-[0.6875rem] text-muted">{activity.tagline}</p> : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[0.625rem] text-subtle">
                    <Star className="size-2.5 fill-warning text-warning" aria-hidden="true" />
                    {activity.rating.toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-primary tabular">{price}</span>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      <p className="px-3.5 pb-3 text-center text-[0.6875rem] text-subtle">
        + {Math.max(activities.length - cards.length, 0)} more experiences
      </p>

      {/* The bands below the catalogue */}
      {(
        [
          ['about', 'About us · Meet the crew'],
          ['reviews', `Guest reviews · ${rating.toFixed(2)} out of 5`],
          ['contact', `Contact · ${tenant.contact.phone}`],
        ] as const
      )
        .filter(([key]) => settings.sections[key])
        .map(([key, label]) => (
          <div key={key} className="border-t border-line px-3.5 py-2.5 text-[0.6875rem] font-medium text-muted">
            {label}
          </div>
        ))}
    </div>
  )
}
