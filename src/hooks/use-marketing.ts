'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'

import {
  NO_OFFER,
  defaultAudiences,
  defaultForms,
  defaultSettings,
  type Audience,
  type Campaign,
  type MarketingSettings,
  type SignupForms,
} from '@/lib/marketing'
import type { SavedEmailTemplate } from '@/lib/email-design'
import type { Tenant } from '@/types'

/* ==========================================================================
   useMarketing — campaigns, audiences, sign-up forms and the
   marketing rules for one business, live. Kept in the browser over the
   defaults (the demo has no backend), shared by the dashboard and the
   storefront so a switch flipped here shows there straight away.
   ========================================================================== */

export const MARKETING_EVENT = 'ezra:marketing'
const keyFor = (slug: string) => `ezra:marketing:${slug}`
const signupsKey = (slug: string) => `ezra:marketing-signups:${slug}`

interface MarketingStore {
  campaigns?: Campaign[]
  /** The business's own audiences; the built-in ones are always there. */
  audiences?: Audience[]
  forms?: SignupForms
  settings?: MarketingSettings
  emailTemplates?: SavedEmailTemplate[]
}

export interface Signup {
  email: string
  phone?: string
  source: 'popup' | 'footer' | 'checkout'
  at: string
}

export interface MarketingTenant {
  slug: string
  name: string
  email: string
  country: string
}

function read(key: string) {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function parse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(MARKETING_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(MARKETING_EVENT, onChange)
  }
}

/** Seeded campaigns: three sent, one scheduled, one draft. */
export function defaultCampaigns(tenant: MarketingTenant, nowIso: string): Campaign[] {
  const day = (offset: number, hour = 9) => {
    const at = new Date(nowIso)
    at.setDate(at.getDate() + offset)
    at.setHours(hour, 0, 0, 0)
    return at.toISOString()
  }
  const base = { preheader: '', button: { enabled: true, label: 'See dates', activitySlug: '' }, offer: NO_OFFER, abTest: { enabled: false, subjectB: '' } }
  return [
    {
      ...base,
      id: 'cmp_season',
      name: 'New season is open',
      channel: 'email',
      audienceId: 'aud_all',
      subject: 'The new season is here, {first_name}',
      preheader: 'Dates are open through spring.',
      body: `Hi {first_name},\n\nThe new season is open and the first dates are filling up. Here is what is new, and the best days to go.\n\nSee you out there,\n{business}`,
      status: 'sent',
      sentAt: day(-26),
      createdAt: day(-28),
    },
    {
      ...base,
      id: 'cmp_locals',
      name: 'Locals week',
      channel: 'sms',
      audienceId: 'aud_local',
      subject: '',
      body: '{business}: locals week! {offer_percent} off every trip with {offer_code} until Sunday. {book_link}',
      offer: { enabled: true, percent: 20, validDays: 7, code: 'LOCALS20' },
      status: 'sent',
      sentAt: day(-12, 11),
      createdAt: day(-13),
    },
    {
      ...base,
      id: 'cmp_lastseats',
      name: 'Last seats this weekend',
      channel: 'email',
      audienceId: 'aud_repeat',
      subject: 'A few seats left this weekend',
      preheader: 'Saturday and Sunday still have room.',
      body: 'Hi {first_name},\n\nA handful of seats are still open this weekend. As one of our regulars, you get first pick.\n\n{business}',
      abTest: { enabled: true, subjectB: '{first_name}, want this weekend?' },
      status: 'sent',
      sentAt: day(-5, 16),
      createdAt: day(-5),
    },
    {
      ...base,
      id: 'cmp_gifts',
      name: 'Gift cards for the holidays',
      channel: 'email',
      audienceId: 'aud_all',
      subject: 'The gift that gets them outside',
      preheader: 'Gift cards, delivered by email in a minute.',
      body: 'Hi {first_name},\n\nStuck for a present? A {business} gift card is good for any trip, for a full year.\n\n{business}',
      button: { enabled: true, label: 'Buy a gift card', activitySlug: '' },
      status: 'scheduled',
      sendAt: day(6),
      createdAt: day(-1),
    },
    {
      ...base,
      id: 'cmp_draft',
      name: 'Spring newsletter',
      channel: 'email',
      audienceId: 'aud_all',
      subject: 'What is new this spring',
      body: 'Hi {first_name},\n\n',
      status: 'draft',
      createdAt: day(0),
    },
  ]
}

/** Read-time send: scheduled and due becomes sent at the time it was set for. */
function dueToSend(campaign: Campaign, nowIso: string, paused: boolean): Campaign {
  if (campaign.status !== 'scheduled' || !campaign.sendAt || paused) return campaign
  if (new Date(campaign.sendAt).getTime() > new Date(nowIso).getTime()) return campaign
  return { ...campaign, status: 'sent', sentAt: campaign.sendAt }
}

export function useMarketing(tenant: MarketingTenant, nowIso: string) {
  const { slug } = tenant
  const raw = React.useSyncExternalStore(subscribe, () => read(keyFor(slug)), () => '')
  const signupsRaw = React.useSyncExternalStore(subscribe, () => read(signupsKey(slug)), () => '')
  const store = React.useMemo(() => parse<MarketingStore>(raw, {}), [raw])

  const settings = React.useMemo(() => ({ ...defaultSettings(tenant.name, tenant.email), ...store.settings }), [store.settings, tenant.name, tenant.email])
  // A scheduled campaign whose time has come reads as sent. Paused marketing holds it until resumed.
  const campaigns = React.useMemo(
    () => (store.campaigns ?? defaultCampaigns(tenant, nowIso)).map((campaign) => dueToSend(campaign, nowIso, settings.paused)),
    [store.campaigns, tenant, nowIso, settings.paused],
  )
  const audiences = React.useMemo(() => [...defaultAudiences(tenant.country), ...(store.audiences ?? [])], [store.audiences, tenant.country])
  const forms = React.useMemo(() => {
    const base = defaultForms(slug)
    const saved = store.forms
    return saved ? { popup: { ...base.popup, ...saved.popup }, footer: { ...base.footer, ...saved.footer }, checkout: { ...base.checkout, ...saved.checkout } } : base
  }, [store.forms, slug])
  const signups = React.useMemo(() => parse<Signup[]>(signupsRaw, []), [signupsRaw])
  // Scheduled campaigns whose time came while marketing was paused: they wait for the owner to say.
  const held = React.useMemo(
    () => (settings.paused ? campaigns.filter((campaign) => campaign.status === 'scheduled' && campaign.sendAt && new Date(campaign.sendAt).getTime() <= new Date(nowIso).getTime()) : []),
    [campaigns, settings.paused, nowIso],
  )

  const write = React.useCallback(
    (patch: MarketingStore | null) => {
      try {
        if (patch) window.localStorage.setItem(keyFor(slug), JSON.stringify({ ...parse<MarketingStore>(read(keyFor(slug)), {}), ...patch }))
        else window.localStorage.removeItem(keyFor(slug))
      } catch {
        // Usually a full browser store: big uploaded photos. Say so rather than lose the change quietly.
        toast.error('Could not save', { description: 'The browser storage is full. Use smaller photos or image links.' })
      }
      window.dispatchEvent(new Event(MARKETING_EVENT))
    },
    [slug],
  )

  return {
    campaigns,
    audiences,
    customAudiences: store.audiences ?? [],
    forms,
    settings,
    signups,
    emailTemplates: store.emailTemplates ?? [],
    saveEmailTemplate: (template: SavedEmailTemplate) => {
      const own = store.emailTemplates ?? []
      write({ emailTemplates: own.some((entry) => entry.id === template.id) ? own.map((entry) => (entry.id === template.id ? template : entry)) : [template, ...own] })
    },
    removeEmailTemplate: (id: string) => write({ emailTemplates: (store.emailTemplates ?? []).filter((entry) => entry.id !== id) }),
    /** Back to drafts: a scheduled campaign that should not go yet. */
    unscheduleCampaign: (id: string) =>
      write({ campaigns: campaigns.map((entry) => (entry.id === id && entry.status === 'scheduled' ? { ...entry, status: 'draft' as const } : entry)) }),
    saveCampaign: (campaign: Campaign) =>
      write({ campaigns: campaigns.some((entry) => entry.id === campaign.id) ? campaigns.map((entry) => (entry.id === campaign.id ? campaign : entry)) : [campaign, ...campaigns] }),
    removeCampaign: (id: string) => write({ campaigns: campaigns.filter((entry) => entry.id !== id) }),
    held,
    /** On resuming marketing: send the held campaigns now, or move them back to drafts. */
    releaseHeld: (mode: 'send' | 'draft') => {
      const ids = new Set(held.map((campaign) => campaign.id))
      write({
        campaigns: campaigns.map((entry) => (!ids.has(entry.id) ? entry : mode === 'send' ? { ...entry, sendAt: nowIso } : { ...entry, status: 'draft' as const })),
      })
    },
    saveAudience: (audience: Audience) => {
      const own = store.audiences ?? []
      write({ audiences: own.some((entry) => entry.id === audience.id) ? own.map((entry) => (entry.id === audience.id ? audience : entry)) : [...own, audience] })
    },
    removeAudience: (id: string) => write({ audiences: (store.audiences ?? []).filter((entry) => entry.id !== id) }),
    setForms: (next: SignupForms) => write({ forms: next }),
    setSettings: (next: MarketingSettings) => write({ settings: next }),
    /** Back to the default rules. Campaigns, audiences, forms and saved email templates stay. */
    resetSettings: () => write({ settings: undefined }),
    /** Everything back to the defaults, except saved email templates: those are the business's own work. */
    reset: () => write(store.emailTemplates?.length ? { campaigns: undefined, audiences: undefined, forms: undefined, settings: undefined, emailTemplates: store.emailTemplates } : null),
    hasEdits: raw !== '',
    settingsEdited: Boolean(store.settings),
  }
}

/** For the storefront: add someone to the list. */
export function addSignup(slug: string, signup: Signup) {
  try {
    const list = parse<Signup[]>(read(signupsKey(slug)), [])
    if (!list.some((entry) => entry.email.toLowerCase() === signup.email.toLowerCase())) list.unshift(signup)
    window.localStorage.setItem(signupsKey(slug), JSON.stringify(list.slice(0, 500)))
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(MARKETING_EVENT))
}

/** The few tenant fields marketing needs, stable across renders. */
export function useMarketingTenant(tenant: Tenant): MarketingTenant {
  return React.useMemo(
    () => ({ slug: tenant.slug, name: tenant.name, email: tenant.contact.email, country: tenant.country }),
    [tenant.slug, tenant.name, tenant.contact.email, tenant.country],
  )
}
