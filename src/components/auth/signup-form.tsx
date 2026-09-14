'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowRight,
  Building2,
  CircleAlert,
  Compass,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Mountain,
  Sparkles,
  TreePalm,
  User,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
} from 'lucide-react'
import { z } from 'zod'

import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { VERTICALS } from '@/lib/data/verticals'
import type { VerticalKey } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { SeparatorWithLabel } from '@/components/ui/separator'
import { PasswordStrength } from '@/components/auth/password-strength'
import { SocialButtons } from '@/components/auth/social-buttons'

/* ==========================================================================
   VERTICAL ICONS
   `Vertical.icon` holds a lucide export name so the data module stays
   server-safe; this map is where it becomes a component.
   ========================================================================== */

const VERTICAL_ICONS: Record<string, LucideIcon> = {
  Waves,
  Compass,
  UtensilsCrossed,
  Mountain,
  Palmtree: TreePalm,
  Sparkles,
}

/* ==========================================================================
   SCHEMA
   ========================================================================== */

const VERTICAL_KEYS: VerticalKey[] = VERTICALS.map((vertical) => vertical.key)

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name'),
  email: z.email('Enter a valid work email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
  businessName: z.string().trim().min(2, 'Enter the name guests will recognise'),
  vertical: z.enum(VERTICAL_KEYS, 'Choose the option closest to what you run'),
  terms: z.boolean().refine((accepted) => accepted, 'Accept the terms to create an account'),
})

export type SignupValues = z.infer<typeof signupSchema>

type SignupField = keyof SignupValues

interface SignupDraft {
  name: string
  email: string
  password: string
  businessName: string
  vertical: VerticalKey | ''
  terms: boolean
}

function collectErrors(error: z.ZodError<SignupValues>): Partial<Record<SignupField, string>> {
  const result: Partial<Record<SignupField, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in result)) {
      result[key as SignupField] = issue.message
    }
  }
  return result
}

/**
 * Handed to the onboarding wizard so step one arrives already filled in.
 * Paired with the same key in `onboarding-wizard.tsx`.
 */
const SEED_STORAGE_KEY = 'ezra:onboarding:seed:v1'

/** Consumer domains get a nudge, never a block — plenty of operators use them. */
const CONSUMER_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com']

/* ==========================================================================
   FORM
   ========================================================================== */

export interface SignupFormProps extends Omit<React.ComponentProps<'form'>, 'onSubmit'> {
  /** Where a completed sign-up continues to. */
  redirectTo?: string
}

export function SignupForm({ redirectTo = '/onboarding', className, ...props }: SignupFormProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()

  const [values, setValues] = React.useState<SignupDraft>({
    name: '',
    email: '',
    password: '',
    businessName: '',
    vertical: '',
    terms: false,
  })
  const [errors, setErrors] = React.useState<Partial<Record<SignupField, string>>>({})
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const nameRef = React.useRef<HTMLInputElement>(null)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)
  const businessNameRef = React.useRef<HTMLInputElement>(null)
  const verticalRef = React.useRef<HTMLFieldSetElement>(null)
  const termsRef = React.useRef<HTMLButtonElement>(null)

  function update<K extends keyof SignupDraft>(key: K, value: SignupDraft[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key as SignupField] ? { ...current, [key]: undefined } : current))
  }

  function focusFirstInvalid(next: Partial<Record<SignupField, string>>) {
    if (next.name) nameRef.current?.focus()
    else if (next.email) emailRef.current?.focus()
    else if (next.password) passwordRef.current?.focus()
    else if (next.businessName) businessNameRef.current?.focus()
    else if (next.vertical) verticalRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus()
    else if (next.terms) termsRef.current?.focus()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsed = signupSchema.safeParse(values)
    if (!parsed.success) {
      const next = collectErrors(parsed.error)
      setErrors(next)
      focusFirstInvalid(next)
      return
    }

    setErrors({})
    setSubmitting(true)

    // Hand the wizard everything we already know, so the operator is not asked
    // for their business name twice in the space of thirty seconds.
    try {
      window.sessionStorage.setItem(
        SEED_STORAGE_KEY,
        JSON.stringify({
          ownerName: parsed.data.name,
          ownerEmail: parsed.data.email,
          businessName: parsed.data.businessName,
          vertical: parsed.data.vertical,
        }),
      )
    } catch {
      // Private browsing or a full quota — the wizard simply starts empty.
    }

    await new Promise((resolve) => setTimeout(resolve, 780))
    router.push(redirectTo)
  }

  const emailDomain = values.email.split('@')[1]?.toLowerCase() ?? ''
  const consumerEmail = CONSUMER_DOMAINS.includes(emailDomain)
  const transition = reducedMotion ? { duration: 0 } : { duration: DURATION.quick, ease: EASE_OUT_EXPO }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-6', className)}
      {...props}
    >
      <SocialButtons layout="grid" verb="Sign up" disabled={submitting} redirectTo={redirectTo} />

      <SeparatorWithLabel label="or with email" />

      <div className="flex flex-col gap-4">
        <Field label="Full name" error={errors.name} required>
          {(control) => (
            <Input
              {...control}
              ref={nameRef}
              name="name"
              autoComplete="name"
              placeholder="Kaimana Reyes"
              size="lg"
              leftIcon={<User />}
              value={values.name}
              disabled={submitting}
              onChange={(event) => update('name', event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Work email"
          error={errors.email}
          required
          description={
            consumerEmail && !errors.email
              ? 'A business address gets your team invited faster, but this works too.'
              : undefined
          }
        >
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

        <div className="flex flex-col gap-2.5">
          <Field label="Password" error={errors.password} required>
            {(control) => (
              <div className="relative">
                <Input
                  {...control}
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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

          <AnimatePresence initial={false}>
            {values.password.length > 0 ? (
              <motion.div
                key="strength"
                initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={transition}
              >
                <PasswordStrength value={values.password} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <Field label="Business name" error={errors.businessName} required>
          {(control) => (
            <Input
              {...control}
              ref={businessNameRef}
              name="businessName"
              autoComplete="organization"
              placeholder="Blue Horizon Watersports"
              size="lg"
              leftIcon={<Building2 />}
              value={values.businessName}
              disabled={submitting}
              onChange={(event) => update('businessName', event.target.value)}
            />
          )}
        </Field>
      </div>

      {/* ---------- Vertical ---------- */}
      <fieldset className="min-w-0" ref={verticalRef}>
        <legend className="text-[0.8125rem] leading-none font-medium tracking-[-0.005em] text-foreground">
          What do you run?
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
          <span className="sr-only">(required)</span>
        </legend>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Pick the closest match. It sets your starting templates — you can change it any time.
        </p>

        <RadioGroup
          className="mt-3 grid-cols-1 gap-2.5 sm:grid-cols-2"
          value={values.vertical}
          disabled={submitting}
          aria-invalid={errors.vertical ? true : undefined}
          onValueChange={(value) => update('vertical', value as VerticalKey)}
        >
          {VERTICALS.map((vertical) => {
            const Icon = VERTICAL_ICONS[vertical.icon] ?? Sparkles
            return (
              <RadioGroupCard
                key={vertical.key}
                value={vertical.key}
                label={vertical.label}
                description={vertical.sampleActivities[0]}
                icon={<Icon aria-hidden="true" />}
                className="p-3.5"
              />
            )
          })}
        </RadioGroup>

        {errors.vertical ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed font-medium text-danger animate-in-up">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errors.vertical}
          </p>
        ) : null}
      </fieldset>

      {/* ---------- Terms ---------- */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          <Checkbox
            ref={termsRef}
            id="signup-terms"
            className="mt-0.5"
            checked={values.terms}
            disabled={submitting}
            aria-invalid={errors.terms ? true : undefined}
            onCheckedChange={(checked) => update('terms', checked === true)}
          />
          <Label
            htmlFor="signup-terms"
            className="cursor-pointer items-start text-xs leading-relaxed font-normal text-muted"
          >
            <span>
              I agree to the{' '}
              <Link
                href="/legal/terms"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/legal/privacy"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </Label>
        </div>

        {errors.terms ? (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed font-medium text-danger animate-in-up">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errors.terms}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" fullWidth loading={submitting} rightIcon={<ArrowRight />}>
          {submitting ? 'Creating your workspace' : 'Create account'}
        </Button>
        <p className="text-center text-xs text-faint">
          Free for 14 days · No card required · Cancel any time
        </p>
      </div>

      <p className="text-center text-sm text-muted">
        Already using EZRA Pro?{' '}
        <Link
          href="/login"
          className="rounded-sm font-medium text-primary underline-offset-4 transition-colors duration-200 hover:text-primary-hover hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}
