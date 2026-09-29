/* ==========================================================================
   Email design — an email built from blocks (header, image, heading, text,
   button, activity card, two columns, code, divider, spacer, social,
   footer) over a theme (colours, font, corners). Rendered to real,
   table-based email HTML with inline styles, so the preview is exactly
   what lands in the inbox. Browser-safe.
   ========================================================================== */

export type BlockAlign = 'left' | 'center'

export type EmailBlock =
  | { id: string; type: 'header'; align: BlockAlign; tagline: string }
  | { id: string; type: 'image'; src: string; alt: string; link: string; width: 'full' | 'wide' | 'small'; rounded: boolean }
  | { id: string; type: 'heading'; text: string; size: 'xl' | 'lg' | 'md'; align: BlockAlign }
  | { id: string; type: 'text'; text: string; align: BlockAlign; muted: boolean }
  | { id: string; type: 'button'; label: string; link: string; align: BlockAlign; style: 'solid' | 'outline'; full: boolean }
  | { id: string; type: 'activity'; slug: string; showPrice: boolean; buttonLabel: string }
  | { id: string; type: 'columns'; left: ColumnCell; right: ColumnCell }
  | { id: string; type: 'coupon'; title: string; note: string }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; size: 'sm' | 'md' | 'lg' }
  | { id: string; type: 'social'; instagram: string; facebook: string; tiktok: string }
  | { id: string; type: 'footer'; text: string }

export interface ColumnCell {
  src: string
  title: string
  text: string
  link: string
}

export type EmailBlockType = EmailBlock['type']

export interface EmailTheme {
  /** Buttons, links and accents. */
  accent: string
  /** Behind the card. */
  background: string
  /** The card itself. */
  card: string
  text: string
  font: 'sans' | 'serif' | 'rounded'
  /** Corner radius in px for the card, images and buttons. */
  radius: number
  /** Card width in px. */
  width: 560 | 600 | 680
}

export interface EmailDesign {
  theme: EmailTheme
  blocks: EmailBlock[]
}

export interface SavedEmailTemplate {
  id: string
  name: string
  design: EmailDesign
  updatedAt: string
}

/** What the renderer knows about the business and its trips. */
export interface EmailContext {
  vars: Record<string, string | undefined>
  business: string
  logoText: string
  address: string
  activities: EmailActivity[]
  storefrontUrl: string
}

export interface EmailActivity {
  slug: string
  name: string
  tagline: string
  image: string
  price: string
}

export const BLOCK_LABEL: Record<EmailBlockType, string> = {
  header: 'Logo header',
  image: 'Image',
  heading: 'Heading',
  text: 'Text',
  button: 'Button',
  activity: 'Activity card',
  columns: 'Two columns',
  coupon: 'Discount code',
  divider: 'Divider',
  spacer: 'Space',
  social: 'Social links',
  footer: 'Footer',
}

export const BLOCK_HINT: Record<EmailBlockType, string> = {
  header: 'Your name or logo on top',
  image: 'A photo, uploaded or linked',
  heading: 'A big line',
  text: 'A paragraph, with placeholders',
  button: 'A link people tap',
  activity: 'Photo, name, price and a button',
  columns: 'Two photos side by side',
  coupon: 'The offer code, boxed',
  divider: 'A thin line',
  spacer: 'Breathing room',
  social: 'Instagram, Facebook, TikTok',
  footer: 'Address and small print',
}

let seq = 0
export const blockId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

export function newBlock(type: EmailBlockType, ctx: Pick<EmailContext, 'activities'>): EmailBlock {
  const first = ctx.activities[0]
  const second = ctx.activities[1] ?? first
  const id = blockId()
  switch (type) {
    case 'header':
      return { id, type, align: 'center', tagline: '' }
    case 'image':
      return { id, type, src: first?.image ?? '', alt: first?.name ?? '', link: '{book_link}', width: 'full', rounded: true }
    case 'heading':
      return { id, type, text: 'A headline worth opening', size: 'lg', align: 'left' }
    case 'text':
      return { id, type, text: 'Hi {first_name},\n\nWrite your message here.', align: 'left', muted: false }
    case 'button':
      return { id, type, label: 'Book now', link: '{book_link}', align: 'left', style: 'solid', full: false }
    case 'activity':
      return { id, type, slug: first?.slug ?? '', showPrice: true, buttonLabel: 'See dates' }
    case 'columns':
      return {
        id,
        type,
        left: { src: first?.image ?? '', title: first?.name ?? 'Left', text: first?.tagline ?? '', link: first ? `activity:${first.slug}` : '{book_link}' },
        right: { src: second?.image ?? '', title: second?.name ?? 'Right', text: second?.tagline ?? '', link: second ? `activity:${second.slug}` : '{book_link}' },
      }
    case 'coupon':
      return { id, type, title: '{offer_percent} off your next trip', note: 'Enter the code at checkout.' }
    case 'divider':
      return { id, type }
    case 'spacer':
      return { id, type, size: 'md' }
    case 'social':
      return { id, type, instagram: '', facebook: '', tiktok: '' }
    case 'footer':
      return { id, type, text: 'You get this because you booked with {business} or joined our list.' }
  }
}

/* --------------------------------------------------------------------------
   Themes and templates
   -------------------------------------------------------------------------- */

export function baseTheme(accent: string): EmailTheme {
  return { accent, background: '#F4F2EE', card: '#FFFFFF', text: '#1F1D1A', font: 'sans', radius: 14, width: 600 }
}

export const THEME_BACKGROUNDS = ['#F4F2EE', '#FFFFFF', '#EEF3F6', '#F3F0FA', '#EFF5EF', '#1C1B1F']
export const THEME_CARDS = ['#FFFFFF', '#FBFAF7', '#1F1E23']

export interface EmailTemplateDef {
  id: string
  name: string
  hint: string
  build: (ctx: Pick<EmailContext, 'activities'>, accent: string) => EmailDesign
}

type NoId<T> = T extends unknown ? Omit<T, 'id'> : never
const b = (block: NoId<EmailBlock>): EmailBlock => ({ ...block, id: blockId() }) as EmailBlock

export const EMAIL_TEMPLATES: EmailTemplateDef[] = [
  {
    id: 'letter',
    name: 'Simple letter',
    hint: 'Just words, like a note from you',
    build: (_ctx, accent) => ({
      theme: { ...baseTheme(accent), background: '#FFFFFF', radius: 8 },
      blocks: [
        b({ type: 'header', align: 'left', tagline: '' }),
        b({ type: 'text', text: 'Hi {first_name},\n\nWrite to your guests the way you would talk to them on the dock.\n\nSee you soon,\n{business}', align: 'left', muted: false }),
        b({ type: 'footer', text: 'You get this because you booked with {business} or joined our list.' }),
      ],
    }),
  },
  {
    id: 'photo',
    name: 'Big photo',
    hint: 'A full-width photo, a headline and a button',
    build: (ctx, accent) => {
      const a = ctx.activities[0]
      return {
        theme: baseTheme(accent),
        blocks: [
          b({ type: 'header', align: 'center', tagline: '' }),
          b({ type: 'image', src: a?.image ?? '', alt: a?.name ?? '', link: '{book_link}', width: 'full', rounded: true }),
          b({ type: 'heading', text: 'The season is here', size: 'xl', align: 'center' }),
          b({ type: 'text', text: 'Hi {first_name}, the water is warm and the dates are open. Come out with us.', align: 'center', muted: true }),
          b({ type: 'button', label: 'See dates', link: '{book_link}', align: 'center', style: 'solid', full: false }),
          b({ type: 'spacer', size: 'sm' }),
          b({ type: 'footer', text: 'You get this because you booked with {business} or joined our list.' }),
        ],
      }
    },
  },
  {
    id: 'newsletter',
    name: 'Newsletter',
    hint: 'A story and two trips side by side',
    build: (ctx, accent) => {
      const [a, c] = ctx.activities
      return {
        theme: baseTheme(accent),
        blocks: [
          b({ type: 'header', align: 'left', tagline: 'News from the water' }),
          b({ type: 'heading', text: 'What is new this month', size: 'lg', align: 'left' }),
          b({ type: 'text', text: 'Hi {first_name},\n\nHere is what the crew has been seeing out there, the best days to go, and a couple of trips worth a look.', align: 'left', muted: false }),
          b({
            type: 'columns',
            left: { src: a?.image ?? '', title: a?.name ?? '', text: a?.tagline ?? '', link: a ? `activity:${a.slug}` : '{book_link}' },
            right: { src: c?.image ?? a?.image ?? '', title: c?.name ?? '', text: c?.tagline ?? '', link: c ? `activity:${c.slug}` : '{book_link}' },
          }),
          b({ type: 'divider' }),
          b({ type: 'text', text: 'Questions? Just reply to this email.', align: 'left', muted: true }),
          b({ type: 'social', instagram: '', facebook: '', tiktok: '' }),
          b({ type: 'footer', text: 'You get this because you booked with {business} or joined our list.' }),
        ],
      }
    },
  },
  {
    id: 'offer',
    name: 'Offer',
    hint: 'A code, front and centre',
    build: (ctx, accent) => ({
      theme: { ...baseTheme(accent), background: '#F3F0FA' },
      blocks: [
        b({ type: 'header', align: 'center', tagline: '' }),
        b({ type: 'heading', text: '{offer_percent} off, just for you', size: 'xl', align: 'center' }),
        b({ type: 'text', text: 'Hi {first_name}, book any trip in the next two weeks and save. Bring a friend.', align: 'center', muted: true }),
        b({ type: 'coupon', title: 'Your code', note: 'Enter it at checkout. Good for 14 days.' }),
        b({ type: 'button', label: 'Use my code', link: '{book_link}', align: 'center', style: 'solid', full: true }),
        b({ type: 'spacer', size: 'sm' }),
        ...(ctx.activities[0] ? [b({ type: 'activity', slug: ctx.activities[0].slug, showPrice: true, buttonLabel: 'See dates' })] : []),
        b({ type: 'footer', text: 'You get this because you booked with {business} or joined our list.' }),
      ],
    }),
  },
  {
    id: 'launch',
    name: 'New trip',
    hint: 'Announce something new',
    build: (ctx, accent) => {
      const a = ctx.activities[0]
      return {
        theme: { ...baseTheme(accent), background: '#EEF3F6' },
        blocks: [
          b({ type: 'header', align: 'left', tagline: 'Just announced' }),
          b({ type: 'image', src: a?.image ?? '', alt: a?.name ?? '', link: a ? `activity:${a.slug}` : '{book_link}', width: 'full', rounded: true }),
          b({ type: 'heading', text: a ? `New: ${a.name}` : 'Something new', size: 'lg', align: 'left' }),
          b({ type: 'text', text: 'Hi {first_name}, we have been working on this one for a while and you are among the first to hear. Early bookers get the best seats.', align: 'left', muted: false }),
          ...(a ? [b({ type: 'activity', slug: a.slug, showPrice: true, buttonLabel: 'Be first to book' })] : []),
          b({ type: 'footer', text: 'You get this because you booked with {business} or joined our list.' }),
        ],
      }
    },
  },
  {
    id: 'thanks',
    name: 'Thank you',
    hint: 'After the trip: thanks and a review',
    build: (ctx, accent) => ({
      theme: { ...baseTheme(accent), background: '#EFF5EF', font: 'serif' },
      blocks: [
        b({ type: 'header', align: 'center', tagline: '' }),
        b({ type: 'heading', text: 'Thank you for coming out with us', size: 'lg', align: 'center' }),
        b({ type: 'text', text: 'Hi {first_name}, it was a pleasure having you aboard {activity}. If you have a minute, a review helps a small crew more than anything.', align: 'center', muted: true }),
        b({ type: 'button', label: 'Leave a review', link: '{manage_link}', align: 'center', style: 'solid', full: false }),
        b({ type: 'divider' }),
        b({ type: 'heading', text: 'Next time', size: 'md', align: 'center' }),
        ...(ctx.activities[1] ?? ctx.activities[0] ? [b({ type: 'activity', slug: (ctx.activities[1] ?? ctx.activities[0]).slug, showPrice: true, buttonLabel: 'See dates' })] : []),
        b({ type: 'footer', text: 'You get this because you booked with {business}.' }),
      ],
    }),
  },
]

/** A design from plain text: the fallback when an older message has none. */
export function designFromText(subject: string, body: string, accent: string): EmailDesign {
  return {
    theme: { ...baseTheme(accent), background: '#FFFFFF', radius: 8 },
    blocks: [
      { id: blockId(), type: 'header', align: 'left', tagline: '' },
      { id: blockId(), type: 'text', text: body, align: 'left', muted: false },
      { id: blockId(), type: 'footer', text: 'You get this because you booked with {business} or joined our list.' },
    ],
  }
}

/** The words of a design, for the plain-text part of the email and the list preview. */
export function plainTextOf(design: EmailDesign, render: (text: string) => string): string {
  return design.blocks
    .map((block) => {
      if (block.type === 'heading' || block.type === 'text') return render(block.text)
      if (block.type === 'button') return `${render(block.label)}: ${render(block.link)}`
      if (block.type === 'coupon') return `${render(block.title)} — {offer_code}`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

/* --------------------------------------------------------------------------
   HTML
   -------------------------------------------------------------------------- */

const FONT: Record<EmailTheme['font'], string> = {
  sans: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  rounded: "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif",
}

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || '•'

function isDark(hex: string) {
  const value = hex.replace('#', '')
  if (value.length < 6) return false
  const [r, g, bl] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * bl < 140
}

export function fill(text: string, vars: EmailContext['vars']) {
  return text.replace(/\{([a-z_]+)\}/g, (match, key: string) => vars[key] ?? match)
}

function hrefFor(link: string, ctx: EmailContext) {
  if (link.startsWith('activity:')) return `${ctx.storefrontUrl}/${link.slice(9)}`
  const value = fill(link, ctx.vars)
  return /^https?:\/\//.test(value) ? value : `https://${value.replace(/^\/+/, '')}`
}

export function renderEmailHtml(design: EmailDesign, ctx: EmailContext, preheader = ''): string {
  const t = design.theme
  const dark = isDark(t.card)
  const ink = dark ? '#F4F2EE' : t.text
  const soft = dark ? '#B9B5AE' : '#6B665E'
  const line = dark ? '#3A383F' : '#E7E3DC'
  const onAccent = isDark(t.accent) ? '#FFFFFF' : '#1F1D1A'
  const pad = 32
  const r = t.radius
  const f = (text: string) => esc(fill(text, ctx.vars)).replace(/\n/g, '<br>')
  const alignOf = (align: BlockAlign) => (align === 'center' ? 'center' : 'left')
  const row = (html: string, padding = `0 ${pad}px`) => `<tr><td style="padding:${padding}">${html}</td></tr>`

  const button = (label: string, href: string, style: 'solid' | 'outline', full: boolean, align: BlockAlign) => {
    const css =
      style === 'solid'
        ? `background:${t.accent};color:${onAccent};border:2px solid ${t.accent};`
        : `background:transparent;color:${t.accent};border:2px solid ${t.accent};`
    return `<div style="text-align:${alignOf(align)}"><a href="${esc(href)}" style="${css}display:${full ? 'block' : 'inline-block'};padding:13px 26px;border-radius:${Math.min(r, 999)}px;font-weight:700;font-size:15px;text-decoration:none;text-align:center">${f(label)}</a></div>`
  }

  const blocks = design.blocks
    .map((block) => {
      switch (block.type) {
        case 'header':
          return row(
            `<div style="text-align:${alignOf(block.align)}"><span style="display:inline-block;font-size:19px;font-weight:800;letter-spacing:-0.01em;color:${ink}"><span style="display:inline-block;width:28px;height:28px;line-height:28px;margin-right:8px;border-radius:${Math.min(r, 8)}px;background:${t.accent};color:${onAccent};text-align:center;font-size:12px;vertical-align:middle">${esc(initials(ctx.logoText))}</span><span style="vertical-align:middle">${esc(ctx.business)}</span></span>${block.tagline ? `<div style="margin-top:4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${soft}">${f(block.tagline)}</div>` : ''}</div>`,
            `${pad}px ${pad}px 20px`,
          )
        case 'image': {
          if (!block.src) return row(`<div style="padding:40px;border:2px dashed ${line};border-radius:${r}px;text-align:center;color:${soft};font-size:13px">Add an image</div>`, `8px ${pad}px`)
          const width = block.width === 'full' ? '100%' : block.width === 'wide' ? '80%' : '50%'
          const img = `<img src="${esc(block.src)}" alt="${esc(block.alt)}" style="display:block;margin:0 auto;width:${width};max-width:100%;height:auto;border:0;border-radius:${block.rounded ? r : 0}px">`
          return row(block.link ? `<a href="${esc(hrefFor(block.link, ctx))}">${img}</a>` : img, block.width === 'full' && !block.rounded ? '0' : `8px ${pad}px`)
        }
        case 'heading': {
          const size = block.size === 'xl' ? 32 : block.size === 'lg' ? 25 : 19
          return row(`<h1 style="margin:0;font-size:${size}px;line-height:1.2;font-weight:800;letter-spacing:-0.015em;color:${ink};text-align:${alignOf(block.align)}">${f(block.text)}</h1>`, `18px ${pad}px 6px`)
        }
        case 'text':
          return row(`<p style="margin:0;font-size:16px;line-height:1.6;color:${block.muted ? soft : ink};text-align:${alignOf(block.align)}">${f(block.text)}</p>`, `10px ${pad}px`)
        case 'button':
          return row(button(block.label, hrefFor(block.link, ctx), block.style, block.full, block.align), `16px ${pad}px`)
        case 'activity': {
          const a = ctx.activities.find((entry) => entry.slug === block.slug) ?? ctx.activities[0]
          if (!a) return ''
          return row(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${line};border-radius:${r}px;overflow:hidden;border-collapse:separate"><tr><td>${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.name)}" style="display:block;width:100%;height:auto;border:0">` : ''}</td></tr><tr><td style="padding:18px 20px"><div style="font-size:18px;font-weight:800;color:${ink}">${esc(a.name)}</div><div style="margin-top:4px;font-size:14px;line-height:1.5;color:${soft}">${esc(a.tagline)}</div>${block.showPrice ? `<div style="margin-top:10px;font-size:14px;color:${ink}">From <b>${esc(a.price)}</b></div>` : ''}<div style="margin-top:14px">${button(block.buttonLabel, `${ctx.storefrontUrl}/${a.slug}`, 'solid', false, 'left')}</div></td></tr></table>`,
            `12px ${pad}px`,
          )
        }
        case 'columns': {
          const cell = (c: ColumnCell) =>
            `<td class="col" valign="top" width="50%" style="padding:0 8px 12px"><a href="${esc(hrefFor(c.link, ctx))}" style="text-decoration:none">${c.src ? `<img src="${esc(c.src)}" alt="${esc(c.title)}" style="display:block;width:100%;height:auto;border:0;border-radius:${r}px">` : ''}<div style="margin-top:10px;font-size:15px;font-weight:800;color:${ink}">${f(c.title)}</div></a><div style="margin-top:3px;font-size:13px;line-height:1.5;color:${soft}">${f(c.text)}</div></td>`
          return row(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -8px"><tr>${cell(block.left)}${cell(block.right)}</tr></table>`, `12px ${pad}px`)
        }
        case 'coupon':
          return row(
            `<div style="border:2px dashed ${t.accent};border-radius:${r}px;padding:18px;text-align:center"><div style="font-size:13px;color:${soft}">${f(block.title)}</div><div style="margin-top:6px;font-family:'Courier New',monospace;font-size:26px;font-weight:700;letter-spacing:0.12em;color:${ink}">${esc(ctx.vars.offer_code || 'CODE')}</div><div style="margin-top:6px;font-size:12px;color:${soft}">${f(block.note)}</div></div>`,
            `14px ${pad}px`,
          )
        case 'divider':
          return row(`<div style="height:1px;background:${line};line-height:1px;font-size:0">&nbsp;</div>`, `18px ${pad}px`)
        case 'spacer':
          return `<tr><td style="height:${block.size === 'sm' ? 12 : block.size === 'md' ? 24 : 44}px;line-height:0;font-size:0">&nbsp;</td></tr>`
        case 'social': {
          const links = [
            ['Instagram', block.instagram],
            ['Facebook', block.facebook],
            ['TikTok', block.tiktok],
          ].map(([label, handle]) => `<a href="${esc(handle ? (handle.startsWith('http') ? handle : `https://${handle}`) : '#')}" style="display:inline-block;margin:0 6px;padding:7px 12px;border:1px solid ${line};border-radius:999px;font-size:12px;font-weight:700;color:${ink};text-decoration:none">${label}</a>`)
          return row(`<div style="text-align:center">${links.join('')}</div>`, `14px ${pad}px`)
        }
        case 'footer':
          return row(
            `<div style="border-top:1px solid ${line};padding-top:18px;font-size:12px;line-height:1.6;color:${soft};text-align:center">${f(block.text)}<br>${esc(ctx.business)} · ${esc(ctx.address)}<br><a href="#" style="color:${soft}">Unsubscribe</a> · <a href="#" style="color:${soft}">Update preferences</a></div>`,
            `18px ${pad}px ${pad}px`,
          )
      }
    })
    .join('')

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(ctx.business)}</title><style>body{margin:0}img{max-width:100%}@media (max-width:620px){.card{border-radius:0!important}}@media (max-width:480px){.col{display:block!important;width:100%!important;padding:0 0 16px!important}}</style></head><body style="margin:0;padding:0;background:${t.background};font-family:${FONT[t.font]}">${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${esc(fill(preheader, ctx.vars))}</div>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.background}"><tr><td align="center" style="padding:28px 12px"><table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" style="max-width:${t.width}px;background:${t.card};border-radius:${r}px;overflow:hidden">${blocks}</table></td></tr></table></body></html>`
}
