'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { Check, Copy, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { addSignup, useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { cleanCode } from '@/lib/marketing'
import type { Tenant } from '@/types'

/* ==========================================================================
   Storefront marketing — the pieces guests see, each driven by a switch on
   the Marketing page: the sign-up pop-up, the footer sign-up, the checkout
   opt-in.
   ========================================================================== */

const NOW_ISO = '2026-09-11T09:00:00'
const EMAIL = /^\S+@\S+\.\S+$/

function readStamp(key: string): number {
  try {
    return Number(window.localStorage.getItem(key) ?? 0)
  } catch {
    return 0
  }
}
function writeStamp(key: string) {
  try {
    window.localStorage.setItem(key, String(Date.now()))
  } catch {
    /* storage blocked */
  }
}

/* --------------------------------------------------------------------------
   Pop-up
   -------------------------------------------------------------------------- */

export function SignupPopup({ tenant: tenantRecord }: { tenant: Tenant }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, NOW_ISO)
  const popup = marketing.forms.popup
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [error, setError] = React.useState('')
  const [done, setDone] = React.useState(false)
  const closedKey = `ezra:popup-closed:${tenant.slug}`
  const joinedKey = `ezra:popup-joined:${tenant.slug}`
  // Never over a checkout or a booking page: the guest is busy.
  const quietPage = /\/(checkout|manage|quote|order)/.test(pathname)

  React.useEffect(() => {
    if (!popup.enabled || marketing.settings.paused || quietPage || open) return
    if (readStamp(joinedKey) > 0) return
    if (Date.now() - readStamp(closedKey) < popup.againAfterDays * 86_400_000) return
    // Checked again at the moment it would open: they may have joined or closed it in another tab.
    const show = () => {
      if (readStamp(joinedKey) > 0 || Date.now() - readStamp(closedKey) < popup.againAfterDays * 86_400_000) return
      setOpen(true)
    }
    if (popup.trigger === 'delay') {
      const timer = window.setTimeout(show, popup.delaySeconds * 1000)
      return () => window.clearTimeout(timer)
    }
    if (popup.trigger === 'scroll') {
      const onScroll = () => {
        const depth = (window.scrollY + window.innerHeight) / Math.max(1, document.documentElement.scrollHeight)
        if (depth * 100 >= popup.scrollPercent) show()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }
    const onLeave = (event: MouseEvent) => {
      if (event.clientY <= 4) show()
    }
    document.addEventListener('mouseleave', onLeave)
    const fallback = window.setTimeout(() => window.matchMedia('(pointer: coarse)').matches && show(), 20_000)
    return () => {
      document.removeEventListener('mouseleave', onLeave)
      window.clearTimeout(fallback)
    }
  }, [popup.enabled, popup.trigger, popup.delaySeconds, popup.scrollPercent, popup.againAfterDays, marketing.settings.paused, quietPage, open, closedKey, joinedKey])

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null

  const close = () => {
    writeStamp(closedKey)
    setOpen(false)
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!EMAIL.test(email.trim())) return setError('Enter a valid email')
    addSignup(tenant.slug, { email: email.trim(), phone: phone.trim() || undefined, source: 'popup', at: new Date().toISOString() })
    writeStamp(joinedKey)
    setDone(true)
  }
  const code = cleanCode(popup.offer.code)

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-popup-title"
        className="relative w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid size-9 place-items-center rounded-full text-subtle hover:bg-surface-sunken hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
        </button>
        {done ? (
          <div className="pr-6">
            <p id="signup-popup-title" className="font-display text-xl font-semibold text-foreground">You are on the list</p>
            {popup.offer.enabled && code ? (
              <>
                <p className="mt-2 text-sm text-muted">Here is your {popup.offer.percent}% code. Enter it at checkout.</p>
                <button
                  type="button"
                  onClick={() => { void navigator.clipboard?.writeText(code); toast.success('Code copied') }}
                  className="mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-line-strong px-4 py-3 font-mono text-lg tracking-wider text-foreground"
                >
                  {code}
                  <Copy className="size-4 text-subtle" aria-hidden="true" />
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Thanks. We will be in touch with new trips and last-minute seats.</p>
            )}
            <Button className="mt-4 w-full" onClick={() => setOpen(false)}>Start browsing</Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {popup.offer.enabled ? <p className="text-xs font-semibold tracking-wide text-primary uppercase">{popup.offer.percent}% off</p> : null}
            <p id="signup-popup-title" className="mt-1 pr-6 font-display text-xl font-semibold leading-snug text-foreground">{popup.headline}</p>
            <p className="mt-2 text-sm text-muted">{popup.text}</p>
            <Input className="mt-4" type="email" autoComplete="email" placeholder="Email address" aria-label="Email address" value={email} aria-invalid={error ? true : undefined} onChange={(e) => { setEmail(e.target.value); setError('') }} />
            {popup.collectPhone ? <Input className="mt-2" type="tel" autoComplete="tel" placeholder="Mobile (optional)" aria-label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value)} /> : null}
            {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
            <Button type="submit" className="mt-3 w-full">{popup.button}</Button>
            {popup.collectPhone ? <p className="mt-2 text-xs text-subtle">{marketing.settings.smsConsent}</p> : null}
            <button type="button" onClick={close} className="mt-2 w-full text-center text-xs font-medium text-subtle hover:text-foreground">No thanks</button>
          </form>
        )}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Footer sign-up
   -------------------------------------------------------------------------- */

export function FooterSignup({ tenant: tenantRecord }: { tenant: Tenant }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, NOW_ISO)
  const footer = marketing.forms.footer
  const [email, setEmail] = React.useState('')
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState('')
  if (!footer.enabled) return null
  return (
    <div className="mb-10 flex flex-col gap-4 rounded-2xl border border-line bg-surface px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-lg font-semibold text-foreground">{footer.headline}</p>
        <p className="mt-0.5 text-sm text-muted">{footer.text}</p>
      </div>
      {done ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <Check className="size-4" aria-hidden="true" />
          You are on the list.
        </p>
      ) : (
        <form
          className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            if (!EMAIL.test(email.trim())) return setError('Enter a valid email')
            addSignup(tenant.slug, { email: email.trim(), source: 'footer', at: new Date().toISOString() })
            setDone(true)
          }}
        >
          <div>
            <Input type="email" autoComplete="email" placeholder="Email address" aria-label="Email address" className="sm:w-72" value={email} aria-invalid={error ? true : undefined} onChange={(e) => { setEmail(e.target.value); setError('') }} />
            {error ? <p className="mt-1 text-xs font-medium text-danger">{error}</p> : null}
          </div>
          <Button type="submit">Join</Button>
        </form>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Checkout opt-in
   -------------------------------------------------------------------------- */

export interface OptInState {
  email: boolean
  sms: boolean
}

export function useCheckoutOptIn(tenantRecord: Tenant) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, NOW_ISO)
  const checkout = marketing.forms.checkout
  const [state, setState] = React.useState<OptInState>({ email: false, sms: false })
  const seeded = React.useRef(false)
  React.useEffect(() => {
    if (seeded.current || !checkout.preChecked) return
    seeded.current = true
    setState({ email: true, sms: false })
  }, [checkout.preChecked])
  return {
    checkout,
    state,
    setState,
    /** After payment: add the guest to the list if they said yes. */
    record: (email: string, phone: string) => {
      if (!checkout.enabled || (!state.email && !state.sms)) return
      addSignup(tenant.slug, { email, phone: state.sms ? phone : undefined, source: 'checkout', at: new Date().toISOString() })
    },
  }
}

export function CheckoutOptIn({ optIn }: { optIn: ReturnType<typeof useCheckoutOptIn> }) {
  const { checkout, state, setState } = optIn
  if (!checkout.enabled) return null
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line px-3.5 py-3">
      <label className="flex items-start gap-3 text-sm text-foreground">
        <Checkbox className="mt-0.5" checked={state.email} onCheckedChange={(checked) => setState((current) => ({ ...current, email: checked === true }))} />
        {checkout.label}
      </label>
      {checkout.sms ? (
        <label className="flex items-start gap-3 text-sm text-foreground">
          <Checkbox className="mt-0.5" checked={state.sms} onCheckedChange={(checked) => setState((current) => ({ ...current, sms: checked === true }))} />
          <span>{checkout.smsLabel}</span>
        </label>
      ) : null}
    </div>
  )
}
