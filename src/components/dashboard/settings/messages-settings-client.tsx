'use client'

import * as React from 'react'
import { Check, Mail, MessageSquareText, Pencil, RotateCcw, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import Link from 'next/link'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { useChannels } from '@/hooks/use-channels'
import { formatPhone, fromAddress, storefrontHost, textingNumber } from '@/lib/channels'
import {
  CHANNEL_LABEL,
  PLACEHOLDERS,
  renderTemplate,
  timingLabel,
  type MessageChannel,
  type MessageContext,
  type MessageTemplate,
} from '@/lib/messaging'
import { cn } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   MESSAGES
   The emails and texts every booking sends on its own. Turn each on or off,
   choose the channel and the moment, and write it with placeholders that
   fill in per guest. The preview uses a real booking.
   ========================================================================== */

export function MessagesSettingsClient({ tenant, sample: seededSample }: { tenant: Tenant; sample: MessageContext }) {
  const { templates, update, reset, hasEdits } = useMessageTemplates(tenant.id)
  const { settings: channels } = useChannels(tenant)
  const host = storefrontHost(channels, tenant.slug)
  // Links in the preview use the storefront's own domain once it is connected.
  const sample = React.useMemo(
    () => ({ ...seededSample, manage_link: String(seededSample.manage_link ?? '').replace(`${tenant.slug}.ezrapro.com`, host) }),
    [seededSample, host, tenant.slug],
  )
  const texting = textingNumber(channels)
  const sendingFrom = [
    {
      icon: Mail,
      label: 'Emails from',
      value: fromAddress(channels, tenant.slug),
      ok: channels.email.status === 'verified',
      todo: 'Using our shared address',
    },
    {
      icon: MessageSquareText,
      label: 'Texts from',
      value: texting ? formatPhone(texting) : 'Our shared number',
      ok: Boolean(texting),
      todo: channels.phone.status === 'verified' ? 'Waiting for US texting registration' : 'No business number yet',
    },
    {
      icon: Check,
      label: 'Links go to',
      value: host,
      ok: channels.storefront.status === 'verified',
      todo: 'Free ezrapro.com address',
    },
  ]
  const [editing, setEditing] = React.useState<MessageTemplate | null>(null)
  const [draft, setDraft] = React.useState<MessageTemplate | null>(null)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)

  const open = (template: MessageTemplate) => {
    setEditing(template)
    setDraft({ ...template })
  }

  const insert = (token: string) => {
    if (!draft) return
    const el = bodyRef.current
    const at = el?.selectionStart ?? draft.body.length
    const next = draft.body.slice(0, at) + token + draft.body.slice(el?.selectionEnd ?? at)
    setDraft({ ...draft, body: next })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  const save = () => {
    if (!draft) return
    update(draft.key, { subject: draft.subject, body: draft.body, channel: draft.channel, timing: draft.timing, enabled: draft.enabled })
    toast.success(`${draft.name} saved`, { description: 'New bookings get the new wording.' })
    setEditing(null)
  }

  const smsLength = draft ? renderTemplate(draft.body, sample).length : 0

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Sending from</CardTitle>
            <CardDescription>The address, number and links every message below uses.</CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/settings/channels">Domains & numbers</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="grid list-none gap-2 p-0 md:grid-cols-3">
            {sendingFrom.map((item) => (
              <li key={item.label} className="rounded-xl border border-line px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-xs text-subtle">
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">{item.value}</p>
                <p className={cn('mt-0.5 text-xs', item.ok ? 'text-success' : 'text-warning')}>{item.ok ? 'Your own' : item.todo}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Messages</CardTitle>
            <CardDescription>
              Emails and texts every booking sends on its own. Each booking&rsquo;s record shows what went and when.
            </CardDescription>
          </div>
          {hasEdits ? (
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { reset(); toast('Default messages restored') }}>
              Restore defaults
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {templates.map((template) => (
              <li key={template.key} className={cn('flex items-start gap-4 px-5 py-4', !template.enabled && 'opacity-60')}>
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle">
                  {template.channel === 'sms' ? <MessageSquareText className="size-[1.125rem]" /> : <Mail className="size-[1.125rem]" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <Badge variant="neutral" size="sm">{CHANNEL_LABEL[template.channel]}</Badge>
                    <span className="text-xs text-subtle">{timingLabel(template.timing)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-subtle">{template.purpose}</p>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{renderTemplate(template.body, sample)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={template.enabled}
                    onCheckedChange={(checked) => { update(template.key, { enabled: checked }); toast(checked ? `${template.name} on` : `${template.name} off`) }}
                    aria-label={`${template.name} on`}
                  />
                  <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => open(template)}>
                    Edit
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Sheet open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <SheetContent side="right" size="lg">
          {draft ? (
            <>
              <SheetHeader>
                <SheetTitle>{draft.name}</SheetTitle>
                <SheetDescription>{draft.purpose}</SheetDescription>
              </SheetHeader>
              <SheetBody className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Channel">
                    <Select value={draft.channel} onValueChange={(value) => setDraft({ ...draft, channel: value as MessageChannel })}>
                      <SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['email', 'sms', 'both'] as MessageChannel[]).map((value) => (
                          <SelectItem key={value} value={value}>{CHANNEL_LABEL[value]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="When">
                    <Select value={draft.timing.when} onValueChange={(value) => setDraft({ ...draft, timing: { ...draft.timing, when: value as MessageTemplate['timing']['when'] } })}>
                      <SelectTrigger aria-label="When"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on_booking">At booking</SelectItem>
                        <SelectItem value="before">Before the start</SelectItem>
                        <SelectItem value="after">After the end</SelectItem>
                        <SelectItem value="manual">Only when staff send it</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {draft.timing.when === 'before' || draft.timing.when === 'after' ? (
                    <Field label="Hours">
                      {(control) => <Input {...control} type="number" min={1} value={draft.timing.hours} onChange={(e) => setDraft({ ...draft, timing: { ...draft.timing, hours: Math.max(1, Number(e.target.value) || 1) } })} />}
                    </Field>
                  ) : null}
                </div>

                {draft.channel !== 'sms' ? (
                  <Field label="Email subject">
                    {(control) => <Input {...control} value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />}
                  </Field>
                ) : null}

                <div>
                  <Field label="Message" description={draft.channel !== 'email' ? `${smsLength} characters · ${Math.max(1, Math.ceil(smsLength / 160))} text ${smsLength > 160 ? 'segments' : 'segment'}` : undefined}>
                    {(control) => <Textarea {...control} ref={bodyRef} rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />}
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((entry) => (
                      <button
                        key={entry.token}
                        type="button"
                        onClick={() => insert(entry.token)}
                        className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-primary/50 hover:text-foreground"
                        title={`Insert ${entry.label}`}
                      >
                        {entry.token}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Preview with a real booking</p>
                  {draft.channel !== 'sms' ? (
                    <div className="rounded-xl border border-line bg-surface">
                      <div className="border-b border-line-subtle px-4 py-2.5 text-xs text-subtle">
                        From {tenant.name} · <span className="font-medium text-foreground">{renderTemplate(draft.subject, sample)}</span>
                      </div>
                      <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-foreground">{renderTemplate(draft.body, sample)}</p>
                    </div>
                  ) : null}
                  {draft.channel !== 'email' ? (
                    <div className="flex">
                      <p className="max-w-[20rem] rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground">
                        {renderTemplate(draft.body, sample)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </SheetBody>
              <SheetFooter>
                <Button variant="ghost" leftIcon={<X />} onClick={() => setEditing(null)}>Cancel</Button>
                <Button leftIcon={<Check />} onClick={save}>Save message</Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
