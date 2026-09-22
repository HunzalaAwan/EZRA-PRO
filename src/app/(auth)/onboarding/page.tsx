import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE } from '@/lib/site-config'
import { Button } from '@/components/ui/button'
import { AuthWordmark } from '@/components/auth/auth-shell'
import { OnboardingWizard } from '@/components/auth/onboarding-wizard'

export const metadata: Metadata = {
  title: 'Set up your workspace',
  description:
    'Five steps from a new EZRA Pro account to a live storefront: business details, branding, your first experience, availability and your team.',
}

/**
 * Onboarding runs full width rather than inside `<AuthShell>` — the branding
 * and activity steps carry live previews that need the room, and by this point
 * the operator has already been sold.
 */
export default function OnboardingPage() {
  return (
    <div className="relative isolate min-h-dvh overflow-hidden bg-background-subtle">
      {/* Quiet brand wash behind the first fold. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(60%_100%_at_50%_0%,var(--primary-soft),transparent_72%)] opacity-80"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[30rem] bg-grid mask-fade-b opacity-40"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="-m-1 rounded-lg p-1 transition-opacity duration-200 hover:opacity-80"
          >
            <AuthWordmark />
            <span className="sr-only">{`${SITE.name} home`}</span>
          </Link>

          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Finish later</Link>
          </Button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
              Workspace setup
            </p>
            <h1 className="mt-3 font-display text-display-sm text-balance text-foreground">
              Let’s get your storefront selling
            </h1>
            <p className="mt-3 text-base leading-relaxed text-pretty text-muted">
              Five steps, about four minutes. You will finish with a branded booking page, one live
              experience and a schedule of real departures guests can buy today.
            </p>
          </div>

          <OnboardingWizard />
        </main>

        <footer className="flex flex-col items-center gap-2 py-2 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-xs text-faint">
            Stuck on something? Email{' '}
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="rounded-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {SITE.supportEmail}
            </a>{' '}
            — a human answers in minutes.
          </p>
          <nav aria-label="Legal" className="flex items-center gap-4">
            <Link
              href="/legal/privacy"
              className="text-xs text-faint transition-colors duration-200 hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="text-xs text-faint transition-colors duration-200 hover:text-foreground"
            >
              Terms
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
