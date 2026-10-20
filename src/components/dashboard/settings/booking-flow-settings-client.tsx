'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, ListChecks, Save } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import type { BookingRow } from '@/lib/demo'
import { cn } from '@/lib/utils'
import type { Payment, Tenant } from '@/types'

type SampleBooking = (BookingRow & { payments: Payment[] }) | undefined

/* ==========================================================================
   BOOKING FLOW — only what is truly business-wide: how far ahead the
   calendar opens and what happens when a time sells out. Everything that
   differs from one activity to the next (how guests pay, cancellations,
   changes, notice, guest details, waivers) is set on the activity, once,
   so there is never a business rule and an activity rule saying different
   things. The card below says where each one lives now.
   ========================================================================== */

interface BookingRules {
  maxAdvanceDays: number
  waitlistsEnabled: boolean
  waitlistAutoPromote: boolean
}

const defaultRules = (tenant: Tenant): BookingRules => ({
  maxAdvanceDays: 365,
  waitlistsEnabled: tenant.features.waitlists,
  waitlistAutoPromote: true,
})

/** Where each setting that used to be here is set now. */
const ON_EACH_ACTIVITY: { title: string; where: string; text: string }[] = [
  { title: 'How guests pay', where: 'Pricing step', text: 'In full, a deposit with the rest charged later, or pay on the day.' },
  { title: 'Cancellation policy', where: 'Booking step', text: 'Full refund until a set number of hours or days before, then a share back.' },
  { title: 'Changes guests can make', where: 'Booking step', text: 'Move to another time, add people, cancel online, with any fee.' },
  { title: 'Booking notice', where: 'Booking step', text: 'How long before the start online booking closes.' },
  { title: 'Guest details and waiver', where: 'Guests step', text: 'What each guest is asked and who signs.' },
]

export interface BookingFlowSettingsClientProps {
  tenant: Tenant
  sampleBooking: SampleBooking
}

export function BookingFlowSettingsClient({ tenant }: BookingFlowSettingsClientProps) {
  const [rules, setRules] = React.useState<BookingRules>(() => defaultRules(tenant))
  const [saving, setSaving] = React.useState(false)
  const set = <K extends keyof BookingRules>(key: K, value: BookingRules[K]) => setRules((prev) => ({ ...prev, [key]: value }))
  const dirty = JSON.stringify(rules) !== JSON.stringify(defaultRules(tenant))

  const save = () => {
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      toast.success('Booking flow saved', { description: 'Applies to every activity from now on.' })
    }, 620)
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Calendar and sold-out times
          </CardTitle>
          <CardDescription>The same for every activity you sell.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-0">
          <Field label="Calendar opens" description="How far ahead guests can book." className="sm:max-w-sm">
            {({ id }) => (
              <Select value={String(rules.maxAdvanceDays)} onValueChange={(value) => set('maxAdvanceDays', Number(value))}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[90, 180, 365, 540].map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} days ahead
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <ToggleRow
            title="Waitlist on sold-out times"
            body="Guests join a list instead of leaving. You keep the demand."
            checked={rules.waitlistsEnabled}
            onCheckedChange={(value) => set('waitlistsEnabled', value)}
            badge={tenant.features.waitlists ? undefined : <Badge variant="warning" size="sm">Growth plan</Badge>}
          />
          <ToggleRow
            title="Offer freed spots to the waitlist"
            body="When someone cancels or moves, the next guest on the list gets 30 minutes to take the spot."
            checked={rules.waitlistAutoPromote}
            disabled={!rules.waitlistsEnabled}
            onCheckedChange={(value) => set('waitlistAutoPromote', value)}
          />
        </CardContent>
        <CardFooter separated className="justify-between gap-3">
          <p className="text-xs text-subtle">{dirty ? 'You have unsaved changes.' : 'Up to date.'}</p>
          <Button size="sm" leftIcon={<Save />} loading={saving} onClick={save} disabled={!dirty}>
            Save
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" aria-hidden="true" />
            Set on each activity
          </CardTitle>
          <CardDescription>
            These differ from one activity to the next, so each activity has its own. Open an activity and edit the step shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
            {ON_EACH_ACTIVITY.map((item) => (
              <li key={item.title} className="flex flex-col gap-0.5 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{item.title}</span>
                  <span className="block text-xs text-muted">{item.text}</span>
                </span>
                <Badge variant="outline" size="sm" className="shrink-0 self-start sm:self-center">
                  {item.where}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/activities">Go to activities</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/marketing/automations">Confirmation, reminder and cart emails</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ToggleRow({
  title,
  body,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  title: string
  body: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  badge?: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5', disabled && 'opacity-50')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="cursor-pointer">
            {title}
          </Label>
          {badge}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  )
}
