'use client'

import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn, hashSeed, initials } from '@/lib/utils'

export type AvatarStatus = 'online' | 'busy' | 'away' | 'offline'

/* ==========================================================================
   RECIPES
   ========================================================================== */

export const avatarVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center rounded-full align-middle',
  {
    variants: {
      size: {
        xs: 'size-6 text-xs',
        sm: 'size-8 text-xs',
        md: 'size-10 text-xs',
        lg: 'size-12 text-sm',
        xl: 'size-16 text-lg',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type AvatarVariants = VariantProps<typeof avatarVariants>
export type AvatarSize = NonNullable<AvatarVariants['size']>

/**
 * Deterministic fallback tint. `hashSeed` is a stable string hash, so the same
 * person keeps the same colour on the server and the client — no hydration
 * drift and no "my avatar changed colour" support tickets.
 */
const FALLBACK_TINTS = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-4/20 text-chart-4',
  'bg-chart-5/15 text-chart-5',
  'bg-chart-6/15 text-chart-6',
  'bg-chart-7/15 text-chart-7',
  'bg-chart-8/15 text-chart-8',
] as const

function fallbackTint(name: string) {
  return FALLBACK_TINTS[hashSeed(name) % FALLBACK_TINTS.length]
}

const STATUS_META: Record<AvatarStatus, { dot: string; ring: string; label: string }> = {
  online: { dot: 'bg-success', ring: 'ring-success', label: 'Online' },
  busy: { dot: 'bg-danger', ring: 'ring-danger', label: 'Busy' },
  away: { dot: 'bg-warning', ring: 'ring-warning', label: 'Away' },
  offline: { dot: 'bg-faint', ring: 'ring-faint', label: 'Offline' },
}

const STATUS_DOT_SIZE: Record<AvatarSize, string> = {
  xs: 'size-2 border',
  sm: 'size-2.5 border-2',
  md: 'size-3 border-2',
  lg: 'size-3.5 border-2',
  xl: 'size-4 border-2',
}

const GROUP_OVERLAP: Record<AvatarSize, string> = {
  xs: '-ml-1.5',
  sm: '-ml-2',
  md: '-ml-2.5',
  lg: '-ml-3',
  xl: '-ml-4',
}

/* ==========================================================================
   PRIMITIVE PASS-THROUGHS — for full control over an unusual avatar
   ========================================================================== */

const AvatarRoot = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & AvatarVariants
>(function AvatarRoot({ className, size, ...props }, ref) {
  return (
    <AvatarPrimitive.Root ref={ref} className={cn(avatarVariants({ size }), className)} {...props} />
  )
})

const AvatarImage = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(function AvatarImage({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('size-full rounded-full object-cover', className)}
      {...props}
    />
  )
})

const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        'flex size-full items-center justify-center rounded-full font-semibold uppercase tracking-wide',
        'bg-surface-sunken text-muted',
        className,
      )}
      {...props}
    />
  )
})

/* ==========================================================================
   COMPOSED AVATAR — the one almost every call site wants
   ========================================================================== */

export interface AvatarProps
  extends Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, 'children'>,
    AvatarVariants {
  /** Full name — drives the initials fallback, the tint and the image alt text. */
  name: string
  src?: string | null
  /** Overrides the derived alt text. Pass "" for purely decorative avatars. */
  alt?: string
  status?: AvatarStatus
  /** Also draw a status-coloured ring around the avatar, not just the dot. */
  ring?: boolean
  /** Hold the fallback back briefly so a fast image does not flash initials. */
  delayMs?: number
  /** Replace the derived initials entirely. */
  fallback?: React.ReactNode
}

const Avatar = React.forwardRef<React.ComponentRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  function Avatar(
    { className, name, src, alt, size = 'md', status, ring = false, delayMs = 120, fallback, ...props },
    ref,
  ) {
    const resolvedSize: AvatarSize = size ?? 'md'
    const statusMeta = status ? STATUS_META[status] : null

    return (
      <AvatarPrimitive.Root
        ref={ref}
        className={cn(
          avatarVariants({ size: resolvedSize }),
          ring && statusMeta && `ring-2 ring-offset-2 ring-offset-background ${statusMeta.ring}`,
          className,
        )}
        {...props}
      >
        {src ? <AvatarImage src={src} alt={alt ?? name} /> : null}
        <AvatarFallback delayMs={src ? delayMs : 0} className={fallbackTint(name)}>
          {fallback ?? initials(name)}
        </AvatarFallback>

        {statusMeta ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                'absolute bottom-0 right-0 rounded-full border-surface',
                'translate-x-[12%] translate-y-[12%]',
                STATUS_DOT_SIZE[resolvedSize],
                statusMeta.dot,
              )}
            />
            {/* Colour alone never carries the meaning. */}
            <span className="sr-only">{statusMeta.label}</span>
          </>
        ) : null}
      </AvatarPrimitive.Root>
    )
  },
)

/* ==========================================================================
   GROUP
   ========================================================================== */

export interface AvatarGroupItem {
  id?: string
  name: string
  src?: string | null
}

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  avatars: AvatarGroupItem[]
  /** How many faces to show before collapsing the rest into a "+N" chip. */
  max?: number
  size?: AvatarSize
  /** Ring colour separating stacked faces — match the surface behind them. */
  ringClassName?: string
  /** Accessible name for the stack, e.g. "Guides on this departure". */
  label?: string
}

const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(function AvatarGroup(
  { className, avatars, max = 4, size = 'sm', ringClassName = 'ring-background', label, ...props },
  ref,
) {
  const visible = avatars.slice(0, Math.max(max, 0))
  const overflow = avatars.length - visible.length

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={cn('flex items-center', className)}
      {...props}
    >
      {visible.map((person, index) => (
        <Avatar
          key={person.id ?? `${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size={size}
          className={cn('ring-2', ringClassName, index > 0 && GROUP_OVERLAP[size])}
        />
      ))}

      {overflow > 0 ? (
        <span
          className={cn(
            avatarVariants({ size }),
            'ring-2',
            ringClassName,
            GROUP_OVERLAP[size],
            'bg-surface-sunken font-semibold text-muted',
          )}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
})

export { Avatar, AvatarRoot, AvatarImage, AvatarFallback, AvatarGroup }
