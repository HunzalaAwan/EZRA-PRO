'use client'

import * as React from 'react'
import { Eraser, FileSignature } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { answerProblem } from '@/lib/guest-requirements'
import { cn } from '@/lib/utils'
import type { GuestQuestion, WaiverTemplate } from '@/types'

/* ==========================================================================
   Checkout — who is coming and the waiver.
   Each guest answers the activity's per-guest questions; booking questions
   are asked once. Answers outside an activity's limits stop the booking with
   the operator's own message. The waiver is signed once for the group, with
   a guardian named when anyone is under age.
   ========================================================================== */

export interface TravellerState {
  firstName: string
  lastName: string
  minor: boolean
  answers: Record<string, string>
}

export interface WaiverState {
  agree: boolean
  signedName: string
  drawn: boolean
  guardianName: string
}

export const EMPTY_WAIVER: WaiverState = { agree: false, signedName: '', drawn: false, guardianName: '' }

export function makeTravellers(count: number): TravellerState[] {
  return Array.from({ length: Math.max(1, count) }, () => ({ firstName: '', lastName: '', minor: false, answers: {} }))
}

type Errors = Record<string, string>

export function validateGuestDetails({
  questions,
  travellers,
  bookingAnswers,
  waiver,
  template,
}: {
  questions: GuestQuestion[]
  travellers: TravellerState[]
  bookingAnswers: Record<string, string>
  waiver: WaiverState
  template?: WaiverTemplate
}): Errors {
  const errors: Errors = {}
  travellers.forEach((traveller, index) => {
    if (index > 0) {
      if (traveller.firstName.trim().length < 1) errors[`t${index}.firstName`] = 'First name'
      if (traveller.lastName.trim().length < 1) errors[`t${index}.lastName`] = 'Last name'
    }
    for (const question of questions.filter((entry) => entry.scope === 'guest')) {
      const problem = answerProblem(question, traveller.answers[question.id])
      if (problem) errors[`t${index}.q.${question.id}`] = problem
    }
  })
  for (const question of questions.filter((entry) => entry.scope === 'booking')) {
    const problem = answerProblem(question, bookingAnswers[question.id])
    if (problem) errors[`b.q.${question.id}`] = problem
  }
  if (template) {
    if (!waiver.agree) errors['waiver.agree'] = 'Tick to confirm you have read the waiver'
    if (waiver.signedName.trim().length < 3) errors['waiver.name'] = 'Type your full name to sign'
    if (!waiver.drawn) errors['waiver.drawn'] = 'Add your signature'
    if (template.minorsNeedGuardian && travellers.some((traveller) => traveller.minor) && waiver.guardianName.trim().length < 3) {
      errors['waiver.guardian'] = 'Name the parent or guardian signing for the minors'
    }
  }
  return errors
}

/* --------------------------------------------------------------------------
   One answer control per question kind
   -------------------------------------------------------------------------- */

function AnswerField({
  question,
  value,
  onChange,
  error,
}: {
  question: GuestQuestion
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const label = question.unit ? `${question.label} (${question.unit})` : question.label
  const options = question.kind === 'yesno' ? ['Yes', 'No'] : (question.options ?? [])
  return (
    <Field label={label} required={question.required} optional={!question.required} error={error} description={question.help}>
      {(control) =>
        question.kind === 'choice' || question.kind === 'size' || question.kind === 'yesno' ? (
          <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : question.kind === 'text' ? (
          <Textarea {...control} rows={2} value={value} onChange={(e) => onChange(e.target.value.slice(0, 300))} />
        ) : (
          <Input
            {...control}
            type={question.kind === 'number' ? 'number' : question.kind === 'date' ? 'date' : 'text'}
            inputMode={question.kind === 'number' ? 'decimal' : undefined}
            min={question.min}
            max={question.max}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Field>
  )
}

/* --------------------------------------------------------------------------
   Who is coming
   -------------------------------------------------------------------------- */

export function GuestDetailsStep({
  questions,
  travellers,
  setTravellers,
  bookingAnswers,
  setBookingAnswers,
  leadName,
  minorAge,
  errors,
}: {
  questions: GuestQuestion[]
  travellers: TravellerState[]
  setTravellers: React.Dispatch<React.SetStateAction<TravellerState[]>>
  bookingAnswers: Record<string, string>
  setBookingAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>
  leadName: string
  minorAge: number
  errors: Errors
}) {
  const guestQs = questions.filter((question) => question.scope === 'guest')
  const bookingQs = questions.filter((question) => question.scope === 'booking')

  const patch = (index: number, change: Partial<TravellerState>) =>
    setTravellers((list) => list.map((traveller, i) => (i === index ? { ...traveller, ...change } : traveller)))
  const answer = (index: number, id: string, value: string) =>
    setTravellers((list) => list.map((traveller, i) => (i === index ? { ...traveller, answers: { ...traveller.answers, [id]: value } } : traveller)))

  return (
    <section aria-labelledby="step-travellers" className="space-y-5">
      <div>
        <h2 id="step-travellers" className="font-display text-xl font-semibold tracking-tight">
          Who is coming?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          The crew uses this to prep gear and keep everyone safe. It takes a minute and saves time at check-in.
        </p>
      </div>

      <ol className="flex list-none flex-col gap-4 p-0">
        {travellers.map((traveller, index) => (
          <li key={index} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                Guest {index + 1}
                {index === 0 ? <span className="font-normal text-subtle"> · {leadName.trim() || 'you'}</span> : null}
              </p>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                <Checkbox checked={traveller.minor} onCheckedChange={(checked) => patch(index, { minor: checked === true })} />
                Under {minorAge}
              </label>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {index > 0 ? (
                <>
                  <Field label="First name" required error={errors[`t${index}.firstName`]}>
                    {(control) => <Input {...control} value={traveller.firstName} onChange={(e) => patch(index, { firstName: e.target.value })} />}
                  </Field>
                  <Field label="Last name" required error={errors[`t${index}.lastName`]}>
                    {(control) => <Input {...control} value={traveller.lastName} onChange={(e) => patch(index, { lastName: e.target.value })} />}
                  </Field>
                </>
              ) : null}
              {guestQs.map((question) => (
                <AnswerField
                  key={question.id}
                  question={question}
                  value={traveller.answers[question.id] ?? ''}
                  onChange={(value) => answer(index, question.id, value)}
                  error={errors[`t${index}.q.${question.id}`]}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>

      {bookingQs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
          <p className="text-sm font-semibold text-foreground sm:col-span-2">For the whole booking</p>
          {bookingQs.map((question) => (
            <AnswerField
              key={question.id}
              question={question}
              value={bookingAnswers[question.id] ?? ''}
              onChange={(value) => setBookingAnswers((current) => ({ ...current, [question.id]: value }))}
              error={errors[`b.q.${question.id}`]}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

/* --------------------------------------------------------------------------
   Waiver
   -------------------------------------------------------------------------- */

function SignaturePad({ onChange, invalid }: { onChange: (drawn: boolean) => void; invalid: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const drawing = React.useRef(false)
  const [hasInk, setHasInk] = React.useState(false)

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    drawing.current = true
    canvasRef.current!.setPointerCapture(event.pointerId)
    const { x, y } = point(event)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = getComputedStyle(canvasRef.current!).color
    ctx.beginPath()
    ctx.moveTo(x, y)
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = point(event)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) {
      setHasInk(true)
      onChange(true)
    }
  }
  const end = () => {
    drawing.current = false
  }
  const clear = () => {
    const canvas = canvasRef.current
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
    onChange(false)
  }

  return (
    <div>
      <div
        aria-invalid={invalid || undefined}
        tabIndex={-1}
        className={cn('relative overflow-hidden rounded-xl border bg-surface', invalid ? 'border-danger' : 'border-line-strong')}
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={160}
          aria-label="Draw your signature"
          className="block h-32 w-full touch-none text-foreground"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasInk ? (
          <span className="pointer-events-none absolute inset-x-4 bottom-6 border-b border-dashed border-line-strong pb-1 text-xs text-faint">
            Sign here with your finger or mouse
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex justify-end">
        <Button type="button" variant="ghost" size="xs" leftIcon={<Eraser />} onClick={clear} disabled={!hasInk}>
          Clear
        </Button>
      </div>
    </div>
  )
}

export function WaiverStep({
  template,
  waiver,
  setWaiver,
  hasMinors,
  errors,
}: {
  template: WaiverTemplate
  waiver: WaiverState
  setWaiver: React.Dispatch<React.SetStateAction<WaiverState>>
  hasMinors: boolean
  errors: Errors
}) {
  return (
    <section aria-labelledby="step-waiver" className="space-y-5">
      <div>
        <h2 id="step-waiver" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <FileSignature className="size-5 text-primary" aria-hidden="true" />
          Sign the waiver
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          One signature covers your whole group. A copy comes with your confirmation.
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface">
        <div className="flex items-baseline justify-between gap-3 border-b border-line-subtle px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{template.title}</p>
          <span className="text-xs text-subtle">Version {template.version}</span>
        </div>
        <div className="max-h-56 space-y-3 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-muted" tabIndex={0} aria-label="Waiver text">
          {template.body.split('\n\n').map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </div>

      <label className={cn('flex items-start gap-3 rounded-xl border px-3.5 py-3', errors['waiver.agree'] ? 'border-danger' : 'border-line')}>
        <Checkbox
          checked={waiver.agree}
          onCheckedChange={(checked) => setWaiver((current) => ({ ...current, agree: checked === true }))}
          aria-invalid={errors['waiver.agree'] ? true : undefined}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground">
          I have read this waiver and agree to it for myself and everyone in my booking.
          {errors['waiver.agree'] ? <span className="mt-1 block text-xs font-medium text-danger">{errors['waiver.agree']}</span> : null}
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={errors['waiver.name']} description="Typed as your signature.">
          {(control) => (
            <Input {...control} value={waiver.signedName} autoComplete="name" onChange={(e) => setWaiver((current) => ({ ...current, signedName: e.target.value }))} />
          )}
        </Field>
        {template.minorsNeedGuardian && hasMinors ? (
          <Field label="Parent or guardian" required error={errors['waiver.guardian']} description={`Signs for the guests under ${template.minorAge}.`}>
            {(control) => (
              <Input {...control} value={waiver.guardianName} onChange={(e) => setWaiver((current) => ({ ...current, guardianName: e.target.value }))} />
            )}
          </Field>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-[0.8125rem] font-medium text-foreground">
          Signature <span className="text-danger">*</span>
        </p>
        <SignaturePad invalid={Boolean(errors['waiver.drawn'])} onChange={(drawn) => setWaiver((current) => ({ ...current, drawn }))} />
        {errors['waiver.drawn'] ? <p className="mt-1 text-xs font-medium text-danger">{errors['waiver.drawn']}</p> : null}
      </div>
    </section>
  )
}
