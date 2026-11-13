'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { ExternalLink, Play } from 'lucide-react'

import { cn } from '@/lib/utils'
import { findHelpVideo, toVideoSource, type ResolvedHelpVideo } from '@/lib/help-video'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SimpleTooltip } from '@/components/ui/tooltip'

/* ==========================================================================
   HelpVideo — "Watch how it works" beside a page title. Finds this page's
   video in src/content/help-videos.ts and renders nothing when there is none.
   The player only mounts while the window is open, so nothing loads until a
   click and closing stops the video.
   ========================================================================== */

/* ---------- the tab a page is showing (for per-tab videos) ---------- */

type TabState = { path: string; tab: string } | null

let activeTab: TabState = null
const listeners = new Set<() => void>()

function setActiveTab(next: TabState) {
  activeTab = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Tells the header's help button which in-page tab is showing, so a tab with its
 * own video plays that one. Call it from the component that owns the tab state.
 */
export function useHelpVideoTab(tab: string) {
  const pathname = usePathname()
  React.useEffect(() => {
    const mine = { path: pathname, tab }
    setActiveTab(mine)
    return () => {
      if (activeTab === mine) setActiveTab(null)
    }
  }, [pathname, tab])
}

/* ---------- the button ---------- */

export interface HelpVideoProps {
  /** `glass` sits on a photo (the activity page hero): solid enough to read over any image. */
  tone?: 'default' | 'glass'
  className?: string
}

export function HelpVideo({ tone = 'default', className }: HelpVideoProps) {
  const pathname = usePathname() ?? ''
  const tabState = React.useSyncExternalStore(subscribe, () => activeTab, () => null)
  const tab = tabState && tabState.path === pathname ? tabState.tab : null
  const video = React.useMemo(() => findHelpVideo(pathname, tab), [pathname, tab])

  const [open, setOpen] = React.useState(false)
  const returnFocus = React.useRef<HTMLButtonElement | null>(null)
  const content = React.useRef<HTMLDivElement | null>(null)

  if (!video) return null

  const show = (event: React.MouseEvent<HTMLButtonElement>) => {
    returnFocus.current = event.currentTarget
    setOpen(true)
  }
  const label = `Watch how it works: ${video.title}${video.duration ? `, ${video.duration}` : ''}`

  const glass = tone === 'glass'
  const base = cn(
    'shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    glass
      ? 'border-transparent bg-surface-raised/92 text-foreground shadow-sm backdrop-blur-md hover:bg-surface-raised'
      : 'border-line bg-surface-raised text-muted shadow-xs hover:border-line-strong hover:text-foreground',
  )

  return (
    <>
      {/* Wide screens: a pill with words. */}
      <button
        type="button"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        className={cn(base, 'group hidden h-8 gap-2 pl-1 pr-3 text-[0.8125rem] font-medium sm:inline-flex', className)}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid size-6 place-items-center rounded-full transition-colors',
            'bg-primary-soft text-primary group-hover:bg-primary group-hover:text-on-primary',
          )}
        >
          <Play className="size-3 translate-x-px fill-current" />
        </span>
        <span aria-hidden="true">Watch how it works</span>
        {video.duration ? (
          <span aria-hidden="true" className="tabular-nums text-subtle">
            · {video.duration}
          </span>
        ) : null}
      </button>

      {/* Phones: an icon with a tooltip. */}
      <SimpleTooltip label={video.duration ? `Watch how it works · ${video.duration}` : 'Watch how it works'}>
        <button
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={label}
          className={cn(base, 'inline-flex size-9 sm:hidden', className)}
        >
          <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
        </button>
      </SimpleTooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          ref={content}
          size="xl"
          // Keep focus off the player so Esc closes straight away (a focused iframe swallows keys).
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            content.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
        >
          {open ? <HelpVideoPlayer video={video} /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ---------- the player ---------- */

function HelpVideoPlayer({ video }: { video: ResolvedHelpVideo }) {
  const source = toVideoSource(video.url)
  const external = source?.kind === 'link' ? source.src : video.url

  return (
    <>
      <DialogHeader className="pb-3">
        <DialogTitle>{video.title}</DialogTitle>
        <DialogDescription>
          {video.duration ? `A ${video.duration} video. ` : ''}Press Esc or click outside to close.
        </DialogDescription>
      </DialogHeader>

      <div className="px-4 sm:px-6">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-[oklch(0.16_0_0)]">
          {source?.kind === 'iframe' ? (
            <iframe
              src={source.src}
              title={video.title}
              className="absolute inset-0 size-full border-0"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : source?.kind === 'file' ? (
            <video
              src={source.src}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={video.title}
              className="absolute inset-0 size-full"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="max-w-sm text-sm text-[oklch(0.86_0_0)]">
                This video can&apos;t play here. Use the link below to watch it in a new tab.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center px-4 pb-5 pt-3 sm:px-6">
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Open in a new tab
        </a>
      </div>
    </>
  )
}
