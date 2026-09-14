import type { Metadata } from 'next'

/**
 * Authentication surface.
 *
 * Deliberately bare: no marketing header, no footer nav, no promotional
 * chrome. Each screen owns its own composition (`<AuthShell>` for the
 * split-screen forms, a full-width container for onboarding), so this layout's
 * only jobs are the page background and keeping every route in the group out
 * of the search index.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>
}
