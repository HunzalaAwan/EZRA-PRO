'use client'

import * as React from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Globe,
  Lock,
  Mail,
  Phone,
  PhoneForwarded,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useChannels } from '@/hooks/use-channels'
import {
  PHONE_COUNTRIES,
  REGISTRARS,
  SHARED_MAIL_DOMAIN,
  allVerified,
  checkRecords,
  countryMeta,
  emailRecords,
  formatPhone,
  fromAddress,
  isDomain,
  searchNumbers,
  splitDomain,
  storefrontHost,
  storefrontRecords,
  type AvailableNumber,
  type DnsRecord,
  type SetupStatus,
} from '@/lib/channels'
import { cn, formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   DOMAINS & NUMBERS
   Three setups, each a short guided flow:
   1. Email: send as bookings@yourdomain.com, proven with five DNS records.
   2. Storefront: book.yourdomain.com, one CNAME and a TXT, then SSL.
   3. Phone: a new local or toll-free number, or your own verified number,
      with call forwarding, voicemail, missed-call text-back and, in the US,
      the carrier registration every business texting number needs.
   ========================================================================== */

const copy = async (value: string, what = 'Copied') => {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(what)
  } catch {
    toast.error('Could not copy')
  }
}

function StatusBadge({ status, labels }: { status: SetupStatus; labels?: Partial<Record<SetupStatus, string>> }) {
  const text = { none: 'Not set up', pending: 'Waiting for DNS', verified: 'Connected', ...labels }[status]
  return (
    <Badge variant={status === 'verified' ? 'success' : status === 'pending' ? 'warning' : 'neutral'} size="sm" dot>
      {text}
    </Badge>
  )
}

function Records({ records, onCheck, checking }: { records: DnsRecord[]; onCheck: () => void; checking: boolean }) {
  const done = records.filter((record) => record.verified).length
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Add {records.length === 1 ? 'this record' : `these ${records.length} records`} at your domain provider
          <span className="ml-2 text-xs font-normal text-subtle">
            {done} of {records.length} found
          </span>
        </p>
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw className={cn(checking && 'animate-spin')} />} onClick={onCheck} disabled={checking}>
          {checking ? 'Checking…' : 'Check DNS'}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-sunken/60 text-xs font-semibold text-muted">
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Host / Name</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-line-subtle last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 font-mono text-xs font-semibold">{record.type}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => copy(record.host, 'Host copied')} className="inline-flex items-center gap-1.5 font-mono text-xs hover:text-primary">
                      {record.host}
                      <Copy className="size-3 text-faint" aria-hidden="true" />
                    </button>
                    <span className="mt-0.5 block text-xs text-subtle">{record.purpose}</span>
                  </td>
                  <td className="max-w-[18rem] px-3 py-2.5">
                    <button type="button" onClick={() => copy(record.value, 'Value copied')} className="inline-flex max-w-full items-center gap-1.5 text-left font-mono text-xs break-all hover:text-primary">
                      {record.value}
                      <Copy className="size-3 shrink-0 text-faint" aria-hidden="true" />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {record.verified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Found</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning"><Clock className="size-3.5" aria-hidden="true" />Not yet</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-subtle">
        Where to add them: the DNS settings of whoever you bought the domain from ({REGISTRARS.join(', ')}). New records usually show up within an hour; some
        providers take up to 48. We keep checking on our own and email you when it connects.
      </p>
    </div>
  )
}

export function ChannelsSettingsClient({ tenant }: { tenant: Tenant }) {
  const { settings, save } = useChannels(tenant)
  const [checking, setChecking] = React.useState<'email' | 'storefront' | null>(null)
  const { email, storefront, phone } = settings

  const needsRegistration = countryMeta(phone.country).registration && phone.registration.status !== 'approved'
  const phoneStep: SetupStatus = phone.status === 'verified' && needsRegistration ? 'pending' : phone.status
  const steps = [
    { id: 'email', label: 'Email domain', status: email.status, icon: Mail },
    { id: 'storefront', label: 'Storefront domain', status: storefront.status, icon: Globe },
    { id: 'phone', label: 'Texting and calling number', status: phoneStep, icon: Phone },
  ]
  const doneCount = steps.filter((step) => step.status === 'verified').length

  /* ---------- email ---------- */
  const setEmail = (patch: Partial<typeof email>) => save((current) => ({ ...current, email: { ...current.email, ...patch } }))
  const startEmail = () => {
    if (!isDomain(email.domain)) return toast.error('Enter a domain like bluehorizonmaui.com')
    setEmail({ domain: splitDomain(email.domain).domain, records: emailRecords(email.domain, tenant.slug), status: 'pending', checks: 0 })
    toast.success('Records ready', { description: 'Add them at your domain provider, then press Check DNS.' })
  }
  const checkEmail = () => {
    setChecking('email')
    window.setTimeout(() => {
      const records = checkRecords(email.records, email.checks)
      const ok = allVerified(records)
      setEmail({ records, checks: email.checks + 1, status: ok ? 'verified' : 'pending' })
      setChecking(null)
      if (ok) toast.success('Email domain connected', { description: `Guests now get emails from ${email.fromLocal}@${email.domain}.` })
      else toast(`${records.filter((record) => record.verified).length} of ${records.length} records found`, { description: 'The rest are still on their way. Check again in a few minutes.' })
    }, 900)
  }

  /* ---------- storefront ---------- */
  const setSite = (patch: Partial<typeof storefront>) => save((current) => ({ ...current, storefront: { ...current.storefront, ...patch } }))
  const startSite = () => {
    if (!isDomain(storefront.domain)) return toast.error('Enter a domain like book.bluehorizonmaui.com')
    setSite({ domain: splitDomain(storefront.domain).domain, records: storefrontRecords(storefront.domain, tenant.slug), status: 'pending', checks: 0, ssl: 'none' })
  }
  const checkSite = () => {
    setChecking('storefront')
    window.setTimeout(() => {
      const records = checkRecords(storefront.records, storefront.checks)
      const ok = allVerified(records)
      setSite({ records, checks: storefront.checks + 1, status: ok ? 'verified' : 'pending', ssl: ok ? 'issuing' : 'none' })
      setChecking(null)
      if (ok) {
        toast.success('Domain connected', { description: 'Issuing the SSL certificate now. It takes about a minute.' })
        window.setTimeout(() => save((current) => ({ ...current, storefront: { ...current.storefront, ssl: 'active' } })), 2500)
      } else toast(`${records.filter((record) => record.verified).length} of ${records.length} records found`, { description: 'Check again in a few minutes.' })
    }, 900)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- progress ---------- */}
      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Domains & numbers</CardTitle>
          <CardDescription>
            Send email from your own address, put the storefront on your own domain, and text and take calls on a business number. {doneCount} of 3 set up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid list-none gap-2 p-0 sm:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.id}>
                <a
                  href={`#${step.id}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:border-line-strong',
                    step.status === 'verified' ? 'border-success/30 bg-success-soft/30' : 'border-line',
                  )}
                >
                  {step.status === 'verified' ? (
                    <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong text-xs font-semibold text-muted">{index + 1}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{step.label}</span>
                    <span className="block text-xs text-subtle">
                      {step.status === 'verified' ? 'Done' : step.status === 'pending' ? (step.id === 'phone' ? 'Calls ready · register for texting' : 'Waiting for DNS') : 'Not set up yet'}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ---------- 1. email ---------- */}
      <Card id="email" className="scroll-mt-24">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="size-4 text-primary" aria-hidden="true" />
              Email sending
            </CardTitle>
            <CardDescription>Confirmations, reminders and receipts come from your own address, so they land in the inbox and look like you.</CardDescription>
          </div>
          <StatusBadge status={email.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="rounded-xl bg-surface-sunken/60 px-4 py-3 text-sm">
            <span className="text-muted">Guests get emails from </span>
            <span className="font-semibold text-foreground">
              {email.senderName} &lt;{fromAddress(settings, tenant.slug)}&gt;
            </span>
            {email.status !== 'verified' ? <span className="block text-xs text-subtle">Our shared address ({SHARED_MAIL_DOMAIN}) until your domain is connected. Replies still reach you.</span> : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
            <Field label="Sender name" description="What the inbox shows as From.">
              {(control) => <Input {...control} value={email.senderName} onChange={(e) => setEmail({ senderName: e.target.value })} />}
            </Field>
            <Field label="From address" description={email.status === 'none' ? 'The domain has to be one you own.' : 'Change the domain with Start again.'}>
              <div className="flex items-center gap-1.5">
                <Input value={email.fromLocal} aria-label="Address name" className="w-28 shrink-0" onChange={(e) => setEmail({ fromLocal: e.target.value.replace(/[^a-z0-9._-]/gi, '').toLowerCase() })} />
                <span className="text-sm text-muted">@</span>
                <Input value={email.domain} aria-label="Email domain" disabled={email.status !== 'none'} onChange={(e) => setEmail({ domain: e.target.value.trim().toLowerCase() })} />
              </div>
            </Field>
            <Field label="Replies go to" description="Where guests' replies land.">
              {(control) => <Input {...control} type="email" value={email.replyTo} onChange={(e) => setEmail({ replyTo: e.target.value })} />}
            </Field>
          </div>

          {email.status === 'none' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button leftIcon={<ShieldCheck />} onClick={startEmail}>
                Connect {splitDomain(email.domain).domain || 'domain'}
              </Button>
              <p className="text-xs text-subtle">You get five DNS records to add. It takes about five minutes at your domain provider.</p>
            </div>
          ) : (
            <>
              <Records records={email.records} onCheck={checkEmail} checking={checking === 'email'} />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
                {email.status === 'verified' ? <TestSend kind="email" placeholder={email.replyTo} from={fromAddress(settings, tenant.slug)} /> : <span />}
                <Button variant="ghost" size="sm" leftIcon={<Trash2 />} onClick={() => setEmail({ status: 'none', records: [], checks: 0 })}>
                  Start again
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- 2. storefront ---------- */}
      <Card id="storefront" className="scroll-mt-24">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4 text-primary" aria-hidden="true" />
              Storefront domain
            </CardTitle>
            <CardDescription>Put your booking site on your own web address. Links in every email and text use it too.</CardDescription>
          </div>
          <StatusBadge status={storefront.status} />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-line px-4 py-3">
              <p className="text-xs text-subtle">Free address, always works</p>
              <button type="button" onClick={() => copy(`https://${tenant.slug}.ezrapro.com`, 'Address copied')} className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium hover:text-primary">
                {tenant.slug}.ezrapro.com
                <Copy className="size-3.5 text-faint" aria-hidden="true" />
              </button>
            </div>
            <div className={cn('rounded-xl border px-4 py-3', storefront.status === 'verified' ? 'border-success/30 bg-success-soft/30' : 'border-line')}>
              <p className="text-xs text-subtle">Your domain</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                {storefront.status === 'verified' ? (
                  <>
                    {storefront.domain}
                    {storefront.ssl === 'active' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><Lock className="size-3" aria-hidden="true" />Secure</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-warning"><Clock className="size-3" aria-hidden="true" />Issuing SSL</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted">Not connected yet</span>
                )}
              </p>
            </div>
          </div>

          <Field label="Domain" description="A subdomain like book.yourdomain.com is easiest, and keeps your main website where it is.">
            <Input
              value={storefront.domain}
              disabled={storefront.status !== 'none'}
              leftIcon={<Globe />}
              onChange={(e) => setSite({ domain: e.target.value.trim().toLowerCase() })}
            />
          </Field>

          {storefront.status === 'none' ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button leftIcon={<Globe />} onClick={startSite}>
                Connect domain
              </Button>
              <p className="text-xs text-subtle">
                {splitDomain(storefront.domain).sub === '@' ? 'A root domain needs an A record and a TXT.' : 'You get one CNAME and one TXT record to add.'}
              </p>
            </div>
          ) : (
            <>
              <Records records={storefront.records} onCheck={checkSite} checking={checking === 'storefront'} />
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
                <span>
                  <span className="block text-sm font-medium">Send visitors to your domain</span>
                  <span className="block text-xs text-subtle">Anyone opening {tenant.slug}.ezrapro.com lands on {storefront.domain}.</span>
                </span>
                <Switch checked={storefront.redirect} onCheckedChange={(redirect) => setSite({ redirect })} aria-label="Redirect to your domain" />
              </label>
              <div className="flex justify-end border-t border-line-subtle pt-4">
                <Button variant="ghost" size="sm" leftIcon={<Trash2 />} onClick={() => setSite({ status: 'none', records: [], checks: 0, ssl: 'none' })}>
                  Remove domain
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- 3. phone ---------- */}
      <PhoneSection tenant={tenant} settings={settings} save={save} />
    </div>
  )
}

/* ==========================================================================
   PHONE
   ========================================================================== */

function PhoneSection({ tenant, settings, save }: { tenant: Tenant } & Pick<ReturnType<typeof useChannels>, 'settings' | 'save'>) {
  const phone = settings.phone
  const meta = countryMeta(phone.country)
  const setPhone = (patch: Partial<typeof phone>) => save((current) => ({ ...current, phone: { ...current.phone, ...patch } }))
  const [areaCode, setAreaCode] = React.useState(tenant.contact.phone.replace(/\D/g, '').slice(1, 4) || '808')
  const [results, setResults] = React.useState<AvailableNumber[] | null>(null)
  const [pick, setPick] = React.useState<string>('')
  const [code, setCode] = React.useState<{ sent: string; typed: string } | null>(null)

  const search = () => {
    const found = searchNumbers(phone.country, areaCode, phone.kind, tenant.city)
    setResults(found)
    setPick(found[0]?.e164 ?? '')
  }

  const buy = () => {
    if (!pick) return
    setPhone({ number: pick, status: 'verified', mode: 'new' })
    setResults(null)
    toast.success(`${formatPhone(pick)} is yours`, { description: meta.registration ? 'Calls work now. Register for texting below so carriers deliver your texts.' : 'Calls and texts work now.' })
  }

  const sendCode = () => {
    const sent = String(100000 + Math.floor(Math.random() * 899999))
    setCode({ sent, typed: '' })
    toast(`Calling ${phone.own.number}…`, { description: `Demo: the code read out is ${sent}.` })
  }

  const verifyOwn = () => {
    if (!code || code.typed !== code.sent) return toast.error('That code does not match')
    setPhone({ own: { ...phone.own, verified: true }, number: `+${phone.own.number.replace(/\D/g, '')}`, status: 'verified', mode: 'own' })
    setCode(null)
    toast.success('Number verified', { description: 'Texts and calls now use your own number.' })
  }

  const release = () => {
    setPhone({ status: 'none', number: '', mode: 'none', own: { ...phone.own, verified: false, porting: false } })
    toast('Number released')
  }

  const reg = phone.registration

  return (
    <Card id="phone" className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Phone className="size-4 text-primary" aria-hidden="true" />
            Texting and calling number
          </CardTitle>
          <CardDescription>Reminders and weather updates go out by text from this number. Guests can text back into your Inbox, and calls ring through to you.</CardDescription>
        </div>
        <StatusBadge status={phone.status} labels={{ verified: 'Active' }} />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {phone.status !== 'verified' ? (
          <>
            <div role="radiogroup" aria-label="Which number" className="grid gap-2 md:grid-cols-2">
              {([
                ['new', 'Get a new number', 'A local or toll-free number, ready in a minute. From $1.50 a month.', Smartphone],
                ['own', 'Use the number I have', 'Keep the number on your flyers. We verify it with a call.', PhoneForwarded],
              ] as const).map(([value, label, hint, Icon]) => {
                const on = (phone.mode === 'none' ? 'new' : phone.mode) === value
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPhone({ mode: value })}
                    className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors', on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
                  >
                    <Icon className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{label}</span>
                      <span className="block text-xs text-subtle">{hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {phone.mode !== 'own' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Country">
                    <Select value={phone.country} onValueChange={(country) => { setPhone({ country }); setResults(null) }}>
                      <SelectTrigger className="w-48" aria-label="Country">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_COUNTRIES.map((entry) => (
                          <SelectItem key={entry.code} value={entry.code}>
                            {entry.name} ({entry.dial})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Segmented
                    label="Number type"
                    value={phone.kind}
                    onValueChange={(kind) => { setPhone({ kind }); setResults(null) }}
                    options={[
                      { value: 'local', label: 'Local' },
                      { value: 'toll_free', label: 'Toll-free' },
                    ]}
                  />
                  {phone.kind === 'local' ? (
                    <Field label="Area code">
                      {(control) => <Input {...control} className="w-28" value={areaCode} inputMode="numeric" onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))} />}
                    </Field>
                  ) : null}
                  <Button variant="secondary" leftIcon={<Search />} onClick={search}>
                    Find numbers
                  </Button>
                </div>
                {results ? (
                  <div className="flex flex-col gap-3">
                    <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Available numbers">
                      {results.map((entry) => (
                        <li key={entry.e164}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={pick === entry.e164}
                            onClick={() => setPick(entry.e164)}
                            className={cn('w-full rounded-xl border px-3.5 py-3 text-left transition-colors', pick === entry.e164 ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
                          >
                            <span className="block font-mono text-sm font-semibold tabular-nums">{formatPhone(entry.e164)}</span>
                            <span className="block text-xs text-subtle">
                              {entry.locality} · Text and calls · {formatCurrency(entry.monthly, 'USD')}/mo
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <Button className="sm:w-fit" leftIcon={<CheckCircle2 />} onClick={buy} disabled={!pick}>
                      Get {pick ? formatPhone(pick) : 'this number'}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Your number" description="The business mobile or landline guests already call.">
                    {(control) => <Input {...control} type="tel" className="w-60" value={phone.own.number} onChange={(e) => setPhone({ own: { ...phone.own, number: e.target.value } })} />}
                  </Field>
                  <Button variant="secondary" leftIcon={<Phone />} onClick={sendCode} disabled={phone.own.number.replace(/\D/g, '').length < 8}>
                    Call me with a code
                  </Button>
                </div>
                {code ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <Field label="Six-digit code">
                      {(control) => <Input {...control} className="w-36 font-mono tracking-widest" inputMode="numeric" value={code.typed} onChange={(e) => setCode({ ...code, typed: e.target.value.replace(/\D/g, '').slice(0, 6) })} />}
                    </Field>
                    <Button leftIcon={<ShieldCheck />} onClick={verifyOwn} disabled={code.typed.length !== 6}>
                      Verify
                    </Button>
                  </div>
                ) : null}
                <p className="text-xs text-subtle">
                  A landline can be text-enabled without changing carrier. To move the number to us completely, choose porting after it is verified; it takes 5 to 10 business days and calls keep working throughout.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* ---------- active number ---------- */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-soft/30 px-4 py-3">
              <div>
                <p className="text-xs text-subtle">{phone.mode === 'own' ? 'Your own number' : `${phone.kind === 'toll_free' ? 'Toll-free' : 'Local'} number`} · texts and calls</p>
                <p className="font-mono text-lg font-semibold tabular-nums">{formatPhone(phone.number)}</p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton aria-label="Copy number" variant="outline" size="sm" onClick={() => copy(phone.number, 'Number copied')}>
                  <Copy aria-hidden="true" />
                </IconButton>
                {phone.mode === 'own' && !phone.own.porting ? (
                  <Button variant="secondary" size="sm" onClick={() => { setPhone({ own: { ...phone.own, porting: true } }); toast.success('Port request sent', { description: 'We will email the carrier form. Takes 5–10 business days.' }) }}>
                    Move number to EZRA
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" leftIcon={<Trash2 />} onClick={release}>
                  Release
                </Button>
              </div>
            </div>
            {phone.own.porting && phone.mode === 'own' ? <p className="text-xs text-warning">Port in progress: 5 to 10 business days. Nothing changes for guests meanwhile.</p> : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Forward calls to" description="Calls to the business number ring this phone.">
                {(control) => <Input {...control} type="tel" value={phone.forwardTo} onChange={(e) => setPhone({ forwardTo: e.target.value })} />}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Calls ring from">
                  {(control) => <Input {...control} type="time" value={phone.hours.open} onChange={(e) => setPhone({ hours: { ...phone.hours, open: e.target.value } })} />}
                </Field>
                <Field label="Until">
                  {(control) => <Input {...control} type="time" value={phone.hours.close} onChange={(e) => setPhone({ hours: { ...phone.hours, close: e.target.value } })} />}
                </Field>
              </div>
              <Field label="Voicemail greeting" description="Played outside those hours, or when nobody picks up." className="md:col-span-2">
                {(control) => <Textarea {...control} rows={2} value={phone.voicemail} onChange={(e) => setPhone({ voicemail: e.target.value.slice(0, 400) })} />}
              </Field>
              {meta.senderId ? (
                <Field label="Text sender name" description="Shown instead of the number on one-way texts. Up to 11 letters or numbers.">
                  {(control) => <Input {...control} value={phone.senderId} onChange={(e) => setPhone({ senderId: e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 11) })} />}
                </Field>
              ) : null}
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
              <span>
                <span className="block text-sm font-medium">Text back missed calls</span>
                <span className="block text-xs text-subtle">&ldquo;Sorry we missed you, we are out on a trip. Book or ask here: {storefrontHost(settings, tenant.slug)}&rdquo;</span>
              </span>
              <Switch checked={phone.missedCallText} onCheckedChange={(missedCallText) => setPhone({ missedCallText })} aria-label="Text back missed calls" />
            </label>
            <p className="flex items-center gap-2 text-xs text-subtle">
              <Circle className="size-2 fill-success text-success" aria-hidden="true" />
              Replies from guests arrive in your Inbox, on the booking they belong to.
            </p>

            {meta.registration ? (
              <div className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">US texting registration</p>
                    <p className="text-xs text-muted">US carriers only deliver business texts from registered numbers (called A2P 10DLC). One form, reviewed in 1 to 3 business days.</p>
                  </div>
                  <Badge variant={reg.status === 'approved' ? 'success' : reg.status === 'pending' ? 'warning' : 'neutral'} size="sm" dot>
                    {reg.status === 'approved' ? 'Approved' : reg.status === 'pending' ? 'In review' : 'Not registered'}
                  </Badge>
                </div>
                {reg.status === 'not_started' ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field label="Legal business name">
                      {(control) => <Input {...control} value={reg.legalName} onChange={(e) => setPhone({ registration: { ...reg, legalName: e.target.value } })} />}
                    </Field>
                    <Field label="EIN (tax ID)" description="Nine digits, as on your IRS letter.">
                      {(control) => <Input {...control} value={reg.taxId} placeholder="12-3456789" onChange={(e) => setPhone({ registration: { ...reg, taxId: e.target.value.replace(/[^\d-]/g, '').slice(0, 10) } })} />}
                    </Field>
                    <Field label="Website">
                      {(control) => <Input {...control} value={reg.website} onChange={(e) => setPhone({ registration: { ...reg, website: e.target.value } })} />}
                    </Field>
                    <Field label="What you text" description="Filled in for booking messages. Carriers read this.">
                      <Input value="Booking confirmations, reminders and service updates" disabled aria-label="Use case" />
                    </Field>
                    <Field label="Sample message" className="md:col-span-2">
                      {(control) => <Textarea {...control} rows={2} value={reg.sample} onChange={(e) => setPhone({ registration: { ...reg, sample: e.target.value } })} />}
                    </Field>
                    <Button
                      className="md:w-fit"
                      leftIcon={<Send />}
                      disabled={reg.legalName.trim().length < 2 || reg.taxId.replace(/\D/g, '').length !== 9}
                      onClick={() => { setPhone({ registration: { ...reg, status: 'pending' } }); toast.success('Registration sent', { description: 'Carriers usually approve in 1 to 3 business days.' }) }}
                    >
                      Submit registration
                    </Button>
                  </div>
                ) : reg.status === 'pending' ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-muted">Until approved, texts go out from our shared number and calls work as normal.</p>
                    <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={() => { setPhone({ registration: { ...reg, status: 'approved' } }); toast.success('Approved', { description: 'Texts now come from your number.' }) }}>
                      Check status
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-success">Approved for {reg.legalName}. Texts go out from {formatPhone(phone.number)}.</p>
                )}
              </div>
            ) : null}

            <div className="border-t border-line-subtle pt-4">
              <TestSend kind="text" placeholder={tenant.contact.phone} from={formatPhone(phone.number)} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/* ==========================================================================
   TEST SEND
   ========================================================================== */

function TestSend({ kind, placeholder, from }: { kind: 'email' | 'text'; placeholder: string; from: string }) {
  const [to, setTo] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const valid = kind === 'email' ? /^\S+@\S+\.\S+$/.test(to) : to.replace(/\D/g, '').length >= 8
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!valid) return
        setSending(true)
        window.setTimeout(() => {
          setSending(false)
          toast.success(kind === 'email' ? 'Test email sent' : 'Test text sent', { description: `From ${from} to ${to}.` })
        }, 800)
      }}
    >
      <Input
        type={kind === 'email' ? 'email' : 'tel'}
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder={placeholder}
        aria-label={kind === 'email' ? 'Send a test email to' : 'Send a test text to'}
        className="w-64"
      />
      <Button type="submit" variant="secondary" leftIcon={<Send />} loading={sending} disabled={!valid}>
        Send a test {kind}
      </Button>
    </form>
  )
}
