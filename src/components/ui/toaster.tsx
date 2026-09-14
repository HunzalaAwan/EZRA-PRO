'use client'

import * as React from 'react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import type { ExternalToast, ToasterProps as SonnerToasterProps } from 'sonner'
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Toaster — transient feedback ("Booking confirmed", "Manifest exported").

   Sonner ships its own injected stylesheet, which outranks Tailwind utilities
   on the toast element. Rather than fight specificity we feed it the custom
   properties it already reads (`--normal-bg`, `--success-text`, …) and point
   them at our semantic tokens, so toasts flip with the theme for free.
   ========================================================================== */

/** Mirrors the `.dark` class Next writes on <html>, without next-themes. */
function useThemeMode(): 'light' | 'dark' {
  // Starts light so SSR and the first client render agree; the effect corrects
  // it before the user can perceive a toast.
  const [mode, setMode] = React.useState<'light' | 'dark'>('light')

  React.useEffect(() => {
    const root = document.documentElement
    const read = () => setMode(root.classList.contains('dark') ? 'dark' : 'light')
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return mode
}

export interface ToasterProps extends Omit<SonnerToasterProps, 'theme'> {
  /** Overrides the automatic `.dark` detection. */
  theme?: SonnerToasterProps['theme']
}

function Toaster({
  className,
  position = 'bottom-right',
  offset = 20,
  visibleToasts = 4,
  duration = 5000,
  gap = 10,
  closeButton = true,
  toastOptions,
  style,
  theme,
  ...props
}: ToasterProps) {
  const detected = useThemeMode()

  return (
    <SonnerToaster
      theme={theme ?? detected}
      position={position}
      offset={offset}
      visibleToasts={visibleToasts}
      duration={duration}
      gap={gap}
      closeButton={closeButton}
      className={cn('ezra-toaster', className)}
      icons={{
        success: <CircleCheck aria-hidden="true" className="size-4 text-success" />,
        error: <CircleAlert aria-hidden="true" className="size-4 text-danger" />,
        warning: <TriangleAlert aria-hidden="true" className="size-4 text-warning" />,
        info: <Info aria-hidden="true" className="size-4 text-info" />,
        loading: (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
        ),
        close: <X aria-hidden="true" className="size-3.5" />,
      }}
      style={
        {
          '--normal-bg': 'var(--surface-raised)',
          '--normal-text': 'var(--fg)',
          '--normal-border': 'var(--border)',
          '--success-bg': 'var(--surface-raised)',
          '--success-text': 'var(--fg)',
          '--success-border': 'color-mix(in oklab, var(--success) 35%, var(--border))',
          '--error-bg': 'var(--surface-raised)',
          '--error-text': 'var(--fg)',
          '--error-border': 'color-mix(in oklab, var(--danger) 35%, var(--border))',
          '--warning-bg': 'var(--surface-raised)',
          '--warning-text': 'var(--fg)',
          '--warning-border': 'color-mix(in oklab, var(--warning) 35%, var(--border))',
          '--info-bg': 'var(--surface-raised)',
          '--info-text': 'var(--fg)',
          '--info-border': 'color-mix(in oklab, var(--info) 35%, var(--border))',
          '--border-radius': 'var(--radius-xl)',
          '--width': '380px',
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: cn(
            'group/toast font-sans shadow-lg backdrop-blur-sm',
            toastOptions?.classNames?.toast,
          ),
          title: cn(
            'font-display text-sm font-semibold text-foreground',
            toastOptions?.classNames?.title,
          ),
          description: cn('text-[0.8125rem] text-muted', toastOptions?.classNames?.description),
          actionButton: cn(
            'rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary transition-colors duration-200 hover:bg-primary-hover',
            toastOptions?.classNames?.actionButton,
          ),
          cancelButton: cn(
            'rounded-lg bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted transition-colors duration-200 hover:text-foreground',
            toastOptions?.classNames?.cancelButton,
          ),
          closeButton: cn(
            'border-line bg-surface text-subtle transition-colors duration-200 hover:text-foreground',
            toastOptions?.classNames?.closeButton,
          ),
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
export type { ExternalToast }
