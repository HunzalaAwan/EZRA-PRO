'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, FileSignature, ListChecks, Pencil, Plus, RotateCcw, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useWaivers, type WaiverInput } from '@/hooks/use-waivers'
import { PRESET_ORDER, QUESTION_KIND_LABEL, QUESTION_PRESETS } from '@/lib/guest-requirements'
import { formatDateLong, pluralize } from '@/lib/utils'
import type { Tenant, WaiverTemplate } from '@/types'

/* ==========================================================================
   WAIVERS & FORMS
   The waivers guests sign at checkout, versioned so every signature says
   which text was agreed to, and the question library activities pick from.
   ========================================================================== */

export interface WaiversSettingsClientProps {
  tenant: Tenant
  seeded: WaiverTemplate[]
  /** Activity names per waiver id. */
  usage: Record<string, string[]>
}

const BLANK: WaiverInput = { title: '', body: '', minorsNeedGuardian: true, minorAge: 18 }

export function WaiversSettingsClient({ tenant, seeded, usage }: WaiversSettingsClientProps) {
  const { waivers, save, add, reset, hasEdits } = useWaivers(tenant.id, seeded)
  const [editing, setEditing] = React.useState<string | 'new' | null>(null)
  const [form, setForm] = React.useState<WaiverInput>(BLANK)
  const [errors, setErrors] = React.useState<Partial<Record<keyof WaiverInput, string>>>({})

  const open = (waiver: WaiverTemplate | null) => {
    setEditing(waiver ? waiver.id : 'new')
    setForm(waiver ? { title: waiver.title, body: waiver.body, minorsNeedGuardian: waiver.minorsNeedGuardian, minorAge: waiver.minorAge } : BLANK)
    setErrors({})
  }

  const submit = () => {
    const found: typeof errors = {}
    if (form.title.trim().length < 3) found.title = 'Give the waiver a title guests will recognise.'
    if (form.body.trim().length < 40) found.body = 'The waiver text is too short to protect you.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    const clean = { ...form, title: form.title.trim(), body: form.body.trim() }
    if (editing === 'new') {
      const created = add(clean)
      toast.success(`${created.title} added`, { description: 'Pick it on an activity in the Description step.' })
    } else if (editing) {
      save(editing, clean)
      const current = waivers.find((waiver) => waiver.id === editing)
      toast.success('Waiver saved', { description: `Now version ${(current?.version ?? 0) + 1}. New signatures use this text.` })
    }
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Waivers</CardTitle>
            <CardDescription>
              Guests sign the activity&rsquo;s waiver at checkout, one signature for the group, with a guardian for anyone under age. Editing a waiver saves a new version.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasEdits ? (
              <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { reset(); toast('Seeded waivers restored') }}>
                Restore
              </Button>
            ) : null}
            <Button size="sm" leftIcon={<Plus />} onClick={() => open(null)}>
              New waiver
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {waivers.map((waiver) => {
              const used = usage[waiver.id] ?? []
              return (
                <li key={waiver.id} className="flex items-start gap-4 px-5 py-4">
                  <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <FileSignature className="size-[1.125rem]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{waiver.title}</p>
                    <p className="mt-0.5 text-xs text-subtle">
                      Version {waiver.version} · updated {formatDateLong(new Date(waiver.updatedAt))}
                      {waiver.minorsNeedGuardian ? ` · guardian signs for under ${waiver.minorAge}s` : ''}
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-sm text-muted">{waiver.body.split('\n\n')[0]}</p>
                    <p className="mt-1.5 text-xs text-subtle">
                      {used.length > 0
                        ? `${used.length} ${pluralize(used.length, 'activity', 'activities')}: ${used.slice(0, 4).join(', ')}${used.length > 4 ? '…' : ''}`
                        : 'Not on any activity yet'}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => open(waiver)}>
                    Edit
                  </Button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" aria-hidden="true" />
            Question library
          </CardTitle>
          <CardDescription>
            Ready-made questions for the Description step of any activity. Sizes feed the gear prep list on the manifest; limits stop a booking that would not be safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="grid list-none gap-px bg-line-subtle p-0 sm:grid-cols-2">
            {PRESET_ORDER.map((key) => {
              const preset = QUESTION_PRESETS[key]
              const detail =
                preset.kind === 'number'
                  ? `${preset.min ?? 0}–${preset.max ?? '…'} ${preset.unit ?? ''}`
                  : preset.options
                    ? preset.options.slice(0, 4).join(', ') + (preset.options.length > 4 ? '…' : '')
                    : preset.allowed
                      ? `Must be ${preset.allowed.join(' or ')}`
                      : 'Free text'
              return (
                <li key={key} className="bg-surface px-5 py-3.5">
                  <p className="text-sm font-medium text-foreground">{preset.label}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {QUESTION_KIND_LABEL[preset.kind]} · {preset.scope === 'guest' ? 'each guest' : 'once per booking'}
                    {preset.gear ? ' · gear list' : ''} · {detail}
                  </p>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-line-subtle px-5 py-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/activities">Add questions to an activity</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent size="lg">
          <DialogHeader divider>
            <DialogTitle>{editing === 'new' ? 'New waiver' : `Edit ${form.title || 'waiver'}`}</DialogTitle>
            <DialogDescription>Guests read this in full before they sign. Plain language holds up better than legalese.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            <Field label="Title" required error={errors.title}>
              {(control) => <Input {...control} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Release and assumption of risk" />}
            </Field>
            <Field label="Waiver text" required error={errors.body} description="Leave a blank line between paragraphs.">
              {(control) => <Textarea {...control} rows={12} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-end">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
                <span>
                  <span className="block text-sm font-medium">A guardian signs for minors</span>
                  <span className="block text-xs text-subtle">Checkout asks for the guardian&rsquo;s name when a guest is under age.</span>
                </span>
                <Switch checked={form.minorsNeedGuardian} onCheckedChange={(checked) => setForm((f) => ({ ...f, minorsNeedGuardian: checked }))} aria-label="A guardian signs for minors" />
              </label>
              <Field label="Minors are under">
                {(control) => <Input {...control} type="number" min={12} max={21} value={form.minorAge} onChange={(e) => setForm((f) => ({ ...f, minorAge: Math.max(12, Math.min(21, Number(e.target.value) || 18)) }))} />}
              </Field>
            </div>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" leftIcon={<Check />} onClick={submit}>
              {editing === 'new' ? 'Add waiver' : 'Save new version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
