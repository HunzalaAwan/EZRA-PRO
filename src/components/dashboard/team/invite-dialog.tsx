'use client'

import * as React from 'react'
import { Info, Send, UserPlus } from 'lucide-react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { TagInput } from '@/components/ui/tag-input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { ASSIGNABLE_ROLES, ROLE_META } from '@/components/dashboard/team/team-table'
import { CURRENT_TENANT } from '@/lib/demo-core'
import { pluralize } from '@/lib/utils'
import type { Role } from '@/types'

/* ==========================================================================
   SCHEMA
   ========================================================================== */

const emailSchema = z.email()

const inviteSchema = z.object({
  emails: z
    .array(z.email('Every address has to be a valid email.'))
    .min(1, 'Add at least one email address.')
    .max(20, 'Invite up to 20 people at a time.'),
  role: z.string().min(1, 'Choose the access level for these invitations.'),
  message: z.string().trim().max(500, 'Keep the note under 500 characters.'),
})

export interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the validated payload once the invitations are "sent". */
  onInvite: (payload: { emails: string[]; role: Role; message: string }) => void
  /** Addresses already in the workspace — used to block duplicates. */
  existingEmails: string[]
}

export function InviteDialog({
  open,
  onOpenChange,
  onInvite,
  existingEmails,
}: InviteDialogProps) {
  const [emails, setEmails] = React.useState<string[]>([])
  const [role, setRole] = React.useState<Role>('staff')
  const [message, setMessage] = React.useState('')
  const [errors, setErrors] = React.useState<{ emails?: string; message?: string }>({})
  const [sending, setSending] = React.useState(false)

  const existing = React.useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  )

  function reset() {
    setEmails([])
    setRole('staff')
    setMessage('')
    setErrors({})
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function validateTag(tag: string, current: string[]): string | null {
    const value = tag.toLowerCase()
    if (!emailSchema.safeParse(value).success) return 'That does not look like an email address.'
    if (existing.has(value)) return 'That person is already in the workspace.'
    if (current.some((t) => t.toLowerCase() === value)) return 'Already on the list.'
    return null
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = inviteSchema.safeParse({ emails, role, message })

    if (!parsed.success) {
      const next: { emails?: string; message?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'emails' && !next.emails) next.emails = issue.message
        if (key === 'message' && !next.message) next.message = issue.message
      }
      setErrors(next)
      return
    }

    setSending(true)
    window.setTimeout(() => {
      setSending(false)
      onInvite({ emails, role, message: message.trim() })
      toast.success(
        `${emails.length} ${pluralize(emails.length, 'invitation')} sent`,
        {
          description: `They will join ${CURRENT_TENANT.name} as ${ROLE_META[role].label.toLowerCase()}${
            emails.length === 1 ? '' : 's'
          }.`,
        },
      )
      handleOpenChange(false)
    }, 700)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
          <DialogHeader divider>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" aria-hidden="true" />
              Invite people to {CURRENT_TENANT.name}
            </DialogTitle>
            <DialogDescription>
              Invitations expire after seven days. Seats are only billed once someone accepts.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-5 py-5">
            <Field
              label="Email addresses"
              description="Type an address and press Enter, or paste a comma-separated list."
              required
              error={errors.emails}
              hint={`${emails.length}/20`}
            >
              {({ id }) => (
                <TagInput
                  id={id}
                  label="Email addresses"
                  value={emails}
                  onValueChange={(next) => {
                    setEmails(next)
                    setErrors((prev) => ({ ...prev, emails: undefined }))
                  }}
                  max={20}
                  separators={[',', ' ', ';']}
                  transform={(raw) => raw.trim().toLowerCase()}
                  validate={validateTag}
                  placeholder="crew@bluehorizonmaui.com"
                />
              )}
            </Field>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-sm font-medium text-foreground">
                Access level
                <span className="ml-1.5 text-xs font-normal text-muted">
                  — applies to everyone in this invitation
                </span>
              </legend>
              <RadioGroup
                value={role}
                onValueChange={(v) => setRole(v as Role)}
                gap="sm"
                className="sm:grid-cols-2"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <RadioGroupCard
                    key={r}
                    value={r}
                    label={
                      <span className="flex items-center gap-2">
                        {ROLE_META[r].label}
                        {r === 'staff' ? (
                          <Badge variant="neutral" size="sm">
                            Common
                          </Badge>
                        ) : null}
                      </span>
                    }
                    description={ROLE_META[r].blurb}
                    className="p-3"
                  />
                ))}
              </RadioGroup>
            </fieldset>

            <Field
              label="Add a note"
              optional
              description="Included at the top of the invitation email."
              error={errors.message}
              hint={`${message.length}/500`}
            >
              <Textarea
                value={message}
                maxLength={500}
                rows={3}
                onChange={(e) => {
                  setMessage(e.target.value)
                  setErrors((prev) => ({ ...prev, message: undefined }))
                }}
                placeholder="Welcome aboard — you'll be running the dawn patrol manifests with Tui."
              />
            </Field>

            <Alert variant="info" icon={Info}>
              <AlertDescription>
                {ROLE_META[role].label}s{' '}
                {role === 'guide'
                  ? 'only see departures they are assigned to, and cannot view revenue.'
                  : role === 'viewer'
                    ? 'can read reports but cannot change a single record.'
                    : 'can be scoped further per activity once they accept.'}
              </AlertDescription>
            </Alert>
          </DialogBody>

          <DialogFooter divider>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={sending} leftIcon={<Send />}>
              Send {emails.length > 0 ? emails.length : ''}{' '}
              {pluralize(emails.length || 1, 'invitation')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
