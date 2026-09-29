'use client'

import * as React from 'react'
import { Copy, Paintbrush, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { EmailDesigner, EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { EMAIL_TEMPLATES, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'
import { formatDateTime } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   EMAIL TEMPLATES
   The business's own email designs, reusable in any automation or campaign,
   and the ready-made designs to start from. Everything opens in the same
   designer.
   ========================================================================== */

export function TemplatesClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, nowIso)
  const ctx = useEmailContext(tenantRecord, data.activities, { first_name: 'Maia', offer_code: 'WELCOME10', offer_percent: '10%', activity: data.activities[0]?.name ?? 'your trip' })
  const brand = React.useMemo(() => brandColors(tenantRecord), [tenantRecord])
  const accent = brand[0] ?? '#601CEF'
  const readyMade = React.useMemo(() => EMAIL_TEMPLATES.map((template) => ({ ...template, design: template.build(ctx, accent) })), [ctx, accent])
  const [editing, setEditing] = React.useState<{ id: string | null; name: string; design: EmailDesign } | null>(null)
  const [renaming, setRenaming] = React.useState<string | null>(null)

  const save = (template: SavedEmailTemplate) => marketing.saveEmailTemplate(template)
  const saveNew = (name: string, design: EmailDesign) => {
    save({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: new Date().toISOString() })
    toast.success(`${name} saved`)
  }

  const thumb = (design: EmailDesign, onOpen: () => void, label: string) => (
    <button type="button" onClick={onOpen} className="block h-56 w-full overflow-hidden border-b border-line-subtle" style={{ background: design.theme.background }} aria-label={`Open ${label}`}>
      <EmailFrame design={design} ctx={ctx} width={600} scale={0.36} height={224} className="mx-auto" />
    </button>
  )

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Your templates</CardTitle>
            <CardDescription>Designs you saved. Pick them in any automation or campaign from the designer&rsquo;s Templates tab.</CardDescription>
          </div>
          <Button leftIcon={<Plus />} onClick={() => setEditing({ id: null, name: 'New template', design: readyMade[1].design })}>New template</Button>
        </CardHeader>
        <CardContent>
          {marketing.emailTemplates.length === 0 ? (
            <p className="text-sm text-subtle">None yet. Open a ready-made design below, make it yours and it is saved here.</p>
          ) : (
            <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {marketing.emailTemplates.map((template) => (
                <li key={template.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                  {thumb(template.design, () => setEditing({ id: template.id, name: template.name, design: template.design }), template.name)}
                  <div className="flex flex-col gap-2 px-3 py-3">
                    {renaming === template.id ? (
                      <Input
                        size="sm"
                        autoFocus
                        defaultValue={template.name}
                        aria-label="Template name"
                        onBlur={(e) => { if (e.target.value.trim()) save({ ...template, name: e.target.value.trim(), updatedAt: new Date().toISOString() }); setRenaming(null) }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    ) : (
                      <button type="button" className="text-left text-sm font-medium text-foreground hover:underline" onClick={() => setRenaming(template.id)} title="Rename">
                        {template.name}
                      </button>
                    )}
                    <p className="text-xs text-subtle">Edited {formatDateTime(template.updatedAt)} · {template.design.blocks.length} blocks</p>
                    <div className="flex gap-1">
                      <Button size="xs" variant="secondary" leftIcon={<Paintbrush />} onClick={() => setEditing({ id: template.id, name: template.name, design: template.design })}>Edit</Button>
                      <Button size="xs" variant="ghost" aria-label={`Copy ${template.name}`} onClick={() => saveNew(`${template.name} (copy)`, template.design)}><Copy className="size-3.5" aria-hidden="true" /></Button>
                      <Button size="xs" variant="ghost" aria-label={`Delete ${template.name}`} onClick={() => { marketing.removeEmailTemplate(template.id); toast('Template deleted') }}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Ready-made designs</CardTitle>
          <CardDescription>Built with your colours and trip photos. Open one to change anything; it is saved to your templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {readyMade.map((template) => (
              <li key={template.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                {thumb(template.design, () => setEditing({ id: null, name: template.name, design: template.design }), template.name)}
                <div className="flex items-center justify-between gap-2 px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{template.name}</p>
                    <p className="text-xs text-subtle">{template.hint}</p>
                  </div>
                  <Button size="xs" variant="secondary" onClick={() => setEditing({ id: null, name: template.name, design: template.design })}>Use</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {editing ? (
        <EmailDesigner
          title={editing.id ? `Template: ${editing.name}` : `New template from ${editing.name}`}
          initial={editing.design}
          ctx={ctx}
          subject={editing.name}
          brand={brand}
          saved={marketing.emailTemplates}
          onSaveTemplate={saveNew}
          onClose={() => setEditing(null)}
          onDone={(design) => {
            if (editing.id) {
              const existing = marketing.emailTemplates.find((entry) => entry.id === editing.id)
              if (existing) save({ ...existing, design, updatedAt: new Date().toISOString() })
              toast.success(`${editing.name} saved`)
            } else {
              saveNew(editing.name === 'New template' ? 'My template' : `My ${editing.name.toLowerCase()}`, design)
            }
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
