'use client'

import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CalendarCheck, Check, Send } from 'lucide-react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { VERTICALS } from '@/lib/data/verticals'
import { EASE_OUT_EXPO, TRANSITION_DEFAULT, TRANSITION_NONE } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   SCHEMA

   `vertical` and `volume` are validated as non-empty strings rather than
   enums: the Select can only ever produce a value from its own option list,
   so an enum would only duplicate that guarantee while making the "nothing
   picked yet" state ("") awkward to express. The message that matters is
   "you have not chosen one", and `min(1)` says exactly that.
   ========================================================================== */

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Tell us who we are talking to.'),
  email: z.email('Use a work email we can reply to.'),
  company: z.string().trim().min(2, 'What is the business called?'),
  vertical: z.string().min(1, 'Pick the closest match — we will tailor the demo.'),
  volume: z.string().min(1, 'A rough band is fine. It sets who joins the call.'),
  message: z
    .string()
    .trim()
    .max(1200, 'Keep it under 1,200 characters — we will ask the rest on the call.'),
})

type FieldName = keyof z.infer<typeof contactSchema>

const EMPTY_VALUES: Record<FieldName, string> = {
  name: '',
  email: '',
  company: '',
  vertical: '',
  volume: '',
  message: '',
}

/* ==========================================================================
   OPTIONS
   ========================================================================== */

const VOLUME_OPTIONS = [
  { value: 'under-50', label: 'Under 50 bookings a month', hint: 'Just getting online' },
  { value: '50-250', label: '50 – 250 bookings a month', hint: 'A busy single location' },
  { value: '250-1000', label: '250 – 1,000 bookings a month', hint: 'Multi-vessel or multi-site' },
  { value: 'over-1000', label: 'More than 1,000 a month', hint: 'Groups, resorts, marketplaces' },
]

/** Deep-link topics used by the CTAs elsewhere on the site. */
const TOPIC_PREFILL: Record<string, string> = {
  migration:
    'We are on another booking platform and want to understand what moving would involve.',
  enterprise:
    'We run multiple locations or brands and need to talk about a custom commission and an SLA.',
  pricing: 'We would like someone to run our real numbers against Starter, Growth and Scale.',
}

export interface ContactFormProps {
  /** `?topic=` from the URL — prefills the message so a deep link means something. */
  topic?: string
  className?: string
}

/* ==========================================================================
   FORM

   Submission resolves locally: there is no public endpoint on the marketing
   site, and a form that silently pretends to POST somewhere is worse than one
   that is honest about being a front end. The validation, focus management,
   busy state and success panel are all real — swap the `submit` body for a
   fetch when the endpoint lands and nothing else here has to change.
   ========================================================================== */

export function ContactForm({ topic, className }: ContactFormProps) {
  const reduceMotion = useReducedMotionSafe()

  const [values, setValues] = useState<Record<FieldName, string>>(() => ({
    ...EMPTY_VALUES,
    message: (topic && TOPIC_PREFILL[topic]) || '',
  }))
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle')
  const formRef = useRef<HTMLFormElement>(null)

  const setValue = (field: FieldName, next: string) => {
    setValues((current) => ({ ...current, [field]: next }))
    // Clear the message the moment the operator starts fixing the field.
    setErrors((current) => {
      if (!current[field]) return current
      const { [field]: _removed, ...rest } = current
      return rest
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return

    const parsed = contactSchema.safeParse(values)

    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string' && !(field in next)) {
          next[field as FieldName] = issue.message
        }
      }
      setErrors(next)

      // Move focus to the first thing that needs fixing.
      const firstInvalid = Object.keys(next)[0]
      if (firstInvalid && formRef.current) {
        const control = formRef.current.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        control?.focus()
      }
      return
    }

    setStatus('submitting')
    await new Promise((resolve) => setTimeout(resolve, 850))
    setStatus('success')
    toast.success('Demo request received', {
      description: 'Someone from the team will reply within one business day.',
    })
  }

  const reset = () => {
    setValues({ ...EMPTY_VALUES, message: (topic && TOPIC_PREFILL[topic]) || '' })
    setErrors({})
    setStatus('idle')
  }

  const enter = reduceMotion ? TRANSITION_NONE : TRANSITION_DEFAULT

  return (
    <div className={cn('relative', className)}>
      <AnimatePresence mode="wait" initial={false}>
        {status === 'success' ? (
          /* ---------------- Success ---------------- */
          <motion.div
            key="success"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={enter}
            className={cn(
              'relative overflow-hidden rounded-3xl border border-line p-7 shadow-lg sm:p-10',
              'bg-[linear-gradient(150deg,color-mix(in_oklab,var(--success)_11%,var(--surface))_0%,var(--surface)_58%,color-mix(in_oklab,var(--primary)_9%,var(--surface))_100%)]',
            )}
          >
            <div role="status" aria-live="polite">
              <motion.span
                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.08, ease: EASE_OUT_EXPO }
                }
                className="relative flex size-14 items-center justify-center rounded-2xl bg-success-soft text-success"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-pulse-ring rounded-2xl bg-success/25"
                />
                <Check className="relative size-7" strokeWidth={2.75} aria-hidden="true" />
              </motion.span>

              <h3 className="mt-6 font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">
                Thanks, {values.name.split(' ')[0] || 'there'} — that is booked in.
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
                Your request is with the team. Someone who has actually migrated operators onto
                EZRA Pro will reply to{' '}
                <span className="font-medium text-foreground">{values.email}</span> within one
                business day, usually a lot sooner.
              </p>
            </div>

            <ol className="mt-7 flex flex-col gap-3 border-t border-line-subtle pt-6">
              {[
                'We read your volume and vertical before we call — no discovery questionnaire.',
                'Twenty minutes on a screen share, with your own numbers in the dashboard.',
                'You leave with a migration date, or an honest "not yet". Both are fine.',
              ].map((line, index) => (
                <li key={line} className="flex items-start gap-3 text-sm leading-relaxed text-muted">
                  <span className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.6875rem] font-bold text-primary tabular">
                    {index + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="md"
                variant="primary"
                rightIcon={<ArrowRight aria-hidden="true" />}
              >
                <Link href="/signup">Start free while you wait</Link>
              </Button>
              <Button type="button" size="md" variant="ghost" onClick={reset}>
                Send another request
              </Button>
            </div>
          </motion.div>
        ) : (
          /* ---------------- Form ---------------- */
          <motion.form
            key="form"
            ref={formRef}
            noValidate
            onSubmit={submit}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.99 }}
            transition={enter}
            className="rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <CalendarCheck className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  Book a 20-minute demo
                </h2>
                <p className="text-sm text-muted">No slide deck. Your numbers, in the product.</p>
              </div>
            </div>

            <FieldGroup className="mt-7">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" required error={errors.name}>
                  <Input
                    name="name"
                    autoComplete="name"
                    placeholder="Kaimana Reyes"
                    value={values.name}
                    error={Boolean(errors.name)}
                    onChange={(event) => setValue('name', event.target.value)}
                  />
                </Field>

                <Field label="Work email" required error={errors.email}>
                  <Input
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@yourcompany.com"
                    value={values.email}
                    error={Boolean(errors.email)}
                    onChange={(event) => setValue('email', event.target.value)}
                  />
                </Field>
              </div>

              <Field label="Company" required error={errors.company}>
                <Input
                  name="company"
                  autoComplete="organization"
                  placeholder="Blue Horizon Watersports"
                  value={values.company}
                  error={Boolean(errors.company)}
                  onChange={(event) => setValue('company', event.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What do you run?" required error={errors.vertical}>
                  {(control) => (
                    <Select
                      value={values.vertical}
                      onValueChange={(next) => setValue('vertical', next)}
                    >
                      <SelectTrigger
                        {...control}
                        name="vertical"
                        error={Boolean(errors.vertical)}
                        aria-label="What do you run?"
                      >
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {VERTICALS.map((vertical) => (
                          <SelectItem
                            key={vertical.key}
                            value={vertical.key}
                            description={vertical.sampleActivities.slice(0, 2).join(' · ')}
                          >
                            {vertical.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field label="Monthly bookings" required error={errors.volume}>
                  {(control) => (
                    <Select
                      value={values.volume}
                      onValueChange={(next) => setValue('volume', next)}
                    >
                      <SelectTrigger
                        {...control}
                        name="volume"
                        error={Boolean(errors.volume)}
                        aria-label="Monthly bookings"
                      >
                        <SelectValue placeholder="Choose a range" />
                      </SelectTrigger>
                      <SelectContent>
                        {VOLUME_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            description={option.hint}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>

              <Field
                label="Anything we should know?"
                optional
                hint={`${values.message.length}/1200`}
                error={errors.message}
                description="The odd pricing rule, the season you are up against, the thing your current platform cannot do."
              >
                <Textarea
                  name="message"
                  rows={4}
                  maxLength={1200}
                  placeholder="We run six catamarans out of Lahaina and our current platform cannot hold capacity per hull…"
                  value={values.message}
                  error={Boolean(errors.message)}
                  onChange={(event) => setValue('message', event.target.value)}
                />
              </Field>
            </FieldGroup>

            <Button
              type="submit"
              size="lg"
              variant="primary"
              fullWidth
              loading={status === 'submitting'}
              rightIcon={<Send aria-hidden="true" />}
              className="mt-7"
            >
              {status === 'submitting' ? 'Sending…' : 'Request my demo'}
            </Button>

            <p className="mt-4 text-center text-xs leading-relaxed text-subtle">
              We reply to every request within one business day. No sequence of seven emails, and
              nothing is shared with anyone.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
