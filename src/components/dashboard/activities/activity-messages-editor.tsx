'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Mail, MessageSquareText } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { groupOf, timingLabel, type MessageTemplate } from '@/lib/messaging'

/* ==========================================================================
   Messages guests get — on the Guests step. The business writes its
   confirmation, reminder and follow-ups once, in Marketing; here each
   activity says which of them it sends and adds a note of its own (where
   to park, what to wear) to the confirmation and the reminder. Nothing is
   written twice.
   ========================================================================== */

/** The automatic messages a booked guest can get, in the order they arrive. */
const BOOKING_KEYS = ['confirmation', 'what_to_bring', 'balance_due', 'reminder', 'upsell', 'review_request']

export function sendsFor(template: MessageTemplate, slug: string) {
  if (!template.enabled) return false
  if (template.excludeSlugs?.includes(slug)) return false
  return !template.activitySlugs || template.activitySlugs.length === 0 || template.activitySlugs.includes(slug)
}

export function ActivityMessagesEditor({
  tenantId,
  slug,
  note,
  onNote,
  takesDeposit,
}: {
  tenantId: string
  /** The activity's address, which the messages are switched on and off by. */
  slug: string
  note: string
  onNote: (note: string) => void
  /** The balance reminder only matters when a deposit is taken. */
  takesDeposit: boolean
}) {
  const { templates, update } = useMessageTemplates(tenantId)
  const automatic = [
    ...BOOKING_KEYS.map((key) => templates.find((template) => template.key === key)).filter((template): template is MessageTemplate => Boolean(template)),
    ...templates.filter((template) => template.custom && groupOf(template) === 'booking'),
  ].filter((template) => template.key !== 'balance_due' || takesDeposit)

  const toggle = (template: MessageTemplate, on: boolean) => {
    const excluded = template.excludeSlugs ?? []
    if (on) {
      const only = template.activitySlugs ?? []
      update(template.key, {
        excludeSlugs: excluded.filter((entry) => entry !== slug),
        // A message kept to a list of activities gains this one.
        ...(only.length > 0 && !only.includes(slug) ? { activitySlugs: [...only, slug] } : {}),
      })
    } else {
      update(template.key, { excludeSlugs: [...new Set([...excluded, slug])] })
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Messages guests get</h3>
          <p className="mt-0.5 text-xs text-subtle">The wording is shared by every activity; pick which ones this activity sends.</p>
        </div>
        <Link href="/dashboard/marketing/automations" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Edit the wording
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle p-0">
        {automatic.map((template) => {
          const on = sendsFor(template, slug)
          return (
            <li key={template.key} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-subtle" aria-hidden="true">
                {template.channel === 'sms' ? <MessageSquareText className="size-3.5" /> : <Mail className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{template.name}</span>
                <span className="block truncate text-xs text-subtle">
                  {template.enabled ? timingLabel(template.timing) : 'Off for every activity, in Marketing'}
                </span>
              </span>
              <Switch checked={on} disabled={!template.enabled} onCheckedChange={(next) => toggle(template, next)} aria-label={`Send ${template.name}`} />
            </li>
          )
        })}
      </ul>

      <Field label="A note for this activity" optional description="Added to the confirmation and the reminder. Parking, what to wear, where to check in.">
        {(control) => <Textarea {...control} rows={3} maxLength={400} value={note} onChange={(event) => onNote(event.target.value)} placeholder="Park in the harbour lot behind the fuel dock; the check-in tent is by the ramp." />}
      </Field>
    </section>
  )
}
