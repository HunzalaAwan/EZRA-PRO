'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import {
  Check,
  Contrast,
  Droplet,
  Image as ImageIcon,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Star,
  Timer,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'

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
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { getActivitiesByTenant } from '@/lib/demo-core'
import { useWorkspace } from '@/components/dashboard/workspace-provider'
import type { Tenant } from '@/types'
import { cn, formatCurrency, formatDuration, formatNumber } from '@/lib/utils'

/* ==========================================================================
   COLOUR MATHS

   These hex strings are *content*, not design tokens: they are the palette the
   operator picks their own storefront colours from, and they are stored on the
   tenant record (`branding.primaryColor`). Everything that styles this admin
   screen itself still comes from the semantic tokens.
   ========================================================================== */

interface Swatch {
  hex: string
  name: string
}

const PRIMARY_SWATCHES: Swatch[] = [
  { hex: '#0E7C86', name: 'Lagoon' },
  { hex: '#12A3A8', name: 'Shallows' },
  { hex: '#0B5563', name: 'Deep sea' },
  { hex: '#1B6FA8', name: 'Harbour' },
  { hex: '#1F9D6B', name: 'Kelp' },
  { hex: '#5B54D6', name: 'Reef' },
  { hex: '#B4453C', name: 'Lava rock' },
  { hex: '#233240', name: 'Ink' },
]

const ACCENT_SWATCHES: Swatch[] = [
  { hex: '#FF6B4A', name: 'Coral' },
  { hex: '#F4873A', name: 'Sunset' },
  { hex: '#F2B33C', name: 'Golden hour' },
  { hex: '#E0457B', name: 'Hibiscus' },
  { hex: '#8A5BE2', name: 'Orchid' },
  { hex: '#21B8A0', name: 'Seafoam' },
  { hex: '#3E8BFF', name: 'Sky' },
  { hex: '#111B24', name: 'Obsidian' },
]

const COVER_PRESETS: { url: string; label: string }[] = [
  {
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80',
    label: 'Turquoise shoreline',
  },
  {
    url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2000&q=80',
    label: 'Reef from above',
  },
  {
    url: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=2000&q=80',
    label: 'Catamaran at sunset',
  },
  {
    url: 'https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&w=2000&q=80',
    label: 'Open water',
  },
]

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function normaliseHex(input: string): string {
  const raw = input.trim().replace(/^#?/, '')
  if (raw.length === 3) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase()
  }
  return `#${raw}`.toLowerCase()
}

function hexToRgb(hex: string): [number, number, number] {
  const full = normaliseHex(hex).slice(1)
  const int = Number.parseInt(full, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/** WCAG relative luminance — decides whether text on the swatch is light or dark. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Ink or paper, whichever stays readable on the given fill. */
function readableOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#111b24' : '#ffffff'
}

const mix = (hex: string, percent: number, into: string) =>
  `color-mix(in oklab, ${hex} ${percent}%, ${into})`

/* ==========================================================================
   STATE
   ========================================================================== */

interface BrandingValues {
  logoText: string
  logoImage: string | null
  coverImage: string
  primaryColor: string
  accentColor: string
}

function initialFor(tenant: Tenant): BrandingValues {
  return {
    logoText: tenant.branding.logoText,
    logoImage: null,
    coverImage: tenant.branding.coverImage ?? COVER_PRESETS[0].url,
    primaryColor: tenant.branding.primaryColor.toLowerCase(),
    accentColor: tenant.branding.accentColor.toLowerCase(),
  }
}

function previewFor(tenant: Tenant) {
  const activity = getActivitiesByTenant(tenant.id).find((a) => a.status === 'live' && a.featured) ?? getActivitiesByTenant(tenant.id)[0]
  return { activity, image: activity.media.find((m) => m.isPrimary)?.url ?? activity.media[0]?.url }
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function BrandingEditor() {
  const { tenant } = useWorkspace()
  const INITIAL = React.useMemo(() => initialFor(tenant), [tenant])
  const { activity: PREVIEW_ACTIVITY, image: PREVIEW_IMAGE } = React.useMemo(() => previewFor(tenant), [tenant])
  const reduceMotion = useReducedMotionSafe()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [values, setValues] = React.useState<BrandingValues>(INITIAL)
  const [primaryDraft, setPrimaryDraft] = React.useState(INITIAL.primaryColor)
  const [accentDraft, setAccentDraft] = React.useState(INITIAL.accentColor)
  const [dragging, setDragging] = React.useState(false)
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop')
  const [saving, setSaving] = React.useState(false)

  const dirty =
    values.logoText !== INITIAL.logoText ||
    values.logoImage !== INITIAL.logoImage ||
    values.coverImage !== INITIAL.coverImage ||
    values.primaryColor !== INITIAL.primaryColor ||
    values.accentColor !== INITIAL.accentColor

  const set = <K extends keyof BrandingValues>(key: K, value: BrandingValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  function commitHex(which: 'primaryColor' | 'accentColor', draft: string) {
    const candidate = draft.startsWith('#') ? draft : `#${draft}`
    if (!HEX_PATTERN.test(candidate)) return false
    set(which, normaliseHex(candidate))
    return true
  }

  function readLogoFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image', { description: 'Use a PNG, SVG or JPG.' })
      return
    }
    if (file.size > 2_000_000) {
      toast.error('That logo is too large', { description: 'Keep it under 2 MB for fast loads.' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      set('logoImage', typeof reader.result === 'string' ? reader.result : null)
      toast.success('Logo uploaded', { description: `${file.name} is now in the preview.` })
    }
    reader.readAsDataURL(file)
  }

  function reset() {
    setValues(INITIAL)
    setPrimaryDraft(INITIAL.primaryColor)
    setAccentDraft(INITIAL.accentColor)
    toast('Branding reset', { description: 'Back to your last published theme.' })
  }

  function save() {
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      toast.success('Branding published', {
        description: 'Your storefront, checkout and confirmation emails all re-themed.',
      })
    }, 700)
  }

  const primaryContrast = contrastRatio(values.primaryColor, '#ffffff')
  const accentContrast = contrastRatio(values.accentColor, '#ffffff')

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      {/* ==================== CONTROLS ==================== */}
      <div className="flex min-w-0 flex-col gap-6">
        {/* ---------- Identity ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Storefront identity
            </CardTitle>
            <CardDescription>
              The wordmark and logo guests see in the header, on their confirmation and in every
              email you send.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 pt-0">
            <Field
              label="Logo text"
              description="Used wherever the logo image will not fit — emails, SMS, receipts."
              hint={`${values.logoText.length}/28`}
            >
              <Input
                value={values.logoText}
                maxLength={28}
                onChange={(e) => set('logoText', e.target.value)}
                placeholder="Blue Horizon"
              />
            </Field>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">Logo image</p>
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  readLogoFile(e.dataTransfer.files?.[0])
                }}
                className={cn(
                  'relative flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4',
                  'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                  dragging
                    ? 'border-primary bg-primary-soft/40'
                    : 'border-line-strong bg-surface-sunken/50',
                )}
              >
                <span
                  className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface"
                  aria-hidden="true"
                >
                  {values.logoImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={values.logoImage}
                      alt=""
                      className="size-full object-contain p-1.5"
                    />
                  ) : (
                    <span
                      className="font-display text-lg font-bold"
                      style={{ color: values.primaryColor }}
                    >
                      {values.logoText.slice(0, 2).toUpperCase() || 'BH'}
                    </span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Drop a file, or browse your computer
                  </p>
                  <p className="text-xs text-muted">
                    SVG or transparent PNG, at least 512px tall. Max 2 MB.
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leftIcon={<Upload />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse
                  </Button>
                  {values.logoImage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 />}
                      onClick={() => set('logoImage', null)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Upload a logo image"
                  onChange={(e) => readLogoFile(e.target.files?.[0] ?? undefined)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------- Cover ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" aria-hidden="true" />
              Cover image
            </CardTitle>
            <CardDescription>
              The hero photograph at the top of your storefront. Landscape, at least 2000px wide.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4 pt-0">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {COVER_PRESETS.map((preset) => {
                const active = values.coverImage === preset.url
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => set('coverImage', preset.url)}
                    aria-pressed={active}
                    className={cn(
                      'group relative aspect-[4/3] overflow-hidden rounded-xl border text-left',
                      'transition-all duration-300 ease-[var(--ease-out-expo)]',
                      active
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-line hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preset.url}
                      alt={preset.label}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/80 to-transparent px-2 pt-6 pb-1.5 text-[0.6875rem] font-medium text-ink-50">
                      {preset.label}
                    </span>
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-primary text-on-primary"
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <Field label="Or paste an image URL" description="Hosted anywhere you like.">
              <Input
                value={values.coverImage}
                onChange={(e) => set('coverImage', e.target.value)}
                placeholder="https://…"
                inputClassName="font-mono text-xs"
              />
            </Field>
          </CardContent>
        </Card>

        {/* ---------- Colours ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="size-4 text-primary" aria-hidden="true" />
              Brand colours
            </CardTitle>
            <CardDescription>
              Primary carries navigation, prices and trust. Accent is reserved for the one thing
              you want tapped — the book button.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-6 pt-0">
            <ColorControl
              label="Primary"
              description="Headers, links, price emphasis."
              swatches={PRIMARY_SWATCHES}
              value={values.primaryColor}
              draft={primaryDraft}
              contrast={primaryContrast}
              onDraftChange={setPrimaryDraft}
              onCommit={(next) => commitHex('primaryColor', next)}
              onSwatch={(hex) => {
                set('primaryColor', hex)
                setPrimaryDraft(hex)
              }}
            />

            <Separator />

            <ColorControl
              label="Accent"
              description="Book now, checkout, add-to-cart."
              swatches={ACCENT_SWATCHES}
              value={values.accentColor}
              draft={accentDraft}
              contrast={accentContrast}
              onDraftChange={setAccentDraft}
              onCommit={(next) => commitHex('accentColor', next)}
              onSwatch={(hex) => {
                set('accentColor', hex)
                setAccentDraft(hex)
              }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-subtle">
            {dirty
              ? 'Preview is showing unpublished changes.'
              : 'Preview matches your published storefront.'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw />}
              onClick={reset}
              disabled={!dirty}
            >
              Reset
            </Button>
            <Button size="sm" leftIcon={<Save />} loading={saving} onClick={save}>
              Publish branding
            </Button>
          </div>
        </div>
      </div>

      {/* ==================== LIVE PREVIEW ==================== */}
      <div className="min-w-0">
        <Card variant="raised" className="xl:sticky xl:top-20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Live preview</CardTitle>
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
                'mx-auto overflow-hidden rounded-2xl border border-line bg-white shadow-lg',
                device === 'mobile' ? 'w-[19rem] max-w-full' : 'w-full',
              )}
              style={{ colorScheme: 'light' }}
            >
              <StorefrontPreview values={values} compact={device === 'mobile'} />
            </motion.div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="neutral" size="sm">
                <Contrast className="size-3" aria-hidden="true" />
                Primary {primaryContrast.toFixed(1)}:1
              </Badge>
              <Badge variant="neutral" size="sm">
                <Contrast className="size-3" aria-hidden="true" />
                Accent {accentContrast.toFixed(1)}:1
              </Badge>
              <span className="text-xs text-subtle">against white</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ==========================================================================
   COLOUR CONTROL
   ========================================================================== */

function ColorControl({
  label,
  description,
  swatches,
  value,
  draft,
  contrast,
  onDraftChange,
  onCommit,
  onSwatch,
}: {
  label: string
  description: string
  swatches: Swatch[]
  value: string
  draft: string
  contrast: number
  onDraftChange: (next: string) => void
  onCommit: (next: string) => boolean
  onSwatch: (hex: string) => void
}) {
  const [invalid, setInvalid] = React.useState(false)
  const nativeId = React.useId()

  const handleDraft = (next: string) => {
    onDraftChange(next)
    const ok = onCommit(next)
    setInvalid(next.length > 0 && !ok)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <Badge variant={contrast >= 4.5 ? 'success' : contrast >= 3 ? 'warning' : 'danger'} size="sm">
          {contrast >= 4.5 ? 'AA body text' : contrast >= 3 ? 'AA large text' : 'Low contrast'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {swatches.map((swatch) => {
          const active = value === swatch.hex.toLowerCase()
          return (
            <button
              key={swatch.hex}
              type="button"
              title={`${swatch.name} · ${swatch.hex}`}
              aria-label={`${label} colour ${swatch.name}`}
              aria-pressed={active}
              onClick={() => onSwatch(swatch.hex.toLowerCase())}
              className={cn(
                'grid size-9 place-items-center rounded-lg border transition-all duration-200 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0',
                active ? 'border-foreground/30 ring-2 ring-primary/40' : 'border-line',
              )}
              style={{ backgroundColor: swatch.hex }}
            >
              {active ? (
                <Check
                  className="size-4"
                  strokeWidth={3}
                  aria-hidden="true"
                  style={{ color: readableOn(swatch.hex) }}
                />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="Hex"
          labelSize="sm"
          error={invalid ? 'Use a 3 or 6 digit hex value.' : undefined}
          className="w-40"
        >
          <Input
            size="sm"
            value={draft}
            onChange={(e) => handleDraft(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            inputClassName="font-mono uppercase"
          />
        </Field>

        <div className="flex items-center gap-2 pb-1">
          <label
            htmlFor={nativeId}
            className="text-xs font-medium text-muted"
          >
            Custom
          </label>
          <input
            id={nativeId}
            type="color"
            value={value}
            onChange={(e) => {
              onSwatch(e.target.value.toLowerCase())
              onDraftChange(e.target.value.toLowerCase())
              setInvalid(false)
            }}
            className="size-9 cursor-pointer rounded-lg border border-line bg-surface p-1"
          />
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   PREVIEW — a miniature of the real storefront, re-rendering on every keystroke
   ========================================================================== */

function StorefrontPreview({
  values,
  compact,
}: {
  values: BrandingValues
  compact: boolean
}) {
  const { tenant } = useWorkspace()
  const { activity: PREVIEW_ACTIVITY, image: PREVIEW_IMAGE } = React.useMemo(() => previewFor(tenant), [tenant])
  const { primaryColor, accentColor, logoText, logoImage, coverImage } = values
  const onPrimary = readableOn(primaryColor)
  const onAccent = readableOn(accentColor)

  return (
    <div className="text-[#111b24]">
      {/* ---------- Header ---------- */}
      <header
        className="flex items-center justify-between gap-3 px-3.5 py-2.5"
        style={{ backgroundColor: primaryColor, color: onPrimary }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoImage} alt="" className="h-6 w-auto max-w-24 object-contain" />
          ) : (
            <span
              className="grid size-6 shrink-0 place-items-center rounded-md text-[0.625rem] font-bold"
              style={{ backgroundColor: mix(onPrimary, 18, 'transparent') }}
            >
              {logoText.slice(0, 2).toUpperCase() || 'BH'}
            </span>
          )}
          <span className="truncate font-display text-[0.8125rem] font-semibold tracking-tight">
            {logoText || 'Your brand'}
          </span>
        </div>

        {!compact ? (
          <nav className="flex items-center gap-3 text-[0.6875rem] font-medium opacity-90">
            <span>Experiences</span>
            <span>Gift cards</span>
            <span>Contact</span>
          </nav>
        ) : null}

        <span
          className="shrink-0 rounded-md px-2.5 py-1 text-[0.6875rem] font-semibold"
          style={{ backgroundColor: accentColor, color: onAccent }}
        >
          Book now
        </span>
      </header>

      {/* ---------- Hero ---------- */}
      <div className="relative h-24 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverImage} alt="" className="size-full object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, ${mix(primaryColor, 10, 'transparent')} 0%, ${mix(
              primaryColor,
              72,
              'transparent',
            )} 100%)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-3" style={{ color: '#ffffff' }}>
          <p className="text-[0.625rem] font-semibold tracking-[0.14em] uppercase opacity-80">
            {tenant.city}
          </p>
          <p className="font-display text-sm font-semibold tracking-tight">
            Book the water, not the wait
          </p>
        </div>
      </div>

      {/* ---------- Activity card ---------- */}
      <div className="space-y-3 bg-[#f7f9fa] p-3.5">
        <div className="flex items-center justify-between">
          <p className="font-display text-[0.8125rem] font-semibold">Featured experience</p>
          <span className="text-[0.6875rem] font-medium" style={{ color: primaryColor }}>
            See all 12
          </span>
        </div>

        <article className="overflow-hidden rounded-xl border border-[#e4e9ec] bg-white shadow-sm">
          <div className="relative h-20 overflow-hidden">
            {PREVIEW_IMAGE ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={PREVIEW_IMAGE} alt="" className="size-full object-cover" />
            ) : null}
            <span
              className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold"
              style={{ backgroundColor: accentColor, color: onAccent }}
            >
              Bestseller
            </span>
          </div>

          <div className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-semibold">{PREVIEW_ACTIVITY.name}</p>
                <p className="truncate text-[0.6875rem] text-[#5b6b78]">
                  {PREVIEW_ACTIVITY.tagline}
                </p>
              </div>
              <span
                className="flex shrink-0 items-center gap-0.5 text-[0.6875rem] font-semibold"
                style={{ color: primaryColor }}
              >
                <Star className="size-3 fill-current" aria-hidden="true" />
                {PREVIEW_ACTIVITY.rating.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[0.625rem] text-[#5b6b78]">
              <span className="flex items-center gap-1">
                <Timer className="size-3" aria-hidden="true" />
                {formatDuration(PREVIEW_ACTIVITY.durationMinutes)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3" aria-hidden="true" />
                Up to {PREVIEW_ACTIVITY.maxCapacity}
              </span>
              <span>{formatNumber(PREVIEW_ACTIVITY.reviewCount)} reviews</span>
            </div>

            <div
              className="flex items-center justify-between gap-2 border-t pt-2"
              style={{ borderColor: '#e4e9ec' }}
            >
              <p className="text-[0.6875rem] text-[#5b6b78]">
                from{' '}
                <span className="text-sm font-bold" style={{ color: primaryColor }}>
                  {formatCurrency(PREVIEW_ACTIVITY.basePrice, PREVIEW_ACTIVITY.currency)}
                </span>
              </p>
              <span
                className="rounded-lg px-3 py-1.5 text-[0.6875rem] font-semibold"
                style={{
                  backgroundColor: mix(primaryColor, 12, 'transparent'),
                  color: primaryColor,
                }}
              >
                Check dates
              </span>
            </div>
          </div>
        </article>

        {/* ---------- Checkout button ---------- */}
        <div className="rounded-xl border border-[#e4e9ec] bg-white p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[0.6875rem] text-[#5b6b78]">Total · 2 adults</span>
            <span className="text-sm font-bold">
              {formatCurrency(PREVIEW_ACTIVITY.basePrice * 2, PREVIEW_ACTIVITY.currency)}
            </span>
          </div>
          <button
            type="button"
            tabIndex={-1}
            className="w-full rounded-lg py-2 text-[0.75rem] font-semibold transition-transform duration-200 hover:scale-[1.01] motion-reduce:hover:scale-100"
            style={{
              backgroundColor: accentColor,
              color: onAccent,
              boxShadow: `0 8px 20px -10px ${accentColor}`,
            }}
          >
            Confirm and pay
          </button>
          <p className="mt-1.5 text-center text-[0.625rem] text-[#5b6b78]">
            Free cancellation up to{' '}
            {PREVIEW_ACTIVITY.cancellationPolicy.freeCancellationHours}h before
          </p>
        </div>
      </div>
    </div>
  )
}
