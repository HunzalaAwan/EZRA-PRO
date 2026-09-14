'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   TagInput — customer tags, activity keywords, promo-code audiences.

   Behaviour worth knowing:
   - Enter or any configured separator key commits the draft.
   - Backspace on an empty draft removes the last tag (standard chip-field idiom).
   - Pasting a comma/newline/tab-delimited list commits every entry at once,
     which is how operators actually migrate a tag list off a spreadsheet.
   ========================================================================== */

const tagInputVariants = cva(
  [
    'flex w-full flex-wrap items-center gap-1.5 rounded-xl border bg-surface',
    'transition-[border-color,box-shadow] duration-200 ease-[var(--ease-out-quint)]',
    'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25',
    'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60',
  ],
  {
    variants: {
      size: {
        sm: 'min-h-8 gap-1 px-1.5 py-1 text-xs',
        md: 'min-h-10 px-2 py-1.5 text-sm',
        lg: 'min-h-12 px-2.5 py-2 text-sm',
      },
      invalid: {
        true: 'border-danger focus-within:border-danger focus-within:ring-danger/25',
        false: 'border-line hover:border-line-strong',
      },
    },
    defaultVariants: { size: 'md', invalid: false },
  },
)

export type TagInputVariants = VariantProps<typeof tagInputVariants>

export interface TagInputProps
  extends Omit<
      React.ComponentProps<'input'>,
      'value' | 'defaultValue' | 'onChange' | 'size' | 'type'
    >,
    Omit<TagInputVariants, 'invalid'> {
  value: string[]
  onValueChange: (tags: string[]) => void
  /** Hard cap. The field stops accepting input once reached. */
  max?: number
  allowDuplicates?: boolean
  /** Keys that commit the draft, alongside Enter. */
  separators?: string[]
  /** Return an error message to reject a tag, or `null` to accept it. */
  validate?: (tag: string, tags: string[]) => string | null
  /** Normalises a raw entry before it is validated and stored. */
  transform?: (raw: string) => string
  /** Offered through a native datalist — no extra popover to manage focus for. */
  suggestions?: string[]
  /** Externally supplied error, e.g. from a zod schema on submit. */
  error?: string
  /** Accessible name for the text field. */
  label?: string
  className?: string
  /** Classes for the chip row + input shell. */
  fieldClassName?: string
}

function TagInput({
  value,
  onValueChange,
  max,
  allowDuplicates = false,
  separators = [','],
  validate,
  transform = (raw) => raw.trim(),
  suggestions,
  error,
  label = 'Tags',
  size = 'md',
  placeholder = 'Add a tag…',
  disabled,
  className,
  fieldClassName,
  onKeyDown,
  onPaste,
  onBlur,
  ...props
}: TagInputProps) {
  const [draft, setDraft] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()
  const errorId = React.useId()
  const reduceMotion = useReducedMotion()

  const atCapacity = typeof max === 'number' && value.length >= max
  const message = error ?? localError

  const commit = React.useCallback(
    (raw: string): boolean => {
      const tag = transform(raw)
      if (!tag) return false

      if (atCapacity) {
        setLocalError(`Up to ${max} tags.`)
        return false
      }
      if (!allowDuplicates && value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
        setLocalError(`"${tag}" is already added.`)
        return false
      }

      const validationError = validate?.(tag, value) ?? null
      if (validationError) {
        setLocalError(validationError)
        return false
      }

      setLocalError(null)
      onValueChange([...value, tag])
      return true
    },
    [allowDuplicates, atCapacity, max, onValueChange, transform, validate, value],
  )

  const removeAt = (index: number) => {
    setLocalError(null)
    onValueChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    if (event.key === 'Enter' || separators.includes(event.key)) {
      event.preventDefault()
      if (commit(draft)) setDraft('')
      return
    }

    if (event.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      event.preventDefault()
      removeAt(value.length - 1)
    }
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    onPaste?.(event)
    if (event.defaultPrevented) return

    const text = event.clipboardData.getData('text')
    if (!/[\n\t,;]/.test(text)) return

    event.preventDefault()
    const entries = text.split(/[\n\t,;]+/)
    const next = [...value]
    for (const entry of entries) {
      const tag = transform(entry)
      if (!tag) continue
      if (typeof max === 'number' && next.length >= max) break
      if (!allowDuplicates && next.some((e) => e.toLowerCase() === tag.toLowerCase())) continue
      if (validate?.(tag, next)) continue
      next.push(tag)
    }
    setLocalError(null)
    setDraft('')
    onValueChange(next)
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event)
    // Commit whatever is in flight so a tag is never silently lost on submit.
    if (draft.trim() && commit(draft)) setDraft('')
  }

  const chipTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const }

  return (
    <div data-slot="tag-input" className={cn('flex flex-col gap-1.5', className)}>
      <div
        className={cn(tagInputVariants({ size, invalid: Boolean(message) }), fieldClassName)}
        // Clicking the padding focuses the field, like a native input.
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault()
            inputRef.current?.focus()
          }
        }}
      >
        <ul className="contents" role="list" aria-label={`${label} added`}>
          <AnimatePresence initial={false}>
            {value.map((tag, index) => (
              <motion.li
                key={tag}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
                transition={chipTransition}
                className={cn(
                  'inline-flex max-w-full items-center gap-1 rounded-lg bg-primary-soft/70 pl-2 pr-1 font-medium text-primary',
                  size === 'sm' ? 'h-5 text-[0.6875rem]' : 'h-6 text-xs',
                )}
              >
                <span className="truncate">{tag}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  aria-label={`Remove ${tag}`}
                  className={cn(
                    'grid size-4 shrink-0 place-items-center rounded-[0.25rem] text-primary/70',
                    'transition-colors duration-150 hover:bg-primary/15 hover:text-primary',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    'disabled:pointer-events-none',
                  )}
                >
                  <X aria-hidden="true" className="size-3" strokeWidth={2.5} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value)
            if (localError) setLocalError(null)
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          disabled={disabled || atCapacity}
          placeholder={atCapacity ? `Limit of ${max} reached` : placeholder}
          aria-label={label}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? errorId : undefined}
          // The native `list` binding gives the input implicit combobox semantics.
          list={suggestions && suggestions.length > 0 ? listId : undefined}
          className={cn(
            'min-w-24 flex-1 bg-transparent px-1 text-foreground outline-none',
            'placeholder:text-faint disabled:cursor-not-allowed',
            size === 'sm' ? 'h-5' : 'h-6',
          )}
          {...props}
        />

        {suggestions && suggestions.length > 0 ? (
          <datalist id={listId}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-3">
        <p
          id={errorId}
          role="status"
          aria-live="polite"
          className={cn('text-xs', message ? 'text-danger' : 'sr-only')}
        >
          {message ?? ''}
        </p>
        {typeof max === 'number' ? (
          <span className="shrink-0 text-xs tabular-nums text-faint">
            {value.length}/{max}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export { TagInput, tagInputVariants }
