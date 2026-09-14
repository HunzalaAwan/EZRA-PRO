'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { KbdGroup } from '@/components/ui/kbd'

/* ==========================================================================
   SearchInput — list filtering, the command-palette trigger, storefront
   activity search.

   Debouncing is done imperatively in the change handler rather than in an
   effect on the draft value. That matters: an effect would also fire when a
   controlled `value` is pushed in from outside, echoing the parent's own
   update back at it.
   ========================================================================== */

const searchFieldVariants = cva(
  [
    'group/search relative flex w-full items-center rounded-xl border border-line bg-surface',
    'transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-quint)]',
    'hover:border-line-strong',
    'focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25',
    'has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 gap-1.5 px-2 text-xs',
        md: 'h-10 gap-2 px-3 text-sm',
        lg: 'h-11 gap-2.5 px-3.5 text-sm',
      },
      tone: {
        /** Sits on a page background. */
        default: '',
        /** Sits inside a toolbar that already has a surface behind it. */
        sunken: 'border-transparent bg-surface-sunken hover:border-line',
      },
    },
    defaultVariants: { size: 'md', tone: 'default' },
  },
)

export type SearchInputVariants = VariantProps<typeof searchFieldVariants>

export interface SearchInputProps
  extends Omit<
      React.ComponentProps<'input'>,
      'onChange' | 'value' | 'defaultValue' | 'size' | 'type'
    >,
    SearchInputVariants {
  /** Controlled text. Omit to run uncontrolled from `defaultValue`. */
  value?: string
  defaultValue?: string
  /** Fired `debounceMs` after typing stops, and immediately on clear/Enter. */
  onValueChange?: (value: string) => void
  /** Set to 0 to emit on every keystroke. */
  debounceMs?: number
  /** Keyboard hint shown while the field is empty, e.g. `['⌘', 'K']`. */
  shortcut?: string[] | false
  /** Swaps the leading icon for a spinner. */
  loading?: boolean
  /** Hides the clear affordance. */
  clearable?: boolean
  onClear?: () => void
  /** Accessible name — required, since the field carries no visible label. */
  label?: string
  /** Classes for the field shell (the input itself takes `className`). */
  fieldClassName?: string
}

function SearchInput({
  value,
  defaultValue = '',
  onValueChange,
  debounceMs = 250,
  shortcut = false,
  loading = false,
  clearable = true,
  onClear,
  label = 'Search',
  size = 'md',
  tone = 'default',
  placeholder = 'Search…',
  disabled,
  className,
  fieldClassName,
  onKeyDown,
  ref,
  ...props
}: SearchInputProps) {
  const [draft, setDraft] = React.useState(value ?? defaultValue)
  const innerRef = React.useRef<HTMLInputElement>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mirror external updates without echoing them back through onValueChange.
  React.useEffect(() => {
    if (value !== undefined) setDraft(value)
  }, [value])

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const emit = React.useCallback(
    (next: string, immediate = false) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (!onValueChange) return
      if (immediate || debounceMs <= 0) {
        onValueChange(next)
        return
      }
      timerRef.current = setTimeout(() => onValueChange(next), debounceMs)
    },
    [debounceMs, onValueChange],
  )

  const clear = () => {
    setDraft('')
    emit('', true)
    onClear?.()
    innerRef.current?.focus()
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    if (event.key === 'Enter') {
      // Flush so submitting never races the debounce timer.
      emit(draft, true)
      return
    }
    if (event.key === 'Escape' && draft.length > 0) {
      event.preventDefault()
      clear()
    }
  }

  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4'
  const showShortcut = Boolean(shortcut) && draft.length === 0 && !loading
  const showClear = clearable && draft.length > 0

  return (
    <div className={cn(searchFieldVariants({ size, tone }), fieldClassName)}>
      {loading ? (
        <LoaderCircle
          aria-hidden="true"
          className={cn(iconSize, 'shrink-0 animate-spin text-primary')}
        />
      ) : (
        <Search
          aria-hidden="true"
          className={cn(
            iconSize,
            'shrink-0 text-faint transition-colors duration-200 group-focus-within/search:text-primary',
          )}
        />
      )}

      <input
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        type="search"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          const next = event.currentTarget.value
          setDraft(next)
          emit(next)
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-foreground outline-none',
          'placeholder:text-faint disabled:cursor-not-allowed',
          // Chrome paints its own clear affordance on type=search; we ship ours.
          '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
          className,
        )}
        {...props}
      />

      {showClear ? (
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          aria-label="Clear search"
          className={cn(
            'grid shrink-0 place-items-center rounded-md text-faint',
            'transition-all duration-200 ease-[var(--ease-out-quint)] active:scale-[0.9]',
            'hover:bg-surface-sunken hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
            size === 'sm' ? 'size-5' : 'size-6',
          )}
        >
          <X aria-hidden="true" className={iconSize} strokeWidth={2.25} />
        </button>
      ) : showShortcut && shortcut ? (
        <KbdGroup
          keys={shortcut}
          size={size === 'lg' ? 'md' : 'sm'}
          aria-hidden="true"
          className="pointer-events-none shrink-0"
        />
      ) : null}
    </div>
  )
}

export { SearchInput, searchFieldVariants }
