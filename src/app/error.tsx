'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, House, LifeBuoy, RefreshCw, TriangleAlert } from 'lucide-react'

import {
  AuroraBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { Logo } from '@/components/marketing/logo'
import { Button } from '@/components/ui/button'
import { SITE } from '@/lib/site-config'

/* ==========================================================================
   ROUTE ERROR BOUNDARY

   Renders inside the root layout when a segment below it throws. `reset()`
   re-renders the failed subtree — a genuine retry, not a page reload — so it
   is the primary action. The digest is the only thing that links what the
   operator saw to what our logs recorded, so it is shown rather than hidden.

   (A failure in the root layout itself is caught by `global-error.tsx`, not
   this file, which is why this one can safely use the theme tokens.)
   ========================================================================== */

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The server never sees a client-side throw; this is what puts it in the
    // browser console next to whatever the operator was doing at the time.
    console.error('[EZRA Pro] Route error:', error)
  }, [error])

  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <GridBackground fade="radial" seed="ezra-error-grid" className="opacity-70" />
      <AuroraBackground
        seed="ezra-error"
        blobs={3}
        intensity="subtle"
        palette={['coral', 'sunset']}
      />
      <NoiseOverlay opacity={0.04} />
      <GlowOrb
        color="coral"
        size={520}
        opacity={0.14}
        blur={120}
        float={false}
        className="-top-48 left-1/2 -translate-x-1/2"
      />

      {/* ---------- Minimal chrome ---------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="EZRA Pro — home"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <Logo size="md" />
        </Link>
        <Button asChild size="sm" variant="ghost" leftIcon={<LifeBuoy aria-hidden="true" />}>
          <Link href="/contact">Get help</Link>
        </Button>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <Reveal direction="up" distance={10} blur={false}>
          <span className="relative flex size-16 items-center justify-center rounded-3xl bg-warning-soft text-warning">
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-pulse-ring rounded-3xl bg-warning/20"
            />
            <TriangleAlert className="relative size-7" aria-hidden="true" />
          </span>
        </Reveal>

        <Reveal
          as="h1"
          delay={0.06}
          blur
          className="mt-8 font-display text-display-sm font-semibold tracking-[-0.03em] text-balance text-foreground"
        >
          Something on our side gave way
        </Reveal>

        <Reveal
          as="p"
          delay={0.12}
          className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
        >
          This page failed to render. It is almost certainly a transient fault rather than
          anything you did — try it again, and if it keeps happening send us the reference below
          and we will have the exact stack trace.
        </Reveal>

        <Reveal
          delay={0.18}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <Button
            type="button"
            size="lg"
            variant="primary"
            onClick={reset}
            leftIcon={<RefreshCw aria-hidden="true" />}
            className="w-full sm:w-auto"
          >
            Try again
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            leftIcon={<House aria-hidden="true" />}
            className="w-full sm:w-auto"
          >
            <Link href="/">Back to the homepage</Link>
          </Button>
        </Reveal>

        {/* ---------- What to quote when reporting it ---------- */}
        <Reveal delay={0.24} className="mt-12 w-full">
          <div className="rounded-2xl border border-line bg-surface p-5 text-left shadow-sm sm:p-6">
            <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-subtle">
              If it happens again
            </h2>

            {error.digest ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-muted">
                Quote this reference:
                <code className="rounded-md border border-line bg-surface-sunken px-2 py-1 font-mono text-[0.75rem] text-foreground select-all">
                  {error.digest}
                </code>
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                No reference was attached to this failure. Tell us what you were doing and roughly
                when, and we will find it in the logs.
              </p>
            )}

            <p className="mt-4 text-sm leading-relaxed text-muted">
              Email{' '}
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {SITE.supportEmail}
              </a>{' '}
              or call {SITE.phone}. Median first response is four minutes, seven days a week.
            </p>

            <Button
              asChild
              size="sm"
              variant="ghost"
              rightIcon={<ArrowRight aria-hidden="true" />}
              className="mt-4 -ml-3"
            >
              <Link href="/contact">Report it to the team</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </main>
  )
}
