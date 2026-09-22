'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Radix keeps content mounted through an exit only when a CSS *animation* is
 * running (transitions are not detected), so the open/close motion has to be
 * keyframe based. React 19 hoists and de-dupes this by `href`.
 */
const SELECT_MOTION_CSS = `
@keyframes ezra-select-in{from{opacity:0;transform:scale(0.96) translateY(-2px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes ezra-select-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.97)}}
`

function SelectMotionStyles() {
  return (
    <style href="ezra-motion-select" precedence="medium">
      {SELECT_MOTION_CSS}
    </style>
  )
}

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

export const selectTriggerVariants = cva(
  [
    'group/select-trigger flex w-full items-center justify-start gap-2 whitespace-nowrap',
    'rounded-lg border border-line bg-surface text-foreground shadow-xs',
    'transition-all duration-200 ease-[var(--ease-out-expo)]',
    'hover:border-line-strong',
    'focus-visible:border-primary focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
    'data-[state=open]:border-primary data-[state=open]:ring-3 data-[state=open]:ring-primary/20',
    'data-[placeholder]:text-faint',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 disabled:shadow-none',
    'aria-invalid:border-danger aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/25',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    // Keep the selected value from pushing the chevron off the end.
    '[&>span]:min-w-0 [&>span]:truncate [&>span]:text-left',
  ],
  {
    variants: {
      size: {
        sm: 'h-9 rounded-md px-2.5 text-[0.8125rem] [&_svg]:size-3.5',
        md: 'h-10 px-3 text-sm [&_svg]:size-4',
        lg: 'h-11 rounded-xl px-3.5 text-[0.9375rem] [&_svg]:size-[1.125rem]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type SelectTriggerSize = NonNullable<VariantProps<typeof selectTriggerVariants>['size']>

export interface SelectTriggerProps
  extends React.ComponentProps<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectTriggerVariants> {
  /** Leading glyph rendered before the value — mirrors `<Input leftIcon>`. */
  icon?: React.ReactNode
  /** `true` or a message string both mark the trigger invalid. */
  error?: boolean | string
}

function SelectTrigger({
  className,
  size,
  icon,
  error,
  children,
  'aria-invalid': ariaInvalid,
  ...props
}: SelectTriggerProps) {
  const invalid =
    error !== undefined && error !== false
      ? true
      : ariaInvalid === true || ariaInvalid === 'true'

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      aria-invalid={invalid || undefined}
      className={cn(selectTriggerVariants({ size }), className)}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="flex items-center text-faint">
          {icon}
        </span>
      ) : null}
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          aria-hidden="true"
          className="ml-auto text-faint transition-transform duration-200 ease-[var(--ease-out-expo)] group-data-[state=open]/select-trigger:rotate-180"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-subtle',
        'bg-[linear-gradient(180deg,var(--surface-raised),transparent)]',
        className,
      )}
      {...props}
    >
      <ChevronUp className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        'flex cursor-default items-center justify-center py-1 text-subtle',
        'bg-[linear-gradient(0deg,var(--surface-raised),transparent)]',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export interface SelectContentProps
  extends React.ComponentProps<typeof SelectPrimitive.Content> {
  /** Match the trigger width (default) or let the list size to its content. */
  width?: 'trigger' | 'auto'
  container?: React.ComponentProps<typeof SelectPrimitive.Portal>['container']
}

function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 6,
  collisionPadding = 12,
  width = 'trigger',
  container,
  ...props
}: SelectContentProps) {
  return (
    <>
      <SelectMotionStyles />
      <SelectPrimitive.Portal container={container}>
        <SelectPrimitive.Content
          data-slot="select-content"
          position={position}
          sideOffset={position === 'popper' ? sideOffset : undefined}
          collisionPadding={collisionPadding}
          className={cn(
            'relative z-50 overflow-hidden rounded-xl border border-line bg-surface-raised text-foreground shadow-xl',
            'max-h-[min(22rem,var(--radix-select-content-available-height))]',
            'origin-[var(--radix-select-content-transform-origin)]',
            'data-[state=open]:animate-[ezra-select-in_170ms_var(--ease-out-expo)]',
            'data-[state=closed]:animate-[ezra-select-out_120ms_var(--ease-in-out-quart)]',
            width === 'trigger'
              ? 'w-[var(--radix-select-trigger-width)]'
              : 'min-w-[var(--radix-select-trigger-width)]',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.Viewport className="p-1.5">
            {children}
          </SelectPrimitive.Viewport>
          <SelectScrollDownButton />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        'px-2.5 pt-2 pb-1.5 text-xs font-semibold tracking-wider text-faint uppercase',
        className,
      )}
      {...props}
    />
  )
}

export interface SelectItemProps extends React.ComponentProps<typeof SelectPrimitive.Item> {
  /** Leading glyph — keep it consistent across every item in a list. */
  icon?: React.ReactNode
  /**
   * Secondary line. Rendered outside `ItemText` so it never leaks into the
   * trigger's selected-value display or Radix's typeahead matching.
   */
  description?: React.ReactNode
}

function SelectItem({ className, children, icon, description, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full cursor-default select-none items-center gap-2.5 rounded-lg',
        'py-2 pr-8 pl-2.5 text-sm outline-hidden',
        'transition-colors duration-150 ease-[var(--ease-out-expo)]',
        'data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary',
        'data-[state=checked]:font-medium',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="flex items-center text-subtle">
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-col gap-0.5">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? (
          <span className="truncate text-xs font-normal text-subtle">{description}</span>
        ) : null}
      </span>

      <span className="absolute right-2.5 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="text-primary" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('-mx-1.5 my-1.5 h-px bg-line', className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
