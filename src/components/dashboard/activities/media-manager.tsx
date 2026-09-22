'use client'

import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  ImagePlus,
  Link2,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   MEDIA MANAGER
   Drag-and-drop styled upload zone, reorderable gallery, one primary image and
   alt text on every asset. Nothing is uploaded — a dropped file is previewed
   from an object URL, and a pasted link is stored as-is.
   ========================================================================== */

export interface DraftMedia {
  id: string
  url: string
  alt: string
  isPrimary: boolean
}

/** Stock frames offered by the "browse" affordance, so the demo always fills. */
const SAMPLE_LIBRARY = [
  'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1517627043994-b991abc1ec39?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1505144808419-1957a94ca61e?auto=format&fit=crop&w=1600&q=80',
]

const SAMPLE_ALT = [
  'Guests snorkelling over a shallow reef in clear turquoise water',
  'Catamaran under sail at golden hour off the coast',
  'Aerial view of a crescent bay with anchored boats',
  'Paddleboarders crossing a calm lagoon at sunrise',
  'Crew briefing on the dive deck before departure',
  'Sunset over the water from the bow of the vessel',
]

let mediaCounter = 0
function nextMediaId() {
  mediaCounter += 1
  return `med_draft_${mediaCounter}`
}

/** Keeps exactly one primary, promoting the first frame when none is flagged. */
function normalise(media: DraftMedia[]): DraftMedia[] {
  if (media.length === 0) return media
  const primaryIndex = media.findIndex((item) => item.isPrimary)
  const target = primaryIndex === -1 ? 0 : primaryIndex
  return media.map((item, index) => ({ ...item, isPrimary: index === target }))
}

export interface MediaManagerProps {
  media: DraftMedia[]
  onChange: (media: DraftMedia[]) => void
  /** Keyed by `media.<index>.alt` so the wizard can surface zod messages inline. */
  errors?: Record<string, string>
  className?: string
}

export function MediaManager({ media, onChange, errors, className }: MediaManagerProps) {
  const [dragActive, setDragActive] = React.useState(false)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)
  const [linkDraft, setLinkDraft] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const commit = (next: DraftMedia[]) => onChange(normalise(next))

  const addSamples = (count = 1) => {
    const used = new Set(media.map((item) => item.url))
    const additions: DraftMedia[] = []
    for (const url of SAMPLE_LIBRARY) {
      if (additions.length >= count) break
      if (used.has(url)) continue
      const index = SAMPLE_LIBRARY.indexOf(url)
      additions.push({
        id: nextMediaId(),
        url,
        alt: SAMPLE_ALT[index] ?? '',
        isPrimary: media.length === 0 && additions.length === 0,
      })
    }
    if (additions.length === 0) {
      toast('Every stock frame is already in the gallery', {
        description: 'Drop your own photography or paste a link instead.',
      })
      return
    }
    commit([...media, ...additions])
  }

  const addFiles = (files: FileList) => {
    const additions: DraftMedia[] = []
    Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 8)
      .forEach((file) => {
        additions.push({
          id: nextMediaId(),
          // No server to upload to — the browser previews the local file.
          url: URL.createObjectURL(file),
          alt: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '),
          isPrimary: false,
        })
      })

    if (additions.length === 0) {
      toast.error('Those files are not images', { description: 'Drop JPG, PNG or WebP frames.' })
      return
    }
    commit([...media, ...additions])
    toast.success(`${additions.length} image${additions.length === 1 ? '' : 's'} added`)
  }

  const addLink = () => {
    const url = linkDraft.trim()
    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast.error('That does not look like an image URL')
      return
    }
    commit([...media, { id: nextMediaId(), url, alt: '', isPrimary: media.length === 0 }])
    setLinkDraft('')
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= media.length || from === to) return
    const next = [...media]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const remove = (index: number) => {
    const target = media[index]
    // Release the object URL a dropped file was previewed from.
    if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url)
    commit(media.filter((_, i) => i !== index))
  }

  const setPrimary = (index: number) => {
    onChange(media.map((item, i) => ({ ...item, isPrimary: i === index })))
  }

  const setAlt = (index: number, alt: string) => {
    onChange(media.map((item, i) => (i === index ? { ...item, alt } : item)))
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* ---------- drop zone ---------- */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)
          if (event.dataTransfer.files.length > 0) {
            addFiles(event.dataTransfer.files)
            return
          }
          const text = event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text')
          if (text && /^https?:\/\//i.test(text.trim())) {
            commit([
              ...media,
              { id: nextMediaId(), url: text.trim(), alt: '', isPrimary: media.length === 0 },
            ])
          }
        }}
        className={cn(
          'relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden',
          'rounded-2xl border-2 border-dashed border-line-strong bg-surface-sunken/50 px-6 py-9 text-center',
          'transition-[border-color,background-color,transform] duration-300 ease-[var(--ease-out-expo)]',
          dragActive && 'scale-[1.01] border-primary bg-primary-soft/40',
        )}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-dots mask-radial opacity-50" />
        <span
          className={cn(
            'grid size-12 place-items-center rounded-2xl border border-line-subtle bg-surface text-primary shadow-sm',
            'transition-transform duration-300 ease-[var(--ease-spring)]',
            dragActive && 'scale-110',
          )}
        >
          <UploadCloud className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold">Drag photos here</p>
          <p className="mt-1 text-xs text-muted">
            Landscape JPG or PNG, at least 1600px wide. The first frame leads every storefront tile.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="secondary" size="sm" leftIcon={<ImagePlus />} onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => addSamples(3)}>
            Use stock frames
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {/* ---------- paste a link ---------- */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={linkDraft}
          onChange={(event) => setLinkDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addLink()
            }
          }}
          leftIcon={<Link2 />}
          placeholder="https://images.example.com/hero.jpg"
          aria-label="Image URL"
          className="flex-1"
        />
        <Button type="button" variant="secondary" onClick={addLink} disabled={linkDraft.trim().length === 0}>
          Add link
        </Button>
      </div>

      {/* ---------- gallery ---------- */}
      {media.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted">
          No images yet. An activity needs at least one before it can go live.
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-2.5 p-0">
          {media.map((item, index) => {
            const altError = errors?.[`media.${index}.alt`]
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(event) => {
                  setDragIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setOverIndex(index)
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragIndex !== null) move(dragIndex, index)
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                className={cn(
                  'flex items-start gap-3 rounded-xl border border-line bg-surface p-2.5',
                  'transition-[border-color,box-shadow,opacity] duration-200',
                  overIndex === index && dragIndex !== null && dragIndex !== index && 'border-primary shadow-sm',
                  dragIndex === index && 'opacity-60',
                )}
              >
                <span className="mt-4 hidden cursor-grab text-faint sm:block" aria-hidden="true">
                  <GripVertical className="size-4" />
                </span>

                {/* Draft media can be an object URL or an arbitrary host, neither of
                    which next/image can optimise — a plain img is correct here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className="size-16 shrink-0 rounded-lg border border-line-subtle object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {item.isPrimary ? (
                      <Badge size="sm" variant="primary">
                        <Star className="size-3 fill-current" aria-hidden="true" />
                        Primary
                      </Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrimary(index)}
                        className="rounded-md text-xs font-medium text-subtle underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        Set as primary
                      </button>
                    )}
                    <span className="ml-auto text-xs text-faint tabular">
                      {index + 1} / {media.length}
                    </span>
                  </div>

                  <Input
                    value={item.alt}
                    onChange={(event) => setAlt(index, event.target.value)}
                    placeholder="Describe the photo for screen readers and SEO"
                    aria-label={`Alt text for image ${index + 1}`}
                    size="sm"
                    className="mt-2"
                    error={altError}
                  />
                  {altError ? <p className="mt-1 text-xs font-medium text-danger">{altError}</p> : null}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <SimpleTooltip label="Move up">
                    <IconButton
                      type="button"
                      aria-label={`Move image ${index + 1} up`}
                      size="xs"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp />
                    </IconButton>
                  </SimpleTooltip>
                  <SimpleTooltip label="Move down">
                    <IconButton
                      type="button"
                      aria-label={`Move image ${index + 1} down`}
                      size="xs"
                      variant="ghost"
                      disabled={index === media.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown />
                    </IconButton>
                  </SimpleTooltip>
                  <SimpleTooltip label="Remove">
                    <IconButton
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                      size="xs"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => remove(index)}
                    >
                      <Trash2 />
                    </IconButton>
                  </SimpleTooltip>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
