'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'

import { cn, clamp } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'

/* ==========================================================================
   SCORING — pure, deterministic, testable
   ========================================================================== */

export type PasswordScoreValue = 0 | 1 | 2 | 3 | 4

export type PasswordTone = 'neutral' | 'danger' | 'warning' | 'info' | 'success'

export interface PasswordCheck {
  key: 'length' | 'case' | 'number' | 'symbol'
  label: string
  met: boolean
}

export interface PasswordScore {
  /** 0 = empty, 1 = weak … 4 = excellent. Drives the four segments. */
  score: PasswordScoreValue
  label: string
  /** The single most useful next step, or a compliment once there is nothing left. */
  hint: string
  tone: PasswordTone
  checks: PasswordCheck[]
}

/** Passwords we refuse to call anything but weak, however long they are. */
const BANNED = new Set([
  'password',
  'password1',
  'password123',
  'qwerty',
  'qwerty123',
  '12345678',
  '123456789',
  'letmein',
  'iloveyou',
  'admin123',
  'welcome1',
])

const SCORE_META: Record<PasswordScoreValue, { label: string; tone: PasswordTone }> = {
  0: { label: 'Empty', tone: 'neutral' },
  1: { label: 'Weak', tone: 'danger' },
  2: { label: 'Fair', tone: 'warning' },
  3: { label: 'Strong', tone: 'info' },
  4: { label: 'Excellent', tone: 'success' },
}

/**
 * Scores a password from its length and the character classes it draws on.
 *
 * Deliberately simple and synchronous — no dictionary download, no entropy
 * library. It exists to coach, not to gate: the eight-character minimum is
 * what the sign-up schema actually enforces.
 */
export function scorePassword(password: string): PasswordScore {
  const value = password ?? ''
  const checks: PasswordCheck[] = [
    { key: 'length', label: 'At least 8 characters', met: value.length >= 8 },
    {
      key: 'case',
      label: 'Upper and lower case',
      met: /[a-z]/.test(value) && /[A-Z]/.test(value),
    },
    { key: 'number', label: 'A number', met: /\d/.test(value) },
    { key: 'symbol', label: 'A symbol', met: /[^A-Za-z0-9]/.test(value) },
  ]

  if (value.length === 0) {
    return {
      score: 0,
      label: SCORE_META[0].label,
      tone: SCORE_META[0].tone,
      hint: 'Eight characters minimum — a short phrase beats a clever word.',
      checks,
    }
  }

  const normalised = value.toLowerCase()
  const repeatedOnly = /^(.)\1*$/.test(value)
  const sequential = /^(?:0123|1234|2345|abcd|abcdef|qwer|asdf)/.test(normalised)

  let points = 0
  if (value.length >= 8) points += 1
  if (value.length >= 12) points += 1
  if (value.length >= 16) points += 1
  if (checks[1].met) points += 1
  if (checks[2].met) points += 1
  if (checks[3].met) points += 1

  let score: PasswordScoreValue
  if (points <= 1) score = 1
  else if (points <= 3) score = 2
  else if (points <= 4) score = 3
  else score = 4

  // A guessable password is weak no matter how many classes it ticks.
  if (BANNED.has(normalised) || repeatedOnly || sequential || value.length < 8) {
    score = 1
  }

  const firstUnmet = checks.find((check) => !check.met)
  const hint =
    score === 1 && (BANNED.has(normalised) || repeatedOnly || sequential)
      ? 'That pattern is on every cracking list. Try something unrelated to you.'
      : firstUnmet
        ? `Add ${firstUnmet.label.replace(/^A(?:t least)? /, '').toLowerCase()} to strengthen it.`
        : value.length >= 16
          ? 'Excellent — this would take centuries to brute force.'
          : 'Solid. Every extra character multiplies the work to crack it.'

  return { score, label: SCORE_META[score].label, tone: SCORE_META[score].tone, hint, checks }
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

const TONE_FILL: Record<PasswordTone, string> = {
  neutral: 'bg-line-strong',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  success: 'bg-success',
}

const TONE_TEXT: Record<PasswordTone, string> = {
  neutral: 'text-faint',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  success: 'text-success',
}

const SEGMENTS = [0, 1, 2, 3] as const

export interface PasswordStrengthProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  /** The live password value. */
  value: string
  /** Render the four-item requirement list under the meter. */
  showChecklist?: boolean
  /** Keep the meter mounted (but muted) while the field is empty. */
  showWhenEmpty?: boolean
  /** Wired to the password input via aria-describedby by the calling `<Field>`. */
  id?: string
}

/**
 * Four-segment strength meter. Segments fill left to right on a spring-free
 * expo curve; the label and hint below give the reason, because a colour bar on
 * its own tells a colour-blind user nothing.
 */
export function PasswordStrength({
  value,
  showChecklist = true,
  showWhenEmpty = false,
  className,
  id,
  ...props
}: PasswordStrengthProps) {
  const reducedMotion = useReducedMotionSafe()
  const result = React.useMemo(() => scorePassword(value), [value])
  const isEmpty = value.length === 0

  if (isEmpty && !showWhenEmpty) return null

  const filled = clamp(result.score, 0, 4)

  return (
    <div
      data-slot="password-strength"
      id={id}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {SEGMENTS.map((index) => {
            const active = index < filled
            return (
              <span
                key={index}
                className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
              >
                <motion.span
                  className={cn(
                    'absolute inset-0 origin-left rounded-full',
                    TONE_FILL[active ? result.tone : 'neutral'],
                  )}
                  initial={false}
                  animate={{ scaleX: active ? 1 : 0, opacity: active ? 1 : 0 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { duration: DURATION.quick, delay: active ? index * 0.045 : 0, ease: EASE_OUT_EXPO }
                  }
                />
              </span>
            )
          })}
        </div>

        <span
          className={cn(
            'shrink-0 text-xs font-semibold tracking-[-0.005em] tabular',
            TONE_TEXT[result.tone],
          )}
        >
          {result.label}
        </span>
      </div>

      {/* The meter itself is decorative; this line is what assistive tech reads. */}
      <p role="status" aria-live="polite" className="text-xs leading-relaxed text-muted">
        <span className="sr-only">Password strength: {result.label}. </span>
        {result.hint}
      </p>

      {showChecklist ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          {result.checks.map((check) => (
            <li
              key={check.key}
              className={cn(
                'flex items-center gap-1.5 text-[0.6875rem] font-medium transition-colors duration-200',
                check.met ? 'text-success' : 'text-faint',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-3.5 items-center justify-center rounded-full border transition-all duration-200 ease-[var(--ease-spring)]',
                  check.met
                    ? 'border-success bg-success-soft'
                    : 'border-line-strong bg-transparent',
                )}
              >
                <Check
                  className={cn(
                    'size-2.5 transition-transform duration-200 ease-[var(--ease-spring)]',
                    check.met ? 'scale-100' : 'scale-0',
                  )}
                  strokeWidth={3.5}
                />
              </span>
              {check.label}
              <span className="sr-only">{check.met ? ' — met' : ' — not met yet'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
