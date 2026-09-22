/* ==========================================================================
   Brand colours — hex in, WCAG-aware token CSS out.

   Shared by the public storefront shell (server, from the tenant record) and
   the dashboard's storefront editor (client, from the operator's unsaved
   choices), so both agree on what "readable on this colour" means. Browser
   safe: no imports.
   ========================================================================== */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** "#abc" | "abc" | "#aabbcc" → "#aabbcc", or null when it is not a colour. */
export function parseHex(value: string | undefined | null): string | null {
  if (!value) return null
  const match = HEX.exec(value.trim())
  if (!match) return null
  const body = match[1]
  const full = body.length === 3 ? body.split('').map((c) => c + c).join('') : body
  return `#${full.toLowerCase()}`
}

function srgbChannel(value: number) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) → 1 (white). Expects a parsed six-digit hex. */
export function luminance(hex: string) {
  const r = srgbChannel(parseInt(hex.slice(1, 3), 16))
  const g = srgbChannel(parseInt(hex.slice(3, 5), 16))
  const b = srgbChannel(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string) {
  const la = luminance(parseHex(a) ?? '#000000')
  const lb = luminance(parseHex(b) ?? '#ffffff')
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/** Ink that is legible on top of `hex`: white or deep sea, whichever wins. */
export function readableOn(hex: string) {
  const parsed = parseHex(hex) ?? '#000000'
  const l = luminance(parsed)
  const ink = '#0b1417'
  const white = (1 + 0.05) / (l + 0.05)
  const dark = (l + 0.05) / (luminance(ink) + 0.05)
  return white >= dark ? '#ffffff' : ink
}

/**
 * The semantic tokens a storefront re-points to the operator's colours, as CSS.
 * Four rules, not two: Radix portals mount on <body>, outside the storefront
 * wrapper, so the tokens are also hoisted to :root whenever a storefront is on
 * the page. Emitted separately because an unsupported `:has()` would invalidate
 * a whole selector list. Returns null when neither colour parses.
 */
export function brandTokenCss(slug: string, primaryColor?: string | null, accentColor?: string | null): string | null {
  const primary = parseHex(primaryColor)
  const accent = parseHex(accentColor)
  if (!primary && !accent) return null

  const scope = `[data-storefront="${slug}"]`
  const light: string[] = []
  const dark: string[] = []

  if (primary) {
    light.push(
      `--brand-primary:${primary}`,
      `--primary:${primary}`,
      `--primary-hover:color-mix(in oklab, ${primary} 82%, #000)`,
      `--primary-soft:color-mix(in oklab, ${primary} 11%, var(--surface))`,
      `--on-primary:${readableOn(primary)}`,
    )
    // Dark mode needs the hue lifted off the background or `text-primary` dies.
    dark.push(
      `--primary:color-mix(in oklab, ${primary} 46%, #fff)`,
      `--primary-hover:color-mix(in oklab, ${primary} 28%, #fff)`,
      `--primary-soft:color-mix(in oklab, ${primary} 46%, var(--surface))`,
      `--on-primary:#0b1417`,
    )
  }

  if (accent) {
    light.push(
      `--brand-accent:${accent}`,
      `--accent:${accent}`,
      `--accent-hover:color-mix(in oklab, ${accent} 84%, #000)`,
      `--accent-soft:color-mix(in oklab, ${accent} 13%, var(--surface))`,
      `--on-accent:${readableOn(accent)}`,
    )
    dark.push(
      `--accent:color-mix(in oklab, ${accent} 74%, #fff)`,
      `--accent-hover:color-mix(in oklab, ${accent} 58%, #fff)`,
      `--accent-soft:color-mix(in oklab, ${accent} 42%, var(--surface))`,
      `--on-accent:#0b1417`,
    )
  }

  const rules = [`${scope}{${light.join(';')}}`, `:root:has(${scope}){${light.join(';')}}`]
  if (dark.length > 0) {
    rules.push(`.dark ${scope}{${dark.join(';')}}`, `:root.dark:has(${scope}){${dark.join(';')}}`)
  }
  return rules.join('')
}
