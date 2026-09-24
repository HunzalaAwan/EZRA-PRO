import { hashSeed } from '@/lib/utils'

/* ==========================================================================
   Domains and numbers: where a business's emails come from, the web address
   its storefront lives on, and the phone number it texts and takes calls
   on. Browser-safe. The demo simulates DNS checks and number purchases; the
   records and steps are the ones a real mail and SMS provider asks for.
   ========================================================================== */

export type SetupStatus = 'none' | 'pending' | 'verified'

export interface DnsRecord {
  id: string
  type: 'TXT' | 'CNAME' | 'MX' | 'A'
  /** Host as the registrar shows it: "@", "book", "ezra1._domainkey". */
  host: string
  value: string
  purpose: string
  verified: boolean
}

export interface EmailSetup {
  senderName: string
  /** The part before the @: "bookings". */
  fromLocal: string
  domain: string
  replyTo: string
  status: SetupStatus
  records: DnsRecord[]
  checks: number
}

export interface StorefrontDomainSetup {
  domain: string
  status: SetupStatus
  records: DnsRecord[]
  checks: number
  ssl: 'none' | 'issuing' | 'active'
  /** Send visitors of the free address to the custom domain. */
  redirect: boolean
}

export type PhoneMode = 'none' | 'new' | 'own'

export interface PhoneSetup {
  mode: PhoneMode
  /** E.164, "+18085550142". */
  number: string
  country: string
  kind: 'local' | 'toll_free'
  status: SetupStatus
  /** A number the business already has: verified for caller ID, or being moved over. */
  own: { number: string; verified: boolean; porting: boolean }
  /** Alphanumeric sender for countries that allow it, max 11 characters. */
  senderId: string
  forwardTo: string
  hours: { open: string; close: string }
  voicemail: string
  missedCallText: boolean
  /** US carriers block business texts from unregistered numbers (A2P 10DLC). */
  registration: { status: 'not_started' | 'pending' | 'approved'; legalName: string; taxId: string; website: string; sample: string }
}

export interface ChannelSettings {
  email: EmailSetup
  storefront: StorefrontDomainSetup
  phone: PhoneSetup
}

export const SHARED_MAIL_DOMAIN = 'mail.ezrapro.com'
export const STOREFRONT_CNAME = 'cname.ezrapro.com'
export const STOREFRONT_APEX_IP = '76.76.21.21'

/** Registrars most small operators use, for the "where do I add these" help. */
export const REGISTRARS = ['GoDaddy', 'Namecheap', 'Cloudflare', 'Squarespace Domains', 'Wix', 'Google Workspace']

const cleanDomain = (value: string) =>
  value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')

export const isDomain = (value: string) => /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(cleanDomain(value))

/** "book.bluehorizonmaui.com" → root "bluehorizonmaui.com", sub "book"; an apex has sub "@". */
export function splitDomain(value: string) {
  const domain = cleanDomain(value)
  const parts = domain.split('.')
  const root = parts.slice(-2).join('.')
  const sub = parts.length > 2 ? parts.slice(0, -2).join('.') : '@'
  return { domain, root, sub }
}

export function emailRecords(value: string, tenantSlug: string): DnsRecord[] {
  const { domain } = splitDomain(value)
  const token = (hashSeed(`${tenantSlug}:${domain}`) % 1e8).toString(36)
  return [
    { id: 'spf', type: 'TXT', host: '@', value: `v=spf1 include:${SHARED_MAIL_DOMAIN} ~all`, purpose: 'Lets us send as you (SPF)', verified: false },
    { id: 'dkim1', type: 'CNAME', host: 'ezra1._domainkey', value: `ezra1.${token}.dkim.ezrapro.com`, purpose: 'Signs every email (DKIM)', verified: false },
    { id: 'dkim2', type: 'CNAME', host: 'ezra2._domainkey', value: `ezra2.${token}.dkim.ezrapro.com`, purpose: 'Backup signing key (DKIM)', verified: false },
    { id: 'return', type: 'CNAME', host: 'bounce', value: `bounces.${SHARED_MAIL_DOMAIN}`, purpose: 'Handles bounced emails', verified: false },
    { id: 'dmarc', type: 'TXT', host: '_dmarc', value: `v=DMARC1; p=none; rua=mailto:dmarc@${SHARED_MAIL_DOMAIN}`, purpose: 'Tells inboxes what to do with fakes (DMARC)', verified: false },
  ]
}

export function storefrontRecords(value: string, tenantSlug: string): DnsRecord[] {
  const { sub } = splitDomain(value)
  const token = `ezra-verify=${(hashSeed(`site:${tenantSlug}:${value}`) % 1e10).toString(36)}`
  return [
    sub === '@'
      ? { id: 'point', type: 'A', host: '@', value: STOREFRONT_APEX_IP, purpose: 'Points your domain at the storefront', verified: false }
      : { id: 'point', type: 'CNAME', host: sub, value: STOREFRONT_CNAME, purpose: 'Points your domain at the storefront', verified: false },
    { id: 'verify', type: 'TXT', host: sub === '@' ? '_ezra' : `_ezra.${sub}`, value: token, purpose: 'Proves the domain is yours', verified: false },
  ]
}

/**
 * The demo's DNS check: records are found in the order a registrar usually
 * publishes them, so the first check finds some and the second finds all.
 */
export function checkRecords(records: DnsRecord[], checks: number): DnsRecord[] {
  const found = Math.min(records.length, Math.ceil((records.length * (checks + 1)) / 2))
  return records.map((record, index) => ({ ...record, verified: index < found }))
}

export const allVerified = (records: DnsRecord[]) => records.length > 0 && records.every((record) => record.verified)

/* ---------- phone numbers ---------- */

export const PHONE_COUNTRIES: { code: string; name: string; dial: string; senderId: boolean; registration: boolean }[] = [
  { code: 'US', name: 'United States', dial: '+1', senderId: false, registration: true },
  { code: 'CA', name: 'Canada', dial: '+1', senderId: false, registration: false },
  { code: 'AU', name: 'Australia', dial: '+61', senderId: true, registration: false },
  { code: 'NZ', name: 'New Zealand', dial: '+64', senderId: false, registration: false },
  { code: 'GB', name: 'United Kingdom', dial: '+44', senderId: true, registration: false },
]

export const countryMeta = (code: string) => PHONE_COUNTRIES.find((entry) => entry.code === code) ?? PHONE_COUNTRIES[0]

/** "+18085550142" → "+1 (808) 555-0142"; other countries get simple spacing. */
export function formatPhone(e164: string): string {
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`
  return e164.replace(/^(\+\d{2})(\d{1,2})(\d{3,4})(\d{3,4})$/, '$1 $2 $3 $4')
}

export interface AvailableNumber {
  e164: string
  locality: string
  sms: boolean
  voice: boolean
  /** Minor units a month. */
  monthly: number
}

/** Numbers "in stock" for an area code; deterministic so a search repeats. */
export function searchNumbers(country: string, areaCode: string, kind: 'local' | 'toll_free', locality: string): AvailableNumber[] {
  const meta = countryMeta(country)
  const digits = kind === 'toll_free' ? (meta.dial === '+1' ? '833' : '800') : areaCode.replace(/\D/g, '').slice(0, 3) || '808'
  return Array.from({ length: 6 }, (_, index) => {
    const tail = String(1000 + ((hashSeed(`${country}:${digits}:${index}`) % 8999) | 0)).slice(-4)
    const mid = String(200 + ((hashSeed(`${digits}:${index}:mid`) % 700) | 0))
    return {
      e164: meta.dial === '+1' ? `+1${digits}${mid}${tail}` : `${meta.dial}${digits}${mid}${tail}`,
      locality: kind === 'toll_free' ? 'Toll-free' : locality,
      sms: true,
      voice: true,
      monthly: kind === 'toll_free' ? 300 : 150,
    }
  })
}

export function defaultChannels(tenant: { slug: string; name: string; country: string; contact: { email: string; phone: string } }): ChannelSettings {
  const root = tenant.contact.email.split('@')[1] ?? `${tenant.slug.replace(/-/g, '')}.com`
  const country = PHONE_COUNTRIES.find((entry) => entry.name === tenant.country)?.code ?? 'US'
  return {
    email: { senderName: tenant.name, fromLocal: 'bookings', domain: root, replyTo: tenant.contact.email, status: 'none', records: [], checks: 0 },
    storefront: { domain: `book.${root}`, status: 'none', records: [], checks: 0, ssl: 'none', redirect: true },
    phone: {
      mode: 'none',
      number: '',
      country,
      kind: 'local',
      status: 'none',
      own: { number: tenant.contact.phone, verified: false, porting: false },
      senderId: tenant.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 11).toUpperCase(),
      forwardTo: tenant.contact.phone,
      hours: { open: '08:00', close: '17:00' },
      voicemail: `Thanks for calling ${tenant.name}. We are out on the water. Leave a message or text this number and we will get back to you within the hour.`,
      missedCallText: true,
      registration: {
        status: 'not_started',
        legalName: `${tenant.name} LLC`,
        taxId: '',
        website: `https://${tenant.slug}.ezrapro.com`,
        sample: `Hi Maia, you are booked on Sunset Sail on Fri at 4:30 PM. Manage your booking: ${tenant.slug}.ezrapro.com/manage/EZR-8KQ2M Reply STOP to opt out.`,
      },
    },
  }
}

/** The address guests see emails from, right now. */
export function fromAddress(settings: ChannelSettings, tenantSlug: string) {
  return settings.email.status === 'verified'
    ? `${settings.email.fromLocal}@${settings.email.domain}`
    : `${tenantSlug.replace(/-/g, '')}@${SHARED_MAIL_DOMAIN}`
}

/** The storefront host guests land on, right now. */
export function storefrontHost(settings: ChannelSettings, tenantSlug: string) {
  return settings.storefront.status === 'verified' ? settings.storefront.domain : `${tenantSlug}.ezrapro.com`
}

/** The number texts come from, if there is one. */
export function textingNumber(settings: ChannelSettings) {
  const phone = settings.phone
  if (phone.status !== 'verified' || !phone.number) return ''
  // US carriers drop business texts from unregistered numbers; until approval we text from the shared number.
  if (countryMeta(phone.country).registration && phone.registration.status !== 'approved') return ''
  return phone.number
}
