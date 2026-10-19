'use client'

import * as React from 'react'
import { CalendarClock, MessageSquareText } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { BeforeInput } from './changes-policy-editor'
import type { BookingSettings } from '@/types'

/* ==========================================================================
   HOW GUESTS BOOK — the first thing on the Booking step. Book online, send
   a request that the business confirms, or call. Request and call can run
   without a set schedule. Instant booking can still send some cases to a
   request: big groups, other dates, short notice and custom quotes.
   ========================================================================== */

const METHODS: { value: BookingSettings['method']; title: string; text: string; icon: typeof CalendarClock }[] = [
  { value: 'instant', title: 'Book online', text: 'Guests pick a time from your schedule and pay. Booked straight away.', icon: CalendarClock },
  { value: 'request', title: 'Request to book', text: 'Guests send the time and group they want, or call you. You confirm and send a payment link.', icon: MessageSquareText },
]

function Row({ title, text, checked, onChange, children }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-subtle">{text}</span>
        </span>
        <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
      </label>
      {checked && children ? children : null}
    </div>
  )
}

export function BookingSettingsEditor({
  value,
  onChange,
  noticeHours,
  onNotice,
  businessPhone,
  groupWord = 'people',
  rentedWord,
}: {
  value: BookingSettings
  onChange: (next: BookingSettings) => void
  noticeHours: number
  onNotice: (hours: number) => void
  businessPhone: string
  /** What the limit is counted in: "people", "bikes". */
  groupWord?: string
  /** Rentals: the word for what is rented ("bikes"), so the limit can count those or people. */
  rentedWord?: string
}) {
  const set = (patch: Partial<BookingSettings>) => onChange({ ...value, ...patch })
  const instant = value.method === 'instant'

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line p-4">
      <div>
        <h3 className="text-sm font-semibold">How guests book</h3>
        <p className="mt-0.5 text-xs text-subtle">Pick what fits how you work. You can change it any time; bookings already made are not affected.</p>
      </div>

      <div role="radiogroup" aria-label="How guests book" className="grid gap-2 sm:grid-cols-2">
        {METHODS.map((method) => {
          const on = value.method === method.value
          return (
            <button
              key={method.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ method: method.value, scheduled: method.value === 'instant' ? true : value.scheduled })}
              className={cn('flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors', on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <method.icon className={cn('size-4', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                {method.title}
              </span>
              <span className="text-xs text-subtle">{method.text}</span>
            </button>
          )
        })}
      </div>

      {!instant ? (
        <div>
          <p className="text-[0.8125rem] font-medium">Schedule</p>
          <div role="radiogroup" aria-label="Schedule" className="mt-2 grid gap-2 sm:grid-cols-2">
            {([
              [true, 'On a schedule', 'Guests pick one of your times and send a request for it.'],
              [false, 'No set schedule', 'Arranged with each guest. They suggest a day and you agree a time.'],
            ] as const).map(([scheduled, title, text]) => (
              <button
                key={String(scheduled)}
                type="button"
                role="radio"
                aria-checked={value.scheduled === scheduled}
                onClick={() => set({ scheduled })}
                className={cn('rounded-xl border px-3.5 py-3 text-left transition-colors', value.scheduled === scheduled ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
              >
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs text-subtle">{text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Number guests call" optional description={instant ? 'Shown under the booking button.' : 'Shown as a Call button next to the request form.'}>
          {(control) => <Input {...control} type="tel" placeholder={businessPhone} value={value.phone} onChange={(e) => set({ phone: e.target.value })} />}
        </Field>
        <Field label="When you answer" optional>
          {(control) => <Input {...control} placeholder="Mon–Sat, 8am–6pm" value={value.callHours} onChange={(e) => set({ callHours: e.target.value })} />}
        </Field>
        <Field label="You reply to requests within" description="Guests see this after they send one.">
          {(control) => <Input {...control} type="number" min={1} suffix="hours" value={value.replyHours || ''} onChange={(e) => set({ replyHours: Math.max(1, Math.floor(Number(e.target.value)) || 24) })} />}
        </Field>
      </div>

      {instant ? (
        <div className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle pt-4">
          <p className="pb-3 text-[0.8125rem] font-medium">Send these to a request instead</p>
          <Row
            title="Big groups ask first"
            text={`Above a size, guests send a request instead of paying, so you can plan for them.`}
            checked={value.groupLimit > 0}
            onChange={(on) => set({ groupLimit: on ? 10 : 0 })}
          >
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Book online up to">
                {(control) => <Input {...control} type="number" min={1} className="sm:w-48" suffix={groupWord} value={value.groupLimit || ''} onChange={(e) => set({ groupLimit: Math.max(1, Math.floor(Number(e.target.value)) || 1) })} />}
              </Field>
              {rentedWord ? (
                <div role="radiogroup" aria-label="Count the group in" className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-sunken p-0.5">
                  {([
                    ['units', rentedWord],
                    ['people', 'people'],
                  ] as const).map(([by, label]) => {
                    const on = (value.groupCountBy ?? 'units') === by
                    return (
                      <button
                        key={by}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => set({ groupCountBy: by })}
                        className={cn('h-full rounded-md px-3 text-sm font-medium capitalize transition-colors', on ? 'bg-surface text-foreground shadow-xs' : 'text-muted hover:text-foreground')}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </Row>
          <Row
            title="Other dates on request"
            text="Guests can ask for a day or time that is not on your schedule."
            checked={value.otherDates}
            onChange={(otherDates) => set({ otherDates })}
          />
          <Row
            title="Booking notice"
            text="Online booking closes this long before the start. Guests can still ask for something sooner."
            checked={noticeHours > 0}
            onChange={(on) => onNotice(on ? 24 : 0)}
          >
            <Field label="Close online booking">
              {({ id }) => (
                <div className="flex items-center gap-2.5">
                  <BeforeInput id={id} hours={noticeHours} onHours={(hours) => onNotice(Math.max(1, hours))} className="w-full sm:w-64" />
                  <span className="shrink-0 text-sm text-muted">before the start</span>
                </div>
              )}
            </Field>
          </Row>
          <Row
            title="Custom quotes"
            text="Guests can ask for something different: a private version, a special occasion, extra time."
            checked={value.customQuote}
            onChange={(customQuote) => set({ customQuote })}
          />
        </div>
      ) : value.scheduled ? (
        <div className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle pt-4">
          <Row
            title="Booking notice"
            text="Times sooner than this are not offered."
            checked={noticeHours > 0}
            onChange={(on) => onNotice(on ? 24 : 0)}
          >
            <Field label="Hide times sooner than">
              {({ id }) => <BeforeInput id={id} hours={noticeHours} onHours={(hours) => onNotice(Math.max(1, hours))} className="w-full sm:w-64" />}
            </Field>
          </Row>
        </div>
      ) : null}
      {!instant ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
          Requests arrive in Custom requests with the date, group and what they picked. Send a quote there and the guest pays from the link to confirm.
        </p>
      ) : null}
    </section>
  )
}
