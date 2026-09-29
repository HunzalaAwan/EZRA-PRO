'use client'

import * as React from 'react'
import { LayoutTemplate, Paintbrush } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { EmailDesigner, EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { designFromText, type EmailContext, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'

/* ==========================================================================
   The email part of an automation or campaign: a live thumbnail of the
   designed email and the button that opens the designer. Emails without a
   design go out as a simple letter made from the text.
   ========================================================================== */

export function EmailContentCard({
  design,
  onChange,
  ctx,
  subject,
  preheader,
  text,
  brand,
  saved,
  onSaveTemplate,
  title,
  fallback,
}: {
  design?: EmailDesign
  onChange: (design: EmailDesign | undefined) => void
  ctx: EmailContext
  subject: string
  preheader?: string
  /** The plain text, used to start a design when there is none. */
  text: string
  brand: string[]
  saved: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  title?: string
  /** What goes when there is no design; a simple letter from the text if not given. */
  fallback?: EmailDesign
}) {
  const [open, setOpen] = React.useState(false)
  const shown = design ?? fallback ?? designFromText(subject, text, brand[0] ?? '#601CEF')
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row">
      <button type="button" onClick={() => setOpen(true)} className="shrink-0 overflow-hidden rounded-lg border border-line-subtle" style={{ background: shown.theme.background }} aria-label="Open the email designer">
        <EmailFrame design={shown} ctx={ctx} width={600} scale={0.27} height={190} />
      </button>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{design ? 'Designed email' : 'Simple letter'}</p>
          <p className="mt-0.5 text-xs text-subtle">
            {design
              ? `${design.blocks.length} blocks · add photos, buttons, trips and a code in the designer.`
              : 'Goes as a plain, friendly letter made from the text below. Design it to add photos, buttons and your colours.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" leftIcon={<Paintbrush />} onClick={() => setOpen(true)}>
            {design ? 'Edit design' : 'Design this email'}
          </Button>
          {design ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => { onChange(undefined); toast('Back to a simple letter') }}>
              Use plain letter
            </Button>
          ) : (
            <Button type="button" size="sm" variant="ghost" leftIcon={<LayoutTemplate />} onClick={() => setOpen(true)}>
              Pick a template
            </Button>
          )}
        </div>
      </div>
      {open ? (
        <EmailDesigner
          title={title}
          initial={shown}
          ctx={ctx}
          subject={subject}
          preheader={preheader}
          brand={brand}
          saved={saved}
          onSaveTemplate={onSaveTemplate}
          onClose={() => setOpen(false)}
          onDone={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
