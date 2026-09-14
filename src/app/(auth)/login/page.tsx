import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth/auth-shell'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to your EZRA Pro workspace to run today’s manifest, tonight’s departures and this week’s numbers.',
}

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      subtitle="Today’s manifest, tonight’s departures and this week’s revenue — right where you left them."
    >
      <LoginForm />
    </AuthShell>
  )
}
