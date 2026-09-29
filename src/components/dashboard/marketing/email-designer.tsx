'use client'

import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Copy,
  ImagePlus,
  LayoutTemplate,
  Link2,
  Monitor,
  Palette,
  Plus,
  Rows3,
  Save,
  Send,
  Smartphone,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import {
  BLOCK_HINT,
  BLOCK_LABEL,
  EMAIL_TEMPLATES,
  THEME_BACKGROUNDS,
  THEME_CARDS,
  blockId,
  newBlock,
  renderEmailHtml,
  type BlockAlign,
  type ColumnCell,
  type EmailBlock,
  type EmailBlockType,
  type EmailContext,
  type EmailDesign,
  type EmailTheme,
  type SavedEmailTemplate,
} from '@/lib/email-design'
import { cn } from '@/lib/utils'

/* ==========================================================================
   EMAIL DESIGNER
   A full-screen editor: blocks on the left (add, reorder, edit in place),
   the real email on the right at desktop or phone width. Images come from
   the computer, a link or the business's own trip photos. Start from a
   template, style it with the brand, save it as a template of your own.
   ========================================================================== */

const PLACEHOLDER_TOKENS = ['{first_name}', '{business}', '{activity}', '{date}', '{offer_code}', '{offer_percent}']
const ADDABLE: EmailBlockType[] = ['heading', 'text', 'image', 'button', 'activity', 'columns', 'coupon', 'divider', 'spacer', 'header', 'social', 'footer']

/** Shrink an uploaded photo so it fits in the browser's storage: 1200px wide, JPEG. */
async function readImage(file: File): Promise<string> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return url
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = url
  })
  const scale = Math.min(1, 1200 / img.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

/* --------------------------------------------------------------------------
   The preview frame, also used as a thumbnail
   -------------------------------------------------------------------------- */

export function EmailFrame({ design, ctx, preheader, width, className, scale = 1, height }: { design: EmailDesign; ctx: EmailContext; preheader?: string; width: number; className?: string; scale?: number; height?: number }) {
  const html = React.useMemo(() => renderEmailHtml(design, ctx, preheader), [design, ctx, preheader])
  const ref = React.useRef<HTMLIFrameElement>(null)
  const [contentHeight, setContentHeight] = React.useState(900)
  const observer = React.useRef<ResizeObserver | null>(null)
  // Grows with the email as photos load and blocks change.
  const measure = () => {
    const doc = ref.current?.contentDocument
    if (!doc?.body) return
    const update = () => setContentHeight(Math.max(300, doc.documentElement.scrollHeight))
    update()
    observer.current?.disconnect()
    observer.current = new ResizeObserver(update)
    observer.current.observe(doc.body)
    doc.querySelectorAll('img').forEach((img) => img.addEventListener('load', update))
  }
  React.useEffect(() => () => observer.current?.disconnect(), [])
  if (scale !== 1) {
    const frameHeight = height ? height / scale : contentHeight
    return (
      <div className={cn('pointer-events-none relative overflow-hidden', className)} style={{ width: width * scale, height: height ?? frameHeight * scale }} aria-hidden="true">
        <iframe ref={ref} title="Email thumbnail" srcDoc={html} onLoad={measure} tabIndex={-1} style={{ width, height: frameHeight, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0 }} />
      </div>
    )
  }
  return <iframe ref={ref} title="Email preview" srcDoc={html} onLoad={measure} className={cn('block border-0', className)} style={{ width, height: contentHeight }} />
}

/* --------------------------------------------------------------------------
   Small inputs
   -------------------------------------------------------------------------- */

function AlignPicker({ value, onChange }: { value: BlockAlign; onChange: (value: BlockAlign) => void }) {
  return <Segmented size="sm" label="Align" value={value} onValueChange={(next: BlockAlign) => onChange(next)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Centre' }]} />
}

function Tokens({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {PLACEHOLDER_TOKENS.map((token) => (
        <button key={token} type="button" onClick={() => onInsert(token)} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-xs text-muted hover:border-primary/50 hover:text-foreground">
          {token}
        </button>
      ))}
    </div>
  )
}

function TextWithTokens({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const insert = (token: string) => {
    const el = ref.current
    const at = el?.selectionStart ?? value.length
    onChange(value.slice(0, at) + token + value.slice(el?.selectionEnd ?? at))
  }
  return (
    <div>
      <Field label={label}>{(control) => <Textarea {...control} ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />}</Field>
      <Tokens onInsert={insert} />
    </div>
  )
}

function LinkField({ value, onChange, activities, label = 'Goes to' }: { value: string; onChange: (value: string) => void; activities: EmailContext['activities']; label?: string }) {
  const preset = value === '{book_link}' || value === '{manage_link}' || value.startsWith('activity:') ? value : value === '' ? '' : 'custom'
  return (
    <div className="flex flex-col gap-2">
      <Field label={label}>
        <Select value={preset || 'none'} onValueChange={(next) => onChange(next === 'custom' ? 'https://' : next === 'none' ? '' : next)}>
          <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nowhere</SelectItem>
            <SelectItem value="{book_link}">Your storefront</SelectItem>
            <SelectItem value="{manage_link}">Their booking page</SelectItem>
            {activities.map((activity) => (
              <SelectItem key={activity.slug} value={`activity:${activity.slug}`}>{activity.name}</SelectItem>
            ))}
            <SelectItem value="custom">Another web address…</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {preset === 'custom' ? <Input size="sm" leftIcon={<Link2 className="size-3.5" />} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Web address" /> : null}
    </div>
  )
}

function ImagePicker({ value, onChange, activities, compact }: { value: string; onChange: (src: string, alt?: string) => void; activities: EmailContext['activities']; compact?: boolean }) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const photos = activities.filter((activity) => activity.image)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface-sunken">
          {value ? <img src={value} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5 text-subtle" aria-hidden="true" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="xs" variant="secondary" leftIcon={<Upload />} loading={busy} onClick={() => fileRef.current?.click()}>
            Upload
          </Button>
          {value ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => onChange('')}>
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            if (file.size > 8 * 1024 * 1024) return toast.error('That image is over 8 MB', { description: 'Try a smaller photo.' })
            setBusy(true)
            try {
              onChange(await readImage(file), file.name.replace(/\.[a-z]+$/i, ''))
            } catch {
              toast.error('That file could not be read as an image')
            } finally {
              setBusy(false)
            }
          }}
        />
      </div>
      <Input size="sm" placeholder="Or paste an image link" leftIcon={<Link2 className="size-3.5" />} value={value.startsWith('data:') ? '' : value} onChange={(e) => onChange(e.target.value)} aria-label="Image link" />
      {photos.length > 0 ? (
        <div>
          <p className="text-xs text-subtle">Your trip photos</p>
          <div className={cn('mt-1.5 grid gap-1.5', compact ? 'grid-cols-5' : 'grid-cols-4')}>
            {photos.slice(0, compact ? 5 : 8).map((activity) => (
              <button
                key={activity.slug}
                type="button"
                title={activity.name}
                onClick={() => onChange(activity.image, activity.name)}
                className={cn('aspect-square overflow-hidden rounded-md border-2', value === activity.image ? 'border-primary' : 'border-transparent hover:border-line-strong')}
              >
                <img src={activity.image} alt={activity.name} className="size-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------------------
   One block's settings
   -------------------------------------------------------------------------- */

function BlockSettings({ block, set, ctx }: { block: EmailBlock; set: (patch: Partial<EmailBlock>) => void; ctx: EmailContext }) {
  const activities = ctx.activities
  switch (block.type) {
    case 'header':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-subtle">Shows {ctx.business} with your initials in the brand colour.</p>
          <Field label="Small line under it" optional>{(control) => <Input {...control} size="sm" value={block.tagline} onChange={(e) => set({ tagline: e.target.value })} />}</Field>
          <AlignPicker value={block.align} onChange={(align) => set({ align })} />
        </div>
      )
    case 'image':
      return (
        <div className="flex flex-col gap-3">
          <ImagePicker value={block.src} activities={activities} onChange={(src, alt) => set({ src, ...(alt && !block.alt ? { alt } : {}) })} />
          <Field label="Describe it" description="Read out by screen readers and shown if images are off.">{(control) => <Input {...control} size="sm" value={block.alt} onChange={(e) => set({ alt: e.target.value })} />}</Field>
          <LinkField value={block.link} activities={activities} onChange={(link) => set({ link })} label="Tapping it goes to" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented size="sm" label="Width" value={block.width} onValueChange={(width: 'full' | 'wide' | 'small') => set({ width })} options={[{ value: 'full', label: 'Full' }, { value: 'wide', label: 'Wide' }, { value: 'small', label: 'Small' }]} />
            <label className="flex items-center gap-2 text-xs font-medium text-muted">
              <Switch size="sm" checked={block.rounded} onCheckedChange={(rounded) => set({ rounded })} />
              Rounded
            </label>
          </div>
        </div>
      )
    case 'heading':
      return (
        <div className="flex flex-col gap-3">
          <div>
            <Field label="Heading">{(control) => <Input {...control} size="sm" value={block.text} onChange={(e) => set({ text: e.target.value })} />}</Field>
            <Tokens onInsert={(token) => set({ text: block.text + token })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="sm" label="Size" value={block.size} onValueChange={(size: 'xl' | 'lg' | 'md') => set({ size })} options={[{ value: 'xl', label: 'Large' }, { value: 'lg', label: 'Medium' }, { value: 'md', label: 'Small' }]} />
            <AlignPicker value={block.align} onChange={(align) => set({ align })} />
          </div>
        </div>
      )
    case 'text':
      return (
        <div className="flex flex-col gap-3">
          <TextWithTokens label="Text" value={block.text} onChange={(text) => set({ text })} rows={5} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <AlignPicker value={block.align} onChange={(align) => set({ align })} />
            <label className="flex items-center gap-2 text-xs font-medium text-muted">
              <Switch size="sm" checked={block.muted} onCheckedChange={(muted) => set({ muted })} />
              Softer colour
            </label>
          </div>
        </div>
      )
    case 'button':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Button text">{(control) => <Input {...control} size="sm" value={block.label} onChange={(e) => set({ label: e.target.value })} />}</Field>
          <LinkField value={block.link} activities={activities} onChange={(link) => set({ link })} />
          <div className="flex flex-wrap items-center gap-2">
            <Segmented size="sm" label="Style" value={block.style} onValueChange={(style: 'solid' | 'outline') => set({ style })} options={[{ value: 'solid', label: 'Filled' }, { value: 'outline', label: 'Outline' }]} />
            <AlignPicker value={block.align} onChange={(align) => set({ align })} />
            <label className="flex items-center gap-2 text-xs font-medium text-muted">
              <Switch size="sm" checked={block.full} onCheckedChange={(full) => set({ full })} />
              Full width
            </label>
          </div>
        </div>
      )
    case 'activity':
      return (
        <div className="flex flex-col gap-3">
          <Field label="Activity">
            <Select value={block.slug} onValueChange={(slug) => set({ slug })}>
              <SelectTrigger aria-label="Activity"><SelectValue /></SelectTrigger>
              <SelectContent>
                {activities.map((activity) => (
                  <SelectItem key={activity.slug} value={activity.slug}>{activity.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Button text">{(control) => <Input {...control} size="sm" value={block.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} />}</Field>
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            <Switch size="sm" checked={block.showPrice} onCheckedChange={(showPrice) => set({ showPrice })} />
            Show the “from” price
          </label>
        </div>
      )
    case 'columns': {
      const side = (key: 'left' | 'right', cell: ColumnCell) => (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <p className="text-xs font-semibold text-subtle uppercase">{key === 'left' ? 'Left' : 'Right'}</p>
          <ImagePicker compact value={cell.src} activities={activities} onChange={(src) => set({ [key]: { ...cell, src } } as Partial<EmailBlock>)} />
          <Input size="sm" aria-label="Title" placeholder="Title" value={cell.title} onChange={(e) => set({ [key]: { ...cell, title: e.target.value } } as Partial<EmailBlock>)} />
          <Input size="sm" aria-label="Line" placeholder="One line" value={cell.text} onChange={(e) => set({ [key]: { ...cell, text: e.target.value } } as Partial<EmailBlock>)} />
          <LinkField value={cell.link} activities={activities} onChange={(link) => set({ [key]: { ...cell, link } } as Partial<EmailBlock>)} />
        </div>
      )
      return (
        <div className="flex flex-col gap-3">
          {side('left', block.left)}
          {side('right', block.right)}
          <p className="text-xs text-subtle">On phones the two stack.</p>
        </div>
      )
    }
    case 'coupon':
      return (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-subtle">Shows the message&rsquo;s discount code. Turn the code on under “Include a discount code”.</p>
          <Field label="Line above the code">{(control) => <Input {...control} size="sm" value={block.title} onChange={(e) => set({ title: e.target.value })} />}</Field>
          <Field label="Small print">{(control) => <Input {...control} size="sm" value={block.note} onChange={(e) => set({ note: e.target.value })} />}</Field>
        </div>
      )
    case 'spacer':
      return <Segmented size="sm" label="Size" value={block.size} onValueChange={(size: 'sm' | 'md' | 'lg') => set({ size })} options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }]} />
    case 'social':
      return (
        <div className="flex flex-col gap-2">
          {(['instagram', 'facebook', 'tiktok'] as const).map((key) => (
            <Field key={key} label={key === 'tiktok' ? 'TikTok' : key.charAt(0).toUpperCase() + key.slice(1)}>
              {(control) => <Input {...control} size="sm" placeholder={`${key}.com/yourbusiness`} value={block[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<EmailBlock>)} />}
            </Field>
          ))}
        </div>
      )
    case 'footer':
      return <TextWithTokens label="Small print" value={block.text} onChange={(text) => set({ text })} rows={3} />
    case 'divider':
      return <p className="text-xs text-subtle">A thin line in the card&rsquo;s border colour.</p>
  }
}

function summaryOf(block: EmailBlock, ctx: EmailContext) {
  switch (block.type) {
    case 'heading':
    case 'text':
    case 'footer':
      return block.text.replace(/\s+/g, ' ').slice(0, 60)
    case 'button':
      return block.label
    case 'image':
      return block.alt || (block.src ? 'Image' : 'No image yet')
    case 'activity':
      return ctx.activities.find((activity) => activity.slug === block.slug)?.name ?? ''
    case 'columns':
      return `${block.left.title} · ${block.right.title}`
    case 'coupon':
      return block.title
    case 'header':
      return ctx.business
    default:
      return ''
  }
}

/* --------------------------------------------------------------------------
   Style
   -------------------------------------------------------------------------- */

function Swatches({ colors, value, onChange, label }: { colors: string[]; value: string; onChange: (value: string) => void; label: string }) {
  return (
    <div>
      <p className="text-[0.8125rem] font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[...new Set(colors)].map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            aria-pressed={value.toLowerCase() === color.toLowerCase()}
            onClick={() => onChange(color)}
            className={cn('size-8 rounded-full border border-line ring-offset-2 ring-offset-surface', value.toLowerCase() === color.toLowerCase() && 'ring-2 ring-primary')}
            style={{ background: color }}
          />
        ))}
        <label className="relative grid size-8 cursor-pointer place-items-center rounded-full border border-dashed border-line-strong text-subtle" title="Pick any colour">
          <Plus className="size-3.5" aria-hidden="true" />
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value.length === 7 ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: any colour`} />
        </label>
      </div>
    </div>
  )
}

function StylePanel({ theme, set, brand }: { theme: EmailTheme; set: (patch: Partial<EmailTheme>) => void; brand: string[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Swatches label="Buttons and accents" colors={[...brand, '#601CEF', '#29AC60', '#1F1D1A', '#C2410C', '#0F766E']} value={theme.accent} onChange={(accent) => set({ accent })} />
      <Swatches label="Background" colors={THEME_BACKGROUNDS} value={theme.background} onChange={(background) => set({ background })} />
      <Swatches label="Card" colors={THEME_CARDS} value={theme.card} onChange={(card) => set({ card })} />
      <div>
        <p className="text-[0.8125rem] font-medium">Font</p>
        <Segmented className="mt-2" size="sm" label="Font" value={theme.font} onValueChange={(font: EmailTheme['font']) => set({ font })} options={[{ value: 'sans', label: 'Clean' }, { value: 'serif', label: 'Classic' }, { value: 'rounded', label: 'Friendly' }]} />
      </div>
      <div>
        <p className="text-[0.8125rem] font-medium">Corners</p>
        <Segmented className="mt-2" size="sm" label="Corners" value={String(theme.radius)} onValueChange={(value: string) => set({ radius: Number(value) })} options={[{ value: '0', label: 'Square' }, { value: '8', label: 'Soft' }, { value: '14', label: 'Round' }, { value: '24', label: 'Extra' }]} />
      </div>
      <div>
        <p className="text-[0.8125rem] font-medium">Width</p>
        <Segmented className="mt-2" size="sm" label="Width" value={String(theme.width)} onValueChange={(value: string) => set({ width: Number(value) as EmailTheme['width'] })} options={[{ value: '560', label: 'Narrow' }, { value: '600', label: 'Standard' }, { value: '680', label: 'Wide' }]} />
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Templates gallery
   -------------------------------------------------------------------------- */

export function TemplateGallery({ ctx, accent, saved, onPick, current }: { ctx: EmailContext; accent: string; saved: SavedEmailTemplate[]; onPick: (design: EmailDesign, name: string) => void; current?: string }) {
  const built = React.useMemo(() => EMAIL_TEMPLATES.map((template) => ({ id: template.id, name: template.name, hint: template.hint, design: template.build(ctx, accent) })), [ctx, accent])
  const card = (id: string, name: string, hint: string, design: EmailDesign) => (
    <button
      key={id}
      type="button"
      onClick={() => onPick(design, name)}
      className={cn('group flex flex-col overflow-hidden rounded-xl border bg-surface text-left transition-colors', current === id ? 'border-primary' : 'border-line hover:border-primary/50')}
    >
      <div className="h-44 overflow-hidden border-b border-line-subtle" style={{ background: design.theme.background }}>
        <EmailFrame design={design} ctx={ctx} width={600} scale={0.29} height={176} className="mx-auto" />
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-subtle">{hint}</p>
      </div>
    </button>
  )
  return (
    <div className="flex flex-col gap-5">
      {saved.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Your templates</p>
          <div className="grid grid-cols-2 gap-3">{saved.map((template) => card(template.id, template.name, 'Saved by you', template.design))}</div>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wide text-subtle uppercase">Ready-made</p>
        <div className="grid grid-cols-2 gap-3">{built.map((template) => card(template.id, template.name, template.hint, template.design))}</div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   The designer
   -------------------------------------------------------------------------- */

export function EmailDesigner({
  initial,
  ctx,
  subject,
  preheader,
  brand,
  saved,
  onSaveTemplate,
  onDone,
  onClose,
  title = 'Design the email',
}: {
  initial: EmailDesign
  ctx: EmailContext
  subject?: string
  preheader?: string
  /** The business's own colours, first in the swatches. */
  brand: string[]
  saved: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  onDone: (design: EmailDesign) => void
  onClose: () => void
  title?: string
}) {
  const [design, setDesign] = React.useState<EmailDesign>(initial)
  const [selected, setSelected] = React.useState<string | null>(initial.blocks[1]?.id ?? initial.blocks[0]?.id ?? null)
  const [panel, setPanel] = React.useState<'content' | 'style' | 'templates'>('content')
  const [device, setDevice] = React.useState<'desktop' | 'mobile'>('desktop')
  const [adding, setAdding] = React.useState(false)
  const [naming, setNaming] = React.useState<string | null>(null)
  const undo = React.useRef<EmailDesign | null>(null)
  const [canUndo, setCanUndo] = React.useState(false)

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !naming && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, naming])

  const setBlocks = (blocks: EmailBlock[]) => setDesign((current) => ({ ...current, blocks }))
  const patchBlock = (id: string, patch: Partial<EmailBlock>) => setBlocks(design.blocks.map((block) => (block.id === id ? ({ ...block, ...patch } as EmailBlock) : block)))
  const move = (index: number, by: number) => {
    const next = [...design.blocks]
    const [item] = next.splice(index, 1)
    next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item)
    setBlocks(next)
  }
  const add = (type: EmailBlockType) => {
    const block = newBlock(type, ctx)
    const at = selected ? design.blocks.findIndex((entry) => entry.id === selected) + 1 : design.blocks.length
    const next = [...design.blocks]
    // Keep the footer last unless they are adding after it on purpose.
    const footerAt = next.findIndex((entry) => entry.type === 'footer')
    next.splice(at > 0 ? (footerAt >= 0 && at > footerAt && type !== 'footer' ? footerAt : at) : footerAt >= 0 ? footerAt : next.length, 0, block)
    setBlocks(next)
    setSelected(block.id)
    setAdding(false)
    setPanel('content')
  }
  const applyTemplate = (next: EmailDesign, name: string) => {
    undo.current = design
    setCanUndo(true)
    setDesign({ theme: next.theme, blocks: next.blocks.map((block) => ({ ...block, id: blockId() })) })
    setSelected(null)
    setPanel('content')
    toast(`${name} applied`, { description: 'Undo is in the top bar.' })
  }
  const html = () => renderEmailHtml(design, ctx, preheader)

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={title}>
      {/* ---------- top bar ---------- */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
        <Button variant="ghost" size="sm" leftIcon={<X />} onClick={onClose}>Close</Button>
        <p className="hidden truncate text-sm font-semibold text-foreground sm:block">{title}</p>
        <div className="flex-1" />
        {canUndo ? (
          <Button variant="ghost" size="sm" leftIcon={<Undo2 />} onClick={() => { if (undo.current) setDesign(undo.current); undo.current = null; setCanUndo(false) }}>
            Undo
          </Button>
        ) : null}
        <div role="radiogroup" aria-label="Preview size" className="hidden rounded-lg border border-line p-0.5 md:inline-flex">
          {(['desktop', 'mobile'] as const).map((value) => (
            <button key={value} type="button" role="radio" aria-checked={device === value} aria-label={value === 'desktop' ? 'Computer' : 'Phone'} onClick={() => setDevice(value)} className={cn('grid h-8 w-9 place-items-center rounded-md', device === value ? 'bg-surface-sunken text-foreground' : 'text-subtle')}>
              {value === 'desktop' ? <Monitor className="size-4" aria-hidden="true" /> : <Smartphone className="size-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" leftIcon={<Code2 />} className="hidden lg:inline-flex" onClick={() => { void navigator.clipboard?.writeText(html()); toast.success('Email HTML copied') }}>
          Copy HTML
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<Send />} className="hidden sm:inline-flex" onClick={() => toast.success('Test sent', { description: 'Check your inbox in a minute.' })}>
          Send test
        </Button>
        <Button variant="secondary" size="sm" leftIcon={<Save />} onClick={() => setNaming('')}>
          Save as template
        </Button>
        <Button size="sm" leftIcon={<Check />} onClick={() => onDone(design)}>Done</Button>
      </div>

      {naming !== null ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-sunken/60 px-4 py-2.5">
          <p className="text-sm font-medium">Template name</p>
          <Input size="sm" autoFocus className="w-64" value={naming} placeholder="Monthly newsletter" onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && naming.trim()) { onSaveTemplate(naming.trim(), design); setNaming(null) } }} aria-label="Template name" />
          <Button size="sm" disabled={!naming.trim()} onClick={() => { onSaveTemplate(naming.trim(), design); setNaming(null) }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setNaming(null)}>Cancel</Button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[26rem_minmax(0,1fr)]">
        {/* ---------- left panel ---------- */}
        <aside className="flex min-h-0 flex-col border-r border-line bg-surface">
          <div className="flex gap-1 border-b border-line px-3 py-2">
            {([
              ['content', 'Content', Rows3],
              ['style', 'Style', Palette],
              ['templates', 'Templates', LayoutTemplate],
            ] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" aria-pressed={panel === value} onClick={() => setPanel(value)} className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium', panel === value ? 'bg-surface-sunken text-foreground' : 'text-muted hover:text-foreground')}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {panel === 'style' ? <StylePanel theme={design.theme} brand={brand} set={(patch) => setDesign((current) => ({ ...current, theme: { ...current.theme, ...patch } }))} /> : null}
            {panel === 'templates' ? <TemplateGallery ctx={ctx} accent={design.theme.accent} saved={saved} onPick={applyTemplate} /> : null}
            {panel === 'content' ? (
              <div className="flex flex-col gap-2">
                <ol className="flex list-none flex-col gap-2 p-0">
                  {design.blocks.map((block, index) => {
                    const open = selected === block.id
                    return (
                      <li key={block.id} className={cn('rounded-xl border bg-surface', open ? 'border-primary/60 shadow-sm' : 'border-line')}>
                        <div className="flex items-center gap-2 px-3 py-2">
                          <button type="button" onClick={() => setSelected(open ? null : block.id)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
                            <span className="block text-sm font-medium text-foreground">{BLOCK_LABEL[block.type]}</span>
                            <span className="block truncate text-xs text-subtle">{summaryOf(block, ctx) || BLOCK_HINT[block.type]}</span>
                          </button>
                          <div className="flex shrink-0 items-center">
                            <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-sunken hover:text-foreground disabled:opacity-30"><ArrowUp className="size-4" aria-hidden="true" /></button>
                            <button type="button" aria-label="Move down" disabled={index === design.blocks.length - 1} onClick={() => move(index, 1)} className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-sunken hover:text-foreground disabled:opacity-30"><ArrowDown className="size-4" aria-hidden="true" /></button>
                            <button
                              type="button"
                              aria-label="Duplicate"
                              onClick={() => {
                                const copy = { ...block, id: blockId() } as EmailBlock
                                const next = [...design.blocks]
                                next.splice(index + 1, 0, copy)
                                setBlocks(next)
                                setSelected(copy.id)
                              }}
                              className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-sunken hover:text-foreground"
                            >
                              <Copy className="size-4" aria-hidden="true" />
                            </button>
                            <button type="button" aria-label="Delete" onClick={() => setBlocks(design.blocks.filter((entry) => entry.id !== block.id))} className="grid size-8 place-items-center rounded-md text-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" aria-hidden="true" /></button>
                          </div>
                        </div>
                        {open ? (
                          <div className="border-t border-line-subtle px-3 pt-3 pb-3.5">
                            <BlockSettings block={block} ctx={ctx} set={(patch) => patchBlock(block.id, patch)} />
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ol>
                {adding ? (
                  <div className="rounded-xl border border-line p-2">
                    <div className="mb-1 flex items-center justify-between px-1">
                      <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Add a block</p>
                      <button type="button" aria-label="Close" onClick={() => setAdding(false)} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-sunken"><X className="size-4" aria-hidden="true" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ADDABLE.map((type) => (
                        <button key={type} type="button" onClick={() => add(type)} className="rounded-lg border border-line px-2.5 py-2 text-left hover:border-primary/50">
                          <span className="block text-sm font-medium">{BLOCK_LABEL[type]}</span>
                          <span className="block text-xs text-subtle">{BLOCK_HINT[type]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" leftIcon={<Plus />} onClick={() => setAdding(true)}>
                    Add a block{selected ? ' below' : ''}
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </aside>

        {/* ---------- preview ---------- */}
        <section className="hidden min-h-0 overflow-y-auto bg-surface-sunken/60 lg:block" aria-label="Preview">
          <div className="mx-auto flex flex-col items-center py-6" style={{ width: device === 'desktop' ? 720 : 390 }}>
            <div className="mb-3 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
              <p className="truncate"><span className="font-semibold text-foreground">{ctx.business}</span> <span className="text-subtle">· {subject ? subject.replace(/\{([a-z_]+)\}/g, (m, k: string) => ctx.vars[k] ?? m) : 'No subject yet'}</span></p>
              {preheader ? <p className="truncate text-xs text-subtle">{preheader}</p> : null}
            </div>
            <div className={cn('w-full overflow-hidden border border-line bg-surface shadow-sm', device === 'mobile' ? 'rounded-[2rem] p-2' : 'rounded-xl')}>
              <EmailFrame design={design} ctx={ctx} preheader={preheader} width={device === 'desktop' ? 718 : 372} className={device === 'mobile' ? 'rounded-[1.5rem]' : ''} />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
