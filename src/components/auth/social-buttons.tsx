'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/* ==========================================================================
   BRAND MARKS
   Drawn inline so the sign-in row costs zero network requests and inherits the
   theme. Monochrome by design: three vendor palettes fighting each other above
   a single-accent form is the fastest way to make an auth screen look cheap.
   ========================================================================== */

function GoogleMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48Z" />
    </svg>
  )
}

function AppleMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09ZM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701Z" />
    </svg>
  )
}

function MicrosoftMark(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M11.4 24H0V12.6h11.4V24ZM24 24H12.6V12.6H24V24ZM11.4 11.4H0V0h11.4v11.4Zm12.6 0H12.6V0H24v11.4Z" />
    </svg>
  )
}

/* ==========================================================================
   BUTTONS
   ========================================================================== */

export type SocialProvider = 'google' | 'apple' | 'microsoft'

interface ProviderMeta {
  id: SocialProvider
  name: string
  Mark: (props: React.ComponentProps<'svg'>) => React.JSX.Element
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'google', name: 'Google', Mark: GoogleMark },
  { id: 'apple', name: 'Apple', Mark: AppleMark },
  { id: 'microsoft', name: 'Microsoft', Mark: MicrosoftMark },
]

export interface SocialButtonsProps extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  /**
   * `stack` gives each provider its own full-width row (the default, and what
   * the sign-in screen uses). `grid` splits them across a three-up row for
   * forms that are already long.
   */
  layout?: 'stack' | 'grid'
  /** Verb in front of the provider name — "Continue" / "Sign up". */
  verb?: string
  /**
   * Called with the chosen provider. Returning a promise keeps the spinner up
   * until it settles. Omit it and the demo routes straight to the dashboard.
   */
  onSelect?: (provider: SocialProvider) => void | Promise<void>
  disabled?: boolean
  /** Where the built-in demo handler lands. */
  redirectTo?: string
}

/**
 * Federated sign-in row. Exactly one provider can be pending at a time; the
 * others go disabled so a double-tap cannot start two flows.
 */
export function SocialButtons({
  layout = 'stack',
  verb = 'Continue',
  onSelect,
  disabled = false,
  redirectTo = '/dashboard',
  className,
  ...props
}: SocialButtonsProps) {
  const router = useRouter()
  const [pending, setPending] = React.useState<SocialProvider | null>(null)
  const mounted = React.useRef(true)

  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleSelect(provider: SocialProvider) {
    if (pending) return
    setPending(provider)

    try {
      if (onSelect) {
        await onSelect(provider)
        return
      }
      // Demo build: no identity provider to hand off to, so stand in for the
      // round trip and land the operator where a real callback would.
      await new Promise((resolve) => setTimeout(resolve, 650))
      router.push(redirectTo)
    } finally {
      if (mounted.current) setPending(null)
    }
  }

  const isGrid = layout === 'grid'

  return (
    <div
      data-slot="social-buttons"
      className={cn(isGrid ? 'grid grid-cols-3 gap-2.5' : 'flex flex-col gap-2.5', className)}
      {...props}
    >
      {PROVIDERS.map(({ id, name, Mark }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          size="lg"
          fullWidth
          loading={pending === id}
          disabled={disabled || (pending !== null && pending !== id)}
          onClick={() => void handleSelect(id)}
          leftIcon={pending === id ? undefined : <Mark className="size-[1.125rem]" />}
          className={cn(
            'justify-center bg-surface font-medium hover:bg-surface-sunken hover:text-foreground',
            isGrid && 'px-0',
          )}
        >
          {isGrid ? (
            <>
              <span className="sr-only">{`${verb} with `}</span>
              <span className="truncate">{name}</span>
            </>
          ) : (
            `${verb} with ${name}`
          )}
        </Button>
      ))}
    </div>
  )
}
