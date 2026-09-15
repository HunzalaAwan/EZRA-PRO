'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, CircleAlert, Mail, MailCheck, RotateCw, Send } from 'lucide-react'
import { z } from 'zod'

import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO, EASE_SPRING } from '@/lib/motion'
import { SITE } from '@/lib/site-config'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

/* ==========================================================================
   SCHEMA
   ========================================================================== */

export const forgotPasswordSchema = z.object({
  email: z.email('Enter the email address on your EZRA Pro account'),
})

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

/** Seconds before the operator can ask for another link. */
const RESEND_SECONDS = 30

/* ==========================================================================
   FORM
   ========================================================================== */

export interface ForgotPasswordFormProps extends Omit<React.ComponentProps<'div'>, 'onSubmit'> {
  /** Where the "back" affordance returns to. */
  signInHref?: string
}

/**
 * Request a reset link, then hand the screen over to a confirmation panel.
 *
 * The two states swap through `AnimatePresence mode="wait"`, so the form
 * clears out before the confirmation arrives rather than cross-fading into a
 * pile of overlapping text.
 */
export function ForgotPasswordForm({
  signInHref = '/login',
  className,
  ...props
}: ForgotPasswordFormProps) {
  const reducedMotion = useReducedMotionSafe()

  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [cooldown, setCooldown] = React.useState(0)
  const [resending, setResending] = React.useState(false)

  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a valid email address')
      inputRef.current?.focus()
      return
    }

    setError(null)
    setSubmitting(true)

    // Demo build: nothing is dispatched. The delay exists so the state change
    // reads as a request rather than a toggle.
    await new Promise((resolve) => setTimeout(resolve, 780))

    setSubmitting(false)
    setSentTo(parsed.data.email)
    setCooldown(RESEND_SECONDS)
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return
    setResending(true)
    await new Promise((resolve) => setTimeout(resolve, 620))
    setResending(false)
    setCooldown(RESEND_SECONDS)
  }

  function handleUseAnotherEmail() {
    setSentTo(null)
    setCooldown(0)
    // Focus lands back on the field once the form has re-mounted.
    window.setTimeout(() => inputRef.current?.focus(), 60)
  }

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: DURATION.base, ease: EASE_OUT_EXPO }

  return (
    <div className={cn('min-w-0', className)} {...props}>
      <AnimatePresence mode="wait" initial={false}>
        {sentTo === null ? (
          <motion.div
            key="request"
            initial={reducedMotion ? false : { opacity: 0, y: 10, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(5px)' }}
            transition={transition}
          >
            <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
              <Field
                label="Email"
                error={error ?? undefined}
                required
                description="We'll send a link that stays valid for one hour."
              >
                {(control) => (
                  <Input
                    {...control}
                    ref={inputRef}
                    type="email"
                    name="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@yourcompany.com"
                    size="lg"
                    leftIcon={<Mail />}
                    value={email}
                    disabled={submitting}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (error) setError(null)
                    }}
                  />
                )}
              </Field>

              <Button type="submit" size="lg" fullWidth loading={submitting} rightIcon={<Send />}>
                {submitting ? 'Sending link' : 'Send reset link'}
              </Button>

              <Link
                href={signInHref}
                className="mx-auto inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted transition-colors duration-200 hover:text-foreground"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Back to sign in
              </Link>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="sent"
            initial={reducedMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={transition}
            className="flex flex-col gap-6"
          >
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 text-center shadow-sm">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-primary-soft/40"
              />

              <motion.span
                aria-hidden="true"
                initial={reducedMotion ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reducedMotion ? { duration: 0 } : { duration: DURATION.slow, ease: EASE_SPRING, delay: 0.08 }
                }
                className="relative mx-auto flex size-14 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft text-success"
              >
                <MailCheck className="size-6" />
                {!reducedMotion ? (
                  <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-success/40" />
                ) : null}
              </motion.span>

              <p role="status" aria-live="polite" className="sr-only">
                {`Reset link sent to ${sentTo}.`}
              </p>

              <h2 className="relative mt-5 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
                Check your inbox
              </h2>

              <p className="relative mx-auto mt-2 max-w-xs text-sm leading-relaxed text-pretty text-muted">
                If an EZRA Pro account uses{' '}
                <span className="font-medium text-foreground">{sentTo}</span>, a reset link is on
                its way. It expires in one hour.
              </p>

              <div className="relative mt-6 flex flex-col items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={resending}
                  disabled={cooldown > 0}
                  onClick={() => void handleResend()}
                  leftIcon={<RotateCw />}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the link'}
                </Button>

                <button
                  type="button"
                  onClick={handleUseAnotherEmail}
                  className="rounded-sm text-xs font-medium text-primary underline-offset-4 transition-colors duration-200 hover:text-primary-hover hover:underline"
                >
                  Use a different email address
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-line-subtle bg-surface-sunken px-3.5 py-3">
              <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0 text-faint" />
              <p className="text-xs leading-relaxed text-muted">
                Nothing after a couple of minutes? Check spam, then confirm your team has not moved
                you to a different address. Our team can help at{' '}
                <a
                  href={`mailto:${SITE.supportEmail}`}
                  className="rounded-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {SITE.supportEmail}
                </a>
                .
              </p>
            </div>

            <Link
              href={signInHref}
              className="mx-auto inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted transition-colors duration-200 hover:text-foreground"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to sign in
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
