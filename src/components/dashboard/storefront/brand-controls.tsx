'use client'

import * as React from 'react'
import { Check, Trash2, Upload } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { contrastRatio, parseHex, readableOn } from '@/lib/brand-colors'
import type { HeroHeight, HeroOverlay } from '@/lib/storefront-settings'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Brand controls for the Storefront page: a colour picker with swatches, a
   hex field and the native picker; an image drop zone that reads a file to a
   data URL; the palettes and presets they offer.

   The hex strings here are content, not design tokens: they are the palette
   an operator picks their own storefront colours from.
   ========================================================================== */

export interface Swatch {
  hex: string
  name: string
}

export const PRIMARY_SWATCHES: Swatch[] = [
  { hex: '#0e7c86', name: 'Lagoon' },
  { hex: '#12a3a8', name: 'Shallows' },
  { hex: '#0b5563', name: 'Deep sea' },
  { hex: '#1b6fa8', name: 'Harbour' },
  { hex: '#1f9d6b', name: 'Kelp' },
  { hex: '#5b54d6', name: 'Reef' },
  { hex: '#b4453c', name: 'Lava rock' },
  { hex: '#233240', name: 'Ink' },
]

export const ACCENT_SWATCHES: Swatch[] = [
  { hex: '#ff6b4a', name: 'Coral' },
  { hex: '#f4873a', name: 'Sunset' },
  { hex: '#f2b33c', name: 'Golden hour' },
  { hex: '#e0457b', name: 'Hibiscus' },
  { hex: '#8a5be2', name: 'Orchid' },
  { hex: '#21b8a0', name: 'Seafoam' },
  { hex: '#3e8bff', name: 'Sky' },
  { hex: '#111b24', name: 'Obsidian' },
]

export const COVER_PRESETS: { url: string; label: string }[] = [
  { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80', label: 'Turquoise shoreline' },
  { url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2000&q=80', label: 'Diver on the reef' },
  { url: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=2000&q=80', label: 'Surf at sunset' },
  { url: 'https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&w=2000&q=80', label: 'Palm beach' },
  { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=2000&q=80', label: 'Ridge at dawn' },
  { url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2000&q=80', label: 'Canyon road' },
  { url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=2000&q=80', label: 'Boat on the lake' },
  { url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=2000&q=80', label: 'Beach at golden hour' },
]

export const HERO_OVERLAYS: { value: HeroOverlay; label: string; hint: string }[] = [
  { value: 'deep', label: 'Deep', hint: 'A dark scrim so the headline reads on any photograph.' },
  { value: 'brand', label: 'Brand tint', hint: 'Your primary colour washed over the photo.' },
  { value: 'soft', label: 'Soft', hint: 'A light touch; best on darker photographs.' },
]

export const HERO_HEIGHTS: { value: HeroHeight; label: string; hint: string }[] = [
  { value: 'compact', label: 'Compact', hint: 'Straight to the experiences.' },
  { value: 'standard', label: 'Standard', hint: 'Room for the headline and the search bar.' },
  { value: 'tall', label: 'Tall', hint: 'Lets the photograph breathe.' },
]

/* --------------------------------------------------------------------------
   Colour
   -------------------------------------------------------------------------- */

export function ColorControl({ label, description, swatches, value, onChange }: { label: string; description: string; swatches: Swatch[]; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = React.useState(value)
  const [invalid, setInvalid] = React.useState(false)
  const nativeId = React.useId()
  React.useEffect(() => {
    setDraft(value)
    setInvalid(false)
  }, [value])

  // judged as a fill with its own readable ink, which is how the storefront uses it
  const contrast = contrastRatio(value, readableOn(value))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <Badge variant={contrast >= 4.5 ? 'success' : contrast >= 3 ? 'warning' : 'danger'} size="sm">
          {contrast >= 4.5 ? 'Readable as a button' : contrast >= 3 ? 'Large text only' : 'Low contrast'}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {swatches.map((swatch) => {
          const active = value.toLowerCase() === swatch.hex
          return (
            <button
              key={swatch.hex}
              type="button"
              title={`${swatch.name} · ${swatch.hex}`}
              aria-label={`${label} ${swatch.name}`}
              aria-pressed={active}
              onClick={() => onChange(swatch.hex)}
              className={cn('grid size-9 place-items-center rounded-lg border transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0', active ? 'border-foreground/30 ring-2 ring-primary/40' : 'border-line')}
              style={{ backgroundColor: swatch.hex }}
            >
              {active ? <Check className="size-4" strokeWidth={3} aria-hidden="true" style={{ color: readableOn(swatch.hex) }} /> : null}
            </button>
          )
        })}
        <label htmlFor={nativeId} className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-muted">
          <input
            id={nativeId}
            type="color"
            value={parseHex(value) ?? '#000000'}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="size-9 cursor-pointer rounded-lg border border-line bg-surface p-1"
            aria-label={`${label}, custom colour`}
          />
          Custom
        </label>
        <Field label="Hex" labelSize="sm" error={invalid ? 'Use a 3 or 6 digit hex value.' : undefined} className="w-36">
          <Input
            size="sm"
            value={draft}
            onChange={(e) => {
              const next = e.target.value
              setDraft(next)
              const parsed = parseHex(next)
              setInvalid(next.length > 0 && !parsed)
              if (parsed) onChange(parsed)
            }}
            spellCheck={false}
            autoComplete="off"
            inputClassName="font-mono uppercase"
          />
        </Field>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Image drop zone → data URL
   -------------------------------------------------------------------------- */

export function ImageDrop({ value, onChange, maxBytes, label = 'Upload', hint, shape = 'cover', className, placeholder }: { value: string | null | undefined; onChange: (dataUrl: string | null) => void; maxBytes: number; label?: string; hint?: string; shape?: 'logo' | 'cover'; className?: string; placeholder?: React.ReactNode }) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)

  const read = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image', { description: 'Use a PNG, SVG, JPG or WebP.' })
      return
    }
    if (file.size > maxBytes) {
      toast.error('That image is too large', { description: `Keep it under ${Math.round(maxBytes / 100_000) / 10} MB so the page stays fast.` })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange(reader.result)
        toast.success(`${file.name} is in the preview`)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        read(e.dataTransfer.files?.[0])
      }}
      className={cn('flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 transition-colors duration-200', dragging ? 'border-primary bg-primary-soft/40' : 'border-line-strong bg-surface-sunken/50', className)}
    >
      <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface', shape === 'logo' ? 'size-12' : 'h-12 w-20')} aria-hidden="true">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={cn('size-full', shape === 'logo' ? 'object-contain p-1' : 'object-cover')} />
        ) : (
          placeholder ?? <Upload className="size-4 text-faint" />
        )}
      </span>
      <div className="min-w-[7rem] flex-1">
        <p className="truncate text-sm font-medium text-foreground">{value ? 'Your upload' : 'Drop a file here'}</p>
        {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" variant="outline" size="sm" leftIcon={<Upload />} onClick={() => inputRef.current?.click()}>
          {label}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" leftIcon={<Trash2 />} onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" aria-label={`${label} an image`} onChange={(e) => read(e.target.files?.[0] ?? undefined)} />
    </div>
  )
}
