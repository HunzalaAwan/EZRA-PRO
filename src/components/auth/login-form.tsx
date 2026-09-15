'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Mail, Sparkles, X } from 'lucide-react'
import { z } from 'zod'

import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SeparatorWithLabel } from '@/components/ui/separator'
import { SocialButtons } from '@/components/auth/social-buttons'

/* ==========================================================================
   SCHEMA
   ========================================================================== */

export const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean(),
})

export type LoginValues = z.infer<typeof loginSchema>

type LoginField = keyof LoginValues

/** First message per field — a control should never stack two complaints. */
function collectErrors(error: z.ZodError<LoginValues>): Partial<Record<LoginField, string>> {
  const result: Partial<Record<LoginField, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in result)) {
      result[key as LoginField] = issue.message
    }
  }
  return result
}

/** The account reviewers land in. Matches the seeded Blue Horizon tenant. */
export const DEMO_CREDENTIALS = {
  email: 'owner@bluehorizon.com',
  password: 'demo1234',
} as const

/* ==========================================================================
   FORM
   ========================================================================== */

export interface LoginFormProps extends Omit<React.ComponentProps<'form'>, 'onSubmit'> {
  /** Where a successful sign-in lands. */
  redirectTo?: string
}

export function LoginForm({ redirectTo = '/dashboard', className, ...props }: LoginFormProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()

  const [values, setValues] = React.useState<LoginValues>({
    email: '',
    password: '',
    remember: true,
  })
  const [errors, setErrors] = React.useState<Partial<Record<LoginField, string>>>({})
  const [rootError, setRootError] = React.useState<string | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [demoVisible, setDemoVisible] = React.useState(true)
  const [autofilled, setAutofilled] = React.useState(false)

  const emailRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  function update<K extends LoginField>(key: K, value: LoginValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    // Clear the complaint the moment the operator acts on it.
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
    setRootError(null)
  }

  async function signIn(candidate: LoginValues) {
    const parsed = loginSchema.safeParse(candidate)

    if (!parsed.success) {
      const next = collectErrors(parsed.error)
      setErrors(next)
      if (next.email) emailRef.current?.focus()
      else if (next.password) passwordRef.current?.focus()
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      // Demo build: no identity service to call, so we stand in for the round
      // trip rather than faking a session the rest of the app would not honour.
      await new Promise((resolve) => setTimeout(resolve, 820))
      router.push(redirectTo)
    } catch {
      setSubmitting(false)
      setRootError('We could not reach the workspace. Check your connection and try again.')
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void signIn(values)
  }

  function handleUseDemo() {
    const demo: LoginValues = { ...DEMO_CREDENTIALS, remember: true }
    setValues(demo)
    setErrors({})
    setAutofilled(true)
    void signIn(demo)
  }

  const transition = reducedMotion ? { duration: 0 } : { duration: DURATION.quick, ease: EASE_OUT_EXPO }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-6', className)}
      {...props}
    >
      {/* ---------- Demo shortcut ---------- */}
      <AnimatePresence initial={false}>
        {demoVisible ? (
          <motion.div
            key="demo-hint"
            initial={reducedMotion ? false : { opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
            transition={transition}
          >
            <div className="relative flex items-start gap-3 rounded-xl border border-primary/25 bg-primary-soft/50 p-3.5 pr-10">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary"
              >
                <Sparkles className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[0.8125rem] font-semibold tracking-[-0.005em] text-foreground">
                  Just here to look around?
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">
                  Open the Blue Horizon Watersports workspace with live demo data — no sign-up,
                  nothing to clean up afterwards.
                </p>

                <Button
                  type="button"
                  size="xs"
                  variant="primary"
                  className="mt-2.5"
                  onClick={handleUseDemo}
                  loading={submitting && autofilled}
                  disabled={submitting}
                  rightIcon={<ArrowRight />}
                >
                  Use demo account
                </Button>
              </div>

              <IconButton
                type="button"
                aria-label="Dismiss the demo account shortcut"
                size="xs"
                variant="ghost"
                className="absolute top-2.5 right-2.5"
                onClick={() => setDemoVisible(false)}
              >
                <X aria-hidden="true" />
              </IconButton>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ---------- Federated sign-in ---------- */}
      <SocialButtons verb="Continue" disabled={submitting} redirectTo={redirectTo} />

      <SeparatorWithLabel label="or with email" />

      {/* ---------- Credentials ---------- */}
      <div className="flex flex-col gap-4">
        <AnimatePresence initial={false}>
          {rootError ? (
            <motion.div
              key="root-error"
              role="alert"
              initial={reducedMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="flex items-start gap-2.5 rounded-lg border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-soft px-3.5 py-3 text-xs leading-relaxed font-medium text-danger"
            >
              <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
              {rootError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Field label="Email" error={errors.email} required>
          {(control) => (
            <Input
              {...control}
              ref={emailRef}
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@yourcompany.com"
              size="lg"
              leftIcon={<Mail />}
              value={values.email}
              disabled={submitting}
              onChange={(event) => update('email', event.target.value)}
            />
          )}
        </Field>

        <Field label="Password" error={errors.password} required>
          {(control) => (
            <div className="relative">
              <Input
                {...control}
                ref={passwordRef}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                size="lg"
                leftIcon={<Lock />}
                className="pr-1"
                inputClassName="pr-10"
                value={values.password}
                disabled={submitting}
                onChange={(event) => update('password', event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className={cn(
                  'absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl',
                  'text-faint transition-colors duration-200 hover:text-foreground',
                  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="login-remember"
              checked={values.remember}
              disabled={submitting}
              onCheckedChange={(checked) => update('remember', checked === true)}
            />
            <Label htmlFor="login-remember" className="cursor-pointer text-muted">
              Keep me signed in
            </Label>
          </div>

          <Link
            href="/forgot-password"
            className="rounded-sm text-[0.8125rem] font-medium text-primary underline-offset-4 transition-colors duration-200 hover:text-primary-hover hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        rightIcon={<ArrowRight />}
      >
        {submitting ? 'Opening your workspace' : 'Sign in'}
      </Button>

      <p className="text-center text-sm text-muted">
        New to EZRA Pro?{' '}
        <Link
          href="/signup"
          className="rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-200 hover:text-primary-hover hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  )
}
