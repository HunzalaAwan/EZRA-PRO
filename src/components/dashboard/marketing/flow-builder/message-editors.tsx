'use client'

import * as React from 'react'
import { Info } from 'lucide-react'

import { EmailContentCard } from '@/components/dashboard/marketing/email-content-card'
import { humanizeTokens, type FlowPlaceholder } from '@/lib/flows/catalog'
import { smsAsSent, smsLength } from '@/lib/flows/check'
import type { EmailStep, SmsStep } from '@/lib/flows/types'
import type { EmailContext, EmailDesign, SavedEmailTemplate } from '@/lib/email-design'
import { fill } from '@/lib/email-design'
import { cn } from '@/lib/utils'

import { DetailText, PanelSection, ToggleRow } from './fields'

/* ==========================================================================
   The two message steps. An email: subject (with an optional second one to
   test), the preview line, the designed email or a simple letter, and the
   plain words. A text: the words, how many parts it goes as, and how it
   lands on a phone.
   ========================================================================== */

/** What the email designer needs, handed down from the builder. */
export interface EmailTools {
  ctx: EmailContext
  brand: string[]
  saved: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
}

export function EmailStepEditor({
  step,
  onChange,
  placeholders,
  tools,
  flowName,
  marketing,
}: {
  step: EmailStep
  onChange: (patch: Partial<EmailStep>) => void
  placeholders: FlowPlaceholder[]
  tools: EmailTools
  flowName: string
  marketing: boolean
}) {
  const testing = step.subjectB !== undefined
  const subjectLength = humanizeTokens(step.subject).length

  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="Subject line">
        <DetailText
          label="Subject"
          value={step.subject}
          onChange={(subject) => onChange({ subject })}
          placeholders={placeholders}
          placeholder="Your trip is coming up"
          invalid={!step.subject.trim()}
          footer={<span className={cn('tabular', subjectLength > 60 && 'text-warning')}>{subjectLength} characters</span>}
          description={subjectLength > 60 ? 'Phones cut long subjects short. Under 50 characters reads best.' : 'Short and specific reads best, like “See you Saturday at 9”.'}
        />
        <ToggleRow
          title="Test a second subject line"
          text="Half your guests get each one. The one that brings more bookings is the one to keep."
          checked={testing}
          onChange={(on) => onChange({ subjectB: on ? (step.subjectB ?? '') : undefined })}
        />
        {testing ? (
          <DetailText label="Second subject" value={step.subjectB ?? ''} onChange={(subjectB) => onChange({ subjectB })} placeholders={placeholders} placeholder="A different way to say it" invalid={!step.subjectB?.trim()} />
        ) : null}
        <DetailText
          label="Preview line"
          value={step.preheader ?? ''}
          onChange={(preheader) => onChange({ preheader })}
          placeholders={placeholders}
          placeholder="Optional"
          description="The short line inboxes show after the subject."
        />
      </PanelSection>

      <PanelSection title="The email" hint={step.design ? 'Designed in the email designer. The words below go to inboxes that do not show designs.' : 'Goes as a simple, friendly letter. Design it to add photos, buttons and your colours.'}>
        <EmailContentCard
          design={step.design}
          onChange={(design) => onChange({ design })}
          ctx={tools.ctx}
          subject={fill(step.subject, tools.ctx.vars)}
          preheader={step.preheader ? fill(step.preheader, tools.ctx.vars) : undefined}
          text={step.body}
          brand={tools.brand}
          saved={tools.saved}
          onSaveTemplate={tools.onSaveTemplate}
          title={`${flowName}: email`}
        />
        <DetailText
          label={step.design ? 'Plain-text version' : 'The letter'}
          multiline
          rows={8}
          value={step.body}
          onChange={(body) => onChange({ body })}
          placeholders={placeholders}
          invalid={!step.body.trim() && !step.design}
        />
        {marketing ? (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            An unsubscribe link goes at the bottom of every marketing email, as the law asks.
          </p>
        ) : null}
      </PanelSection>
    </div>
  )
}

export function SmsStepEditor({
  step,
  onChange,
  placeholders,
  vars,
  marketing,
  hasNumber,
}: {
  step: SmsStep
  onChange: (patch: Partial<SmsStep>) => void
  placeholders: FlowPlaceholder[]
  /** Sample details for the bubble. */
  vars: EmailContext['vars']
  marketing: boolean
  /** The business's own texting number is set up. Without one, texts go from the shared number. */
  hasNumber: boolean
}) {
  const sent = smsAsSent(step.body, marketing)
  const length = smsLength(sent)
  const preview = `${fill(step.body, vars).trim()}${marketing ? ' Reply STOP to opt out.' : ''}`

  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="Text message">
        <DetailText
          label="Message"
          multiline
          rows={5}
          value={step.body}
          onChange={(body) => onChange({ body })}
          placeholders={placeholders}
          invalid={!step.body.trim()}
          footer={
            <span className={cn('tabular', length.segments > 3 ? 'text-danger' : length.segments > 1 ? 'text-warning' : undefined)}>
              {length.chars} characters · {length.segments <= 1 ? '1 text' : `${length.segments} texts`}
            </span>
          }
          description={
            length.encoding === 'unicode'
              ? 'An emoji, curly quote or special letter makes each text hold 70 characters instead of 160.'
              : marketing
                ? 'Counted as sent, with details filled in and the opt-out line added.'
                : 'Counted as sent, with details filled in.'
          }
        />
      </PanelSection>

      <PanelSection title="On their phone">
        <div className="rounded-2xl border border-line bg-surface-sunken/50 p-4">
          <p className="mb-2 text-center text-xs text-subtle">Text message</p>
          <p className="max-w-[18rem] rounded-2xl rounded-bl-md border border-line-subtle bg-surface px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground shadow-xs">
            {preview || 'Nothing written yet'}
          </p>
        </div>
        {marketing ? <p className="text-xs leading-relaxed text-subtle">“Reply STOP to opt out.” is added to every marketing text.</p> : null}
        {!hasNumber ? (
          <p className="text-xs leading-relaxed text-subtle">
            Texts go from EZRA’s shared number until your own texting number is set up in{' '}
            <a href="/dashboard/settings/channels" target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
              Settings → Domains & numbers
            </a>
            .
          </p>
        ) : null}
      </PanelSection>
    </div>
  )
}
