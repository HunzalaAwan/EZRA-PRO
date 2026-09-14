import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Compass, House, LifeBuoy } from 'lucide-react'

import {
  AuroraBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Logo } from '@/components/marketing/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'That page does not exist. Here are the routes back into EZRA Pro.',
  robots: { index: false, follow: true },
}

/* ==========================================================================
   404

   Lives at the app root, so it renders inside the root layout only — there is
   no marketing header or footer around it. It therefore carries its own mark,
   its own way home, and enough signposting that a wrong URL is a two-second
   detour rather than a dead end.
   ========================================================================== */

const DESTINATIONS = [
  { href: '/pricing', label: 'Pricing', note: 'Commission from 3%, no contract' },
  { href: '/solutions/watersports', label: 'Solutions', note: 'Six industries, six fits' },
  { href: '/switch', label: 'Switch to EZRA Pro', note: 'Free migration, live in a weekend' },
  { href: '/integrations', label: 'Integrations', note: 'Twenty tools, one inventory' },
]

export default function NotFound() {
  return (
    <main className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background">
      <GridBackground fade="radial" beams={1} seed="ezra-404-grid" />
      <AuroraBackground
        seed="ezra-404"
        blobs={4}
        intensity="subtle"
        palette={['lagoon', 'coral', 'reef']}
      />
      <NoiseOverlay opacity={0.04} />
      <GlowOrb color="coral" size={460} opacity={0.14} blur={110} className="-top-40 right-[-10%]" />

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

      {/* ---------- The apology ---------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <Reveal direction="up" distance={8} blur={false}>
          <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
            <Compass className="size-3.5" aria-hidden="true" />
            Error 404
          </span>
        </Reveal>

        <Reveal
          delay={0.06}
          blur
          className="mt-8 font-display text-[clamp(4.5rem,18vw,9rem)] font-bold leading-[0.85] tracking-[-0.05em] text-gradient-brand tabular"
        >
          404
        </Reveal>

        <Reveal
          as="h1"
          delay={0.12}
          blur
          className="mt-8 font-display text-display-sm font-semibold tracking-[-0.03em] text-balance text-foreground"
        >
          That departure does not exist
        </Reveal>

        <Reveal
          as="p"
          delay={0.18}
          className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
        >
          The page you were after has been moved, renamed, or never sailed in the first place.
          Nothing is broken on your side — here is the way back.
        </Reveal>

        <Reveal
          delay={0.24}
          className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
        >
          <Button
            asChild
            size="lg"
            variant="primary"
            leftIcon={<House aria-hidden="true" />}
            className="w-full sm:w-auto"
          >
            <Link href="/">Back to the homepage</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            rightIcon={<ArrowRight aria-hidden="true" />}
            className="w-full sm:w-auto"
          >
            <Link href="/contact">Tell us what you were looking for</Link>
          </Button>
        </Reveal>

        {/* ---------- Signposts ---------- */}
        <nav aria-label="Popular pages" className="mt-14 w-full">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
            Popular destinations
          </h2>

          <StaggerGroup
            as="ul"
            stagger={0.06}
            startDelay={0.3}
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            {DESTINATIONS.map((destination) => (
              <StaggerItem as="li" key={destination.href} distance={12}>
                <Link
                  href={destination.href}
                  className={cn(
                    'group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left',
                    'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
                    'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      {destination.label}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-muted">
                      {destination.note}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-faint transition-[transform,color] duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </nav>
      </div>
    </main>
  )
}
