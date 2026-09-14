'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Label, type LabelSize } from '@/components/ui/label'

/** The attributes `<Field>` injects into whatever control it wraps. */
export interface FieldControlProps {
  id: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
}

export type FieldChildren = React.ReactNode | ((control: FieldControlProps) => React.ReactNode)

export const fieldVariants = cva('group/field min-w-0', {
  variants: {
    orientation: {
      /** Label above the control — the default for every form in the product. */
      vertical: 'flex flex-col gap-1.5',
      /** Label in a left column — settings screens and dense inspector panels. */
      horizontal:
        'grid gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:items-start',
    },
  },
  defaultVariants: { orientation: 'vertical' },
})

export interface FieldProps
  extends Omit<React.ComponentProps<'div'>, 'children'>,
    VariantProps<typeof fieldVariants> {
  label?: React.ReactNode
  /** Helper text shown under the label; wired via aria-describedby. */
  description?: React.ReactNode
  /** Truthy switches the field to its invalid state; a string is rendered as the message. */
  error?: boolean | string
  /** Quiet note pinned to the right of the label — character count, format hint. */
  hint?: React.ReactNode
  required?: boolean
  optional?: boolean
  disabled?: boolean
  labelSize?: LabelSize
  labelClassName?: string
  /** The control. A single element is auto-wired; a render prop gets the ids instead. */
  children: FieldChildren
  /** Force a specific control id (otherwise derived from React's useId). */
  htmlFor?: string
}

/**
 * Form row used across the dashboard, settings and the booking checkout.
 *
 * `<Field label="Email" description="..." error="..." required><Input /></Field>`
 *
 * The control's `id`, `aria-describedby`, `aria-invalid` and `aria-required` are
 * injected automatically, so the accessible wiring cannot drift from the markup.
 */
export function Field({
  className,
  labelClassName,
  orientation,
  label,
  description,
  error,
  hint,
  required = false,
  optional = false,
  disabled = false,
  labelSize,
  htmlFor,
  children,
  ...props
}: FieldProps) {
  const reactId = React.useId()
  const controlId = htmlFor ?? `${reactId}-control`
  const descriptionId = `${reactId}-description`
  const errorId = `${reactId}-error`

  const invalid = error !== undefined && error !== false
  const errorMessage = typeof error === 'string' ? error : null

  const describedBy =
    [description ? descriptionId : null, errorMessage ? errorId : null]
      .filter(Boolean)
      .join(' ') || undefined

  const control: FieldControlProps = {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
    'aria-required': required || undefined,
  }

  let rendered: React.ReactNode
  if (typeof children === 'function') {
    rendered = children(control)
  } else if (React.isValidElement<FieldControlProps>(children)) {
    // Merge rather than overwrite: a caller-supplied id or describedby wins/extends.
    const childProps = children.props
    const mergedDescribedBy =
      [childProps['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined

    rendered = React.cloneElement(children, {
      ...control,
      id: childProps.id ?? controlId,
      'aria-describedby': mergedDescribedBy,
    })
  } else {
    rendered = children
  }

  return (
    <div
      data-slot="field"
      data-invalid={invalid || undefined}
      data-disabled={disabled || undefined}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    >
      {label || hint ? (
        <div
          className={cn(
            'flex items-baseline justify-between gap-3',
            orientation === 'horizontal' && 'sm:pt-2',
          )}
        >
          {label ? (
            <Label
              htmlFor={controlId}
              size={labelSize}
              required={required}
              optional={optional}
              className={cn(invalid && 'text-danger', labelClassName)}
            >
              {label}
            </Label>
          ) : (
            <span />
          )}
          {hint ? <span className="text-xs text-faint tabular">{hint}</span> : null}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-1.5">
        {rendered}

        {description ? (
          <p id={descriptionId} className="text-xs leading-relaxed text-muted">
            {description}
          </p>
        ) : null}

        {errorMessage ? (
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-xs leading-relaxed font-medium text-danger animate-in-up"
          >
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export interface FieldGroupProps extends React.ComponentProps<'div'> {
  /** Optional section heading rendered above the stacked fields. */
  legend?: React.ReactNode
  hint?: React.ReactNode
  columns?: 1 | 2
}

/** Stacks related fields with consistent rhythm; use inside a `<form>` or `<Card>`. */
export function FieldGroup({
  className,
  legend,
  hint,
  columns = 1,
  children,
  ...props
}: FieldGroupProps) {
  return (
    <div data-slot="field-group" className={cn('flex flex-col gap-4', className)} {...props}>
      {legend || hint ? (
        <div className="flex flex-col gap-1">
          {legend ? (
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{legend}</h3>
          ) : null}
          {hint ? <p className="text-xs leading-relaxed text-muted">{hint}</p> : null}
        </div>
      ) : null}
      <div
        className={cn(
          'grid gap-4',
          columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {children}
      </div>
    </div>
  )
}
