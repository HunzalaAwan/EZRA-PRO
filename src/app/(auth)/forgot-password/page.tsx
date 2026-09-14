import type { Metadata } from 'next'

import { AuthShell } from '@/components/auth/auth-shell'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export const metadata: Metadata = {
  title: 'Reset your password',
  description:
    'Send yourself a link to set a new EZRA Pro password. The link stays valid for one hour.',
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      subtitle="Enter the address you sign in with and we’ll send a link to set a new one. Your bookings and schedule are untouched."
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
