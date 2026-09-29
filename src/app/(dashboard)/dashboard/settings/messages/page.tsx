import { redirect } from 'next/navigation'

/* Messages moved to Marketing → Automations, with the growth messages beside them. */
export default function MessagesSettingsPage() {
  redirect('/dashboard/marketing/automations')
}
