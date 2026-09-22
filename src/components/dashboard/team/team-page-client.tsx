'use client'

import * as React from 'react'
import { Check, Eye, Minus, ShieldCheck, UserPlus, Users } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { InviteDialog } from '@/components/dashboard/team/invite-dialog'
import {
  ASSIGNABLE_ROLES,
  ROLE_META,
  TeamTable,
} from '@/components/dashboard/team/team-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { cn, hashSeed } from '@/lib/utils'
import type { Role, Tenant, User } from '@/types'

/* ==========================================================================
   PERMISSIONS MATRIX
   ========================================================================== */

type Grant = 'full' | 'limited' | 'view' | 'none'

interface Capability {
  key: string
  label: string
  hint: string
  grants: Record<Role, Grant>
}

const CAPABILITIES: Capability[] = [
  {
    key: 'calendar',
    label: 'Calendar & manifests',
    hint: 'See departures, print run sheets, check guests in',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'full',
      staff: 'full',
      guide: 'limited',
      viewer: 'view',
    },
  },
  {
    key: 'bookings',
    label: 'Take & edit bookings',
    hint: 'Create, move, resize and cancel reservations',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'full',
      staff: 'full',
      guide: 'limited',
      viewer: 'none',
    },
  },
  {
    key: 'activities',
    label: 'Activities & pricing',
    hint: 'Publish activities, edit tiers and add-ons',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'full',
      staff: 'view',
      guide: 'none',
      viewer: 'view',
    },
  },
  {
    key: 'schedule',
    label: 'Schedule & capacity',
    hint: 'Open departures, set capacity, assign crew and vessels',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'full',
      staff: 'limited',
      guide: 'none',
      viewer: 'view',
    },
  },
  {
    key: 'refunds',
    label: 'Refunds & adjustments',
    hint: 'Issue refunds and write off balances',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'limited',
      staff: 'none',
      guide: 'none',
      viewer: 'none',
    },
  },
  {
    key: 'revenue',
    label: 'Revenue & payouts',
    hint: 'See money in, fees, commission and bank transfers',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'view',
      staff: 'none',
      guide: 'none',
      viewer: 'view',
    },
  },
  {
    key: 'guests',
    label: 'Guest records',
    hint: 'Contact details, history, notes and marketing consent',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'full',
      staff: 'full',
      guide: 'limited',
      viewer: 'view',
    },
  },
  {
    key: 'team',
    label: 'Team & roles',
    hint: 'Invite people and change what they can do',
    grants: {
      owner: 'full',
      admin: 'full',
      manager: 'limited',
      staff: 'none',
      guide: 'none',
      viewer: 'none',
    },
  },
  {
    key: 'billing',
    label: 'Billing & plan',
    hint: 'Payment method, invoices and plan changes',
    grants: {
      owner: 'full',
      admin: 'none',
      manager: 'none',
      staff: 'none',
      guide: 'none',
      viewer: 'none',
    },
  },
  {
    key: 'workspace',
    label: 'Delete workspace',
    hint: 'Irreversible removal of every record',
    grants: {
      owner: 'full',
      admin: 'none',
      manager: 'none',
      staff: 'none',
      guide: 'none',
      viewer: 'none',
    },
  },
]

const ALL_ROLES: Role[] = ['owner', ...ASSIGNABLE_ROLES]

const GRANT_META: Record<
  Grant,
  { icon: typeof Check; className: string; label: string }
> = {
  full: { icon: Check, className: 'text-success', label: 'Full access' },
  limited: { icon: Check, className: 'text-warning', label: 'Own departures only' },
  view: { icon: Eye, className: 'text-info', label: 'Read only' },
  none: { icon: Minus, className: 'text-faint', label: 'No access' },
}

/* ==========================================================================
   PAGE
   ========================================================================== */

function isoFromNow(now: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours(),
  )}:${pad(now.getMinutes())}:00`
}

export interface TeamPageClientProps {
  tenant: Tenant
  currentUserId: string
  initialMembers: User[]
  now: Date
}

/**
 * All the team-management logic and UI. `initialMembers` is fetched on the
 * server — this component never imports `@/lib/demo` itself, which is what
 * keeps the synthetic dataset out of the client bundle.
 */
export function TeamPageClient({
  tenant: CURRENT_TENANT,
  currentUserId,
  initialMembers,
  now: NOW,
}: TeamPageClientProps) {
  const [members, setMembers] = React.useState<User[]>(initialMembers)
  const [query, setQuery] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState<Role | 'all'>('all')
  const [inviteOpen, setInviteOpen] = React.useState(false)

  const roleCounts = React.useMemo(() => {
    const map = new Map<Role, number>()
    for (const m of members) map.set(m.role, (map.get(m.role) ?? 0) + 1)
    return map
  }, [members])

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (!q) return true
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        (m.certifications ?? []).some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [members, query, roleFilter])

  const bookableCount = members.filter((m) => m.isBookable).length
  const pendingCount = members.filter((m) => m.status === 'invited').length

  function handleRoleChange(userId: string, role: Role) {
    setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)))
    const member = members.find((m) => m.id === userId)
    toast.success('Role updated', {
      description: `${member?.name ?? 'That member'} is now ${ROLE_META[role].label.toLowerCase()}.`,
    })
  }

  function handleRemove(userId: string) {
    const member = members.find((m) => m.id === userId)
    setMembers((prev) => prev.filter((m) => m.id !== userId))
    toast('Removed from workspace', {
      description: `${member?.name ?? 'That member'} no longer has access. Their history stays on past bookings.`,
    })
  }

  function handleResend(userId: string) {
    const member = members.find((m) => m.id === userId)
    toast.success('Email sent', { description: `Delivered to ${member?.email ?? 'their inbox'}.` })
  }

  function handleInvite({ emails, role }: { emails: string[]; role: Role; message: string }) {
    const createdAt = isoFromNow(NOW)
    const invited: User[] = emails.map((email) => {
      const seed = hashSeed(`${CURRENT_TENANT.id}::${email}`)
      return {
        id: `usr_inv_${seed.toString(36)}`,
        tenantId: CURRENT_TENANT.id,
        name: email
          .split('@')[0]
          .split(/[._-]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' '),
        email,
        role,
        avatarUrl: '',
        title: `${ROLE_META[role].label} · invitation pending`,
        status: 'invited',
        lastActiveAt: createdAt,
        isBookable: role === 'guide' || role === 'staff',
      }
    })

    setMembers((prev) => [...invited, ...prev])
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Team"
        description={`${members.length} people run ${CURRENT_TENANT.name}. Roles decide what each of them can see and change.`}
        actions={
          <Button size="sm" leftIcon={<UserPlus />} onClick={() => setInviteOpen(true)}>
            Invite people
          </Button>
        }
      />

      {/* ---------------- Summary ---------------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={<Users className="size-4" />}
          value={members.length}
          label="Workspace members"
          hint={`${members.length} of 15 seats on the Growth plan`}
        />
        <SummaryTile
          icon={<ShieldCheck className="size-4" />}
          value={bookableCount}
          label="Assignable to departures"
          hint="Captains, guides and instructors"
        />
        <SummaryTile
          icon={<UserPlus className="size-4" />}
          value={pendingCount}
          label="Invitations pending"
          hint={pendingCount === 0 ? 'Everyone has accepted' : 'Expire after seven days'}
        />
      </div>

      {/* ---------------- Roster ---------------- */}
      <Card>
        <CardHeader className="flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <CardTitle>Roster</CardTitle>
            <CardDescription>
              Change a role from the row menu. Changes take effect the next time that person loads
              the dashboard.
            </CardDescription>
          </div>
          <SearchInput
            label="Search team"
            placeholder="Name, email, certification…"
            debounceMs={120}
            onValueChange={setQuery}
            className="w-full sm:w-64"
          />
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            <RoleChip
              active={roleFilter === 'all'}
              label="Everyone"
              count={members.length}
              onClick={() => setRoleFilter('all')}
            />
            {ALL_ROLES.filter((r) => (roleCounts.get(r) ?? 0) > 0).map((r) => (
              <RoleChip
                key={r}
                active={roleFilter === r}
                label={ROLE_META[r].label}
                count={roleCounts.get(r) ?? 0}
                onClick={() => setRoleFilter(r)}
              />
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              variant="no-results"
              size="sm"
              title="Nobody matches that"
              description="Try a different name, or clear the role filter."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setRoleFilter('all')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <TeamTable
              members={visible}
              currentUserId={currentUserId}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
              onResendInvite={handleResend}
            />
          )}
        </CardContent>
      </Card>

      {/* ---------------- Permissions ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            What each role can do
          </CardTitle>
          <CardDescription>
            Permissions are additive and cannot be edited per person — pick the role that matches
            the job.
          </CardDescription>
        </CardHeader>

        <CardContent bleed className="pt-0">
          <div className="overflow-x-auto px-5 sm:px-6">
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Permissions by role</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-2.5 text-left text-xs font-semibold tracking-[0.08em] text-subtle uppercase"
                  >
                    Capability
                  </th>
                  {ALL_ROLES.map((role) => (
                    <th
                      key={role}
                      scope="col"
                      className="border-b border-line px-3 py-2.5 text-center"
                    >
                      <Badge variant={ROLE_META[role].variant} size="sm">
                        {ROLE_META[role].label}
                      </Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CAPABILITIES.map((capability) => (
                  <tr key={capability.key} className="transition-colors hover:bg-surface-sunken/50">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-line-subtle bg-surface px-3 py-3 text-left align-top"
                    >
                      <span className="block text-sm font-medium text-foreground">
                        {capability.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-subtle">
                        {capability.hint}
                      </span>
                    </th>
                    {ALL_ROLES.map((role) => {
                      const grant = capability.grants[role]
                      const meta = GRANT_META[grant]
                      const Icon = meta.icon
                      return (
                        <td
                          key={role}
                          className="border-b border-line-subtle px-3 py-3 text-center align-middle"
                        >
                          <SimpleTooltip label={meta.label}>
                            <span
                              tabIndex={0}
                              className={cn(
                                'inline-grid size-7 place-items-center rounded-lg',
                                grant === 'none' ? 'bg-transparent' : 'bg-surface-sunken',
                              )}
                            >
                              <Icon
                                className={cn('size-4', meta.className)}
                                strokeWidth={grant === 'full' ? 3 : 2}
                                aria-label={`${capability.label}: ${meta.label} for ${ROLE_META[role].label}`}
                              />
                            </span>
                          </SimpleTooltip>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 px-5 text-xs text-muted sm:px-6">
            {(['full', 'limited', 'view', 'none'] as Grant[]).map((grant) => {
              const meta = GRANT_META[grant]
              const Icon = meta.icon
              return (
                <span key={grant} className="inline-flex items-center gap-1.5">
                  <Icon className={cn('size-3.5', meta.className)} aria-hidden="true" />
                  {meta.label}
                </span>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvite={handleInvite}
        existingEmails={members.map((m) => m.email)}
      />
    </div>
  )
}

/* ========================================================================== */

function SummaryTile({
  icon,
  value,
  label,
  hint,
}: {
  icon: React.ReactNode
  value: number
  label: string
  hint: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tracking-tight text-foreground tabular">
          {value}
        </p>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-subtle">{hint}</p>
      </div>
    </div>
  )
}

function RoleChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5',
        'text-[0.8125rem] font-medium whitespace-nowrap',
        'transition-colors duration-200 ease-[var(--ease-out-expo)]',
        active
          ? 'border-primary/40 bg-primary-soft text-primary'
          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs tabular',
          active ? 'bg-primary/15' : 'bg-surface-sunken text-faint',
        )}
      >
        {count}
      </span>
    </button>
  )
}
