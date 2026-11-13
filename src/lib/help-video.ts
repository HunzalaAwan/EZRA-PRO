import { HELP_VIDEOS, type HelpVideo, type HelpVideoEntry } from '@/content/help-videos'

/* ==========================================================================
   Help videos: which video a page shows, and how a share link plays.
   Pure functions; the button and player live in components/dashboard/help-video.
   ========================================================================== */

/** Dev preview link, inlined at build time. Every entry without its own link plays it. */
const PREVIEW_URL = (process.env.NEXT_PUBLIC_HELP_VIDEO_PREVIEW ?? '').trim()

export interface ResolvedHelpVideo {
  title: string
  url: string
  duration?: string
}

function resolve(video: HelpVideo | undefined): ResolvedHelpVideo | null {
  if (!video) return null
  const url = video.url.trim() || PREVIEW_URL
  return url ? { title: video.title, url, duration: video.duration?.trim() || undefined } : null
}

function segmentsOf(path: string): string[] {
  return path.split(/[?#]/)[0].split('/').filter(Boolean)
}

/** How specific a key is for this path, or -1 when it does not match. Fixed words outrank `[id]`. */
function matchScore(key: string, entry: HelpVideoEntry, path: string[]): number {
  const parts = segmentsOf(key)
  if (parts.length > path.length) return -1
  if (entry.exact && parts.length !== path.length) return -1
  let score = 0
  for (let i = 0; i < parts.length; i += 1) {
    const dynamic = parts[i].startsWith('[') && parts[i].endsWith(']')
    if (!dynamic && parts[i] !== path[i]) return -1
    score += dynamic ? 1 : 2
  }
  return score
}

/**
 * The video for this page (and tab): the most specific matching entry that has a
 * link, a tab's own video before its page's.
 */
export function findHelpVideo(pathname: string, tab?: string | null): ResolvedHelpVideo | null {
  const path = segmentsOf(pathname)
  const matches = Object.entries(HELP_VIDEOS)
    .map(([key, entry]) => ({ entry, score: matchScore(key, entry, path) }))
    .filter((match) => match.score >= 0)
    .sort((a, b) => b.score - a.score)

  for (const { entry } of matches) {
    const found = (tab ? resolve(entry.tabs?.[tab]) : null) ?? resolve(entry)
    if (found) return found
  }
  return null
}

/* ==========================================================================
   Share link -> player
   ========================================================================== */

export type VideoSource =
  | { kind: 'iframe'; provider: 'youtube' | 'vimeo' | 'loom'; src: string }
  | { kind: 'file'; src: string }
  /** Something we can't embed: offer it as a link. */
  | { kind: 'link'; src: string }

const FILE_PATTERN = /\.(mp4|webm|mov|m4v|ogg|ogv)$/i
const YOUTUBE_ID = /^[\w-]{6,}$/

/** YouTube `t` / `start` as seconds: `90`, `90s`, `1m30s`, `1h2m3s`. */
function startSeconds(value: string | null): number {
  if (!value) return 0
  if (/^\d+$/.test(value)) return Number(value)
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!match) return 0
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)
}

function youtube(url: URL): string | null {
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [first, second] = url.pathname.split('/').filter(Boolean)
    if (first === 'watch') id = url.searchParams.get('v')
    else if (first === 'shorts' || first === 'embed' || first === 'live' || first === 'v') id = second ?? null
  } else {
    return null
  }
  if (!id || !YOUTUBE_ID.test(id)) return null
  const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1', playsinline: '1' })
  const start = startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'))
  if (start > 0) params.set('start', String(start))
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

function vimeo(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null
  const parts = url.pathname.split('/').filter(Boolean)
  const index = parts.findIndex((part) => /^\d+$/.test(part))
  if (index < 0) return null
  const id = parts[index]
  // Unlisted videos carry a privacy hash: vimeo.com/123/abc or ?h=abc.
  const next = parts[index + 1]
  const hash = url.searchParams.get('h') ?? (next && /^[\da-f]+$/i.test(next) ? next : null)
  const params = new URLSearchParams({ autoplay: '1', dnt: '1', title: '0', byline: '0', portrait: '0' })
  if (hash) params.set('h', hash)
  return `https://player.vimeo.com/video/${id}?${params}`
}

function loom(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'loom.com') return null
  const [first, id] = url.pathname.split('/').filter(Boolean)
  if ((first !== 'share' && first !== 'embed') || !id) return null
  const params = new URLSearchParams({ autoplay: '1', hide_owner: 'true', hide_share: 'true', hide_title: 'true', hideEmbedTopBar: 'true' })
  return `https://www.loom.com/embed/${id}?${params}`
}

export function toVideoSource(raw: string): VideoSource | null {
  const value = raw.trim()
  if (!value) return null
  // A file in /public, e.g. '/videos/bookings.mp4'.
  if (value.startsWith('/') && FILE_PATTERN.test(value.split(/[?#]/)[0])) return { kind: 'file', src: value }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const yt = youtube(url)
  if (yt) return { kind: 'iframe', provider: 'youtube', src: yt }
  const vm = vimeo(url)
  if (vm) return { kind: 'iframe', provider: 'vimeo', src: vm }
  const lm = loom(url)
  if (lm) return { kind: 'iframe', provider: 'loom', src: lm }
  if (FILE_PATTERN.test(url.pathname)) return { kind: 'file', src: url.toString() }
  return { kind: 'link', src: url.toString() }
}
