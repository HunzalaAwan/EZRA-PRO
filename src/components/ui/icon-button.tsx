import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button, type ButtonProps, type ButtonSize } from '@/components/ui/button'

/**
 * Square footprints keyed to the Button height scale so an IconButton always
 * lines up with the text buttons sitting next to it in a toolbar.
 */
const iconButtonSizes: Record<ButtonSize, string> = {
  xs: 'size-7 rounded-md [&_svg]:size-3.5',
  sm: 'size-9 rounded-lg [&_svg]:size-4',
  md: 'size-10 rounded-lg [&_svg]:size-[1.125rem]',
  lg: 'size-11 rounded-xl [&_svg]:size-5',
  xl: 'size-13 rounded-xl [&_svg]:size-6',
}

export interface IconButtonProps
  extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'fullWidth' | 'children'> {
  /** Required: the button has no visible text, so it must carry its own name. */
  'aria-label': string
  /** The icon element. Sized automatically by the `size` variant. */
  children: React.ReactNode
  shape?: 'square' | 'circle'
}

/**
 * Icon-only action sharing Button's full variant surface. The accessible name is
 * mandatory at the type level — a nameless icon button is an accessibility bug we
 * refuse to let compile.
 */
export function IconButton({
  className,
  size = 'md',
  shape = 'square',
  asChild = false,
  loading = false,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      data-slot="icon-button"
      size={size}
      asChild={asChild}
      loading={loading}
      className={cn(
        'px-0',
        iconButtonSizes[size ?? 'md'],
        shape === 'circle' && 'rounded-full',
        className,
      )}
      {...props}
    >
      {/* While loading, Button renders the spinner in the leading slot — dropping the
          icon keeps the square from holding two glyphs. Slot needs its single child. */}
      {loading && !asChild ? null : children}
    </Button>
  )
}
