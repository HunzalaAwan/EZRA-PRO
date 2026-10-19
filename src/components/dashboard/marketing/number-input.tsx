'use client'

import * as React from 'react'

import { Input, type InputProps } from '@/components/ui/input'

/**
 * A whole-number box that lets the owner clear it and type a new number.
 * A plain clamped `Number(value) || 1` jumps to the minimum the moment the
 * box is emptied, so typing "25" over "10" ends up as "125". This keeps the
 * typed text while the box has focus, passes on every valid number inside
 * the limits, and settles back to the saved value when the box is left.
 */
export function NumberInput({
  value,
  onValueChange,
  min,
  max,
  onBlur,
  onFocus,
  ...props
}: Omit<InputProps, 'value' | 'onChange' | 'type' | 'min' | 'max'> & {
  value: number
  onValueChange: (value: number) => void
  min: number
  max?: number
}) {
  const [text, setText] = React.useState<string | null>(null)
  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, Math.round(n)))
  return (
    <Input
      {...props}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text ?? String(value)}
      onFocus={(e) => {
        setText(String(value))
        onFocus?.(e)
      }}
      onChange={(e) => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onValueChange(Math.round(n))
      }}
      onBlur={(e) => {
        const n = Number(e.target.value)
        const next = e.target.value.trim() === '' || !Number.isFinite(n) ? value : clamp(n)
        if (next !== value) onValueChange(next)
        setText(null)
        onBlur?.(e)
      }}
    />
  )
}
