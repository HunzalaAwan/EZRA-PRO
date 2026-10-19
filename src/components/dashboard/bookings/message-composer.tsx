'use client'

import * as React from 'react'
import { Mail, MessageSquareText, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { sendStaffMessage } from '@/hooks/use-inbox'
import { manageLink, renderTemplate, type MessageContext, type TemplateKey } from '@/lib/messaging'

/* ==========================================================================
   Message composer — one dialog for writing to booked guests: one guest
   from their booking, everyone on a time from the calendar, or a selection
   from the bookings list. Start from a saved message or write your own;
   the details fill in per guest. Sent messages land in each guest's
   conversation in the Inbox, so replies come back to one place.
   ========================================================================== */

export interface MessageRecipient {
  reference: string
  bookingId?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  activityName: string
  startsAt: string
  meetingPoint: string
  party: number
}

/** The saved messages that make sense to send by hand to someone already booked. */
const PICKABLE: TemplateKey[] = ['confirmation', 'reminder', 'what_to_bring', 'balance_due', 'weather', 'rescheduled', 'cancelled', 'review_request', 'upsell']

const TOKENS = ['first_name', 'activity', 'date', 'time', 'meeting_point', 'party', 'reference', 'manage_link'] as const

export function contextFor(recipient: MessageRecipient, tenantSlug: string, business: string, extra: Partial<MessageContext> = {}): Partial<MessageContext> {
  const at = new Date(recipient.startsAt)
  return {
    first_name: recipient.firstName,
    activity: recipient.activityName,
    date: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(at),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(at),
    meeting_point: recipient.meetingPoint.split(' — ')[0],
    party: `${recipient.party} ${recipient.party === 1 ? 'guest' : 'guests'}`,
    reference: recipient.reference,
    manage_link: manageLink(tenantSlug, recipient.reference),
    book_link: `/book/${tenantSlug}`,
    business,
    ...extra,
  }
}

/** Send a saved message to guests without opening the composer: after a move or a cancellation. */
export function sendToGuests(
  recipients: MessageRecipient[],
  { tenantSlug, business, subject, body, extra }: { tenantSlug: string; business: string; subject: string; body: string; extra?: Partial<MessageContext> },
) {
  for (const recipient of recipients) {
    const context = contextFor(recipient, tenantSlug, business, extra)
    const text = `${renderTemplate(subject, context)}\n\n${renderTemplate(body, context)}`
    sendStaffMessage(
      tenantSlug,
      {
        id: `thr_${recipient.reference}`,
        bookingId: recipient.bookingId,
        reference: recipient.reference,
        guestName: `${recipient.firstName} ${recipient.lastName}`.trim(),
        phone: recipient.phone,
        email: recipient.email,
        activityName: recipient.activityName,
        startsAt: recipient.startsAt,
        channel: 'email',
      },
      text,
      'You',
    )
  }
}

export function MessageComposer({
  open,
  onOpenChange,
  recipients,
  tenantId,
  tenantSlug,
  business,
  initialTemplate,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipients: MessageRecipient[]
  tenantId: string
  tenantSlug: string
  business: string
  initialTemplate?: TemplateKey
  title?: string
}) {
  const { templates } = useMessageTemplates(tenantId)
  const pickable = templates.filter((template) => PICKABLE.includes(template.key))
  const [templateKey, setTemplateKey] = React.useState<string>(initialTemplate ?? 'own')
  const [channel, setChannel] = React.useState<'email' | 'sms' | 'both'>('email')
  const [subject, setSubject] = React.useState('')
  const [body, setBody] = React.useState('')
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)

  const pick = React.useCallback(
    (key: string) => {
      setTemplateKey(key)
      const template = templates.find((entry) => entry.key === key)
      if (!template) {
        setSubject('')
        setBody('Hi {first_name}, ')
        return
      }
      setSubject(template.subject)
      setBody(template.body)
      setChannel(template.channel)
    },
    [templates],
  )

  // Each time it opens, start from the message it was opened for.
  React.useEffect(() => {
    if (open) pick(initialTemplate ?? 'own')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplate])

  const insert = (token: string) => {
    const field = bodyRef.current
    const at = field?.selectionStart ?? body.length
    const next = `${body.slice(0, at)}{${token}}${body.slice(field?.selectionEnd ?? at)}`
    setBody(next)
    window.requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(at + token.length + 2, at + token.length + 2)
    })
  }

  const first = recipients[0]
  const preview = first ? renderTemplate(body, contextFor(first, tenantSlug, business)) : body
  const names = recipients.slice(0, 3).map((recipient) => `${recipient.firstName} ${recipient.lastName}`.trim())
  const smsLong = channel !== 'email' && preview.length > 320

  const send = () => {
    sendToGuests(recipients, { tenantSlug, business, subject: channel === 'sms' ? '' : subject, body })
    onOpenChange(false)
    toast.success(recipients.length === 1 ? `Sent to ${names[0]}` : `Sent to ${recipients.length} guests`, {
      description: `${channel === 'both' ? 'Email and text' : channel === 'sms' ? 'Text' : 'Email'}. Replies come back to the Inbox.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title ?? (recipients.length === 1 ? `Message ${names[0]}` : `Message ${recipients.length} guests`)}</DialogTitle>
          <DialogDescription>
            To {names.join(', ')}
            {recipients.length > 3 ? ` and ${recipients.length - 3} more` : ''}. Each guest gets their own details filled in.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Field label="Start from">
              {({ id }) => (
                <Select value={templateKey} onValueChange={pick}>
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own">Write your own</SelectItem>
                    {pickable.map((template) => (
                      <SelectItem key={template.key} value={template.key} description={template.purpose}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Send as">
              {() => (
                <Segmented
                  label="Send as"
                  value={channel}
                  onValueChange={setChannel}
                  options={[
                    { value: 'email', label: 'Email', icon: Mail },
                    { value: 'sms', label: 'Text', icon: MessageSquareText },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              )}
            </Field>
          </div>
          {channel !== 'sms' ? (
            <Field label="Subject">
              {(control) => <Input {...control} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="About your booking" />}
            </Field>
          ) : null}
          <Field label="Message" description={smsLong ? 'Long for a text: it will arrive as several messages.' : undefined}>
            {(control) => <Textarea {...control} ref={bodyRef} rows={6} value={body} onChange={(event) => setBody(event.target.value)} />}
          </Field>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-subtle">Insert</span>
            {TOKENS.map((token) => (
              <button key={token} type="button" onClick={() => insert(token)} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted hover:border-line-strong hover:text-foreground">
                {`{${token}}`}
              </button>
            ))}
          </div>
          {first ? (
            <div className="rounded-xl bg-surface-sunken px-3.5 py-3">
              <p className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">What {first.firstName} gets</p>
              {channel !== 'sms' && subject ? <p className="mt-1 text-sm font-semibold text-foreground">{renderTemplate(subject, contextFor(first, tenantSlug, business))}</p> : null}
              <p className="mt-1 text-sm whitespace-pre-line text-muted">{preview}</p>
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter divider>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button leftIcon={<Send />} onClick={send} disabled={!body.trim() || recipients.length === 0}>
            {recipients.length === 1 ? 'Send' : `Send to ${recipients.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
