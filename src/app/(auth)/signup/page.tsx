import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth/auth-shell'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Start free on EZRA Pro — 14 days, no card, and free migration from FareHarbor or Peek Pro when you are ready to switch.',
}

export default function SignupPage() {
  return (
    <AuthShell
      eyebrow="Start free"
      title="Create your EZRA Pro account"
      subtitle="Fourteen days free, no card required. Bring your activities, guests and future bookings across whenever you are ready — we do the migration for you."
    >
      <SignupForm />
    </AuthShell>
  )
}
