'use client'

import * as React from 'react'
import {
  BadgeCheck,
  Crown,
  Ellipsis,
  KeyRound,
  Mail,
  ShieldCheck,
  Trash2,
  UserMinus,
} from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { NOW } from '@/lib/demo-core'
import { cn, formatRelative } from '@/lib/utils'
import type { Role, User } from '@/types'

/* ==========================================================================
   ROLE VOCABULARY — shared with the permissions matrix on the page
   ========================================================================== */

export const ROLE_META: Record<
  Role,
  { label: string; variant: BadgeVariant; blurb: string }
> = {
  owner: {
    label: 'Owner',
    variant: 'primary',
    blurb: 'Full control, including billing and workspace deletion.',
  },
  admin: {
    label: 'Admin',
    variant: 'accent',
    blurb: 'Everything except billing and destructive workspace actions.',
  },
  manager: {
    label: 'Manager',
    variant: 'info',
    blurb: 'Runs the schedule, pricing and the team roster.',
  },
  staff: {
    label: 'Staff',
    variant: 'neutral',
    blurb: 'Takes bookings, checks guests in, handles the desk.',
  },
  guide: {
    label: 'Guide',
    variant: 'success',
    blurb: 'Sees only their own departures and manifests.',
  },
  viewer: {
    label: 'Viewer',
    variant: 'outline',
    blurb: 'Read-only access to reports. Cannot change anything.',
  },
}

export const ASSIGNABLE_ROLES: Role[] = ['admin', 'manager', 'staff', 'guide', 'viewer']

const STATUS_META: Record<User['status'], { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  invited: { label: 'Invited', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'danger' },
}

/* ==========================================================================
   TABLE
   ========================================================================== */

export interface TeamTableProps {
  members: User[]
  currentUserId: string
  onRoleChange: (userId: string, role: Role) => void
  onRemove: (userId: string) => void
  onResendInvite: (userId: string) => void
  className?: string
}

export function TeamTable({
  members,
  currentUserId,
  onRoleChange,
  onRemove,
  onResendInvite,
  className,
}: TeamTableProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {/* ---------------- Desktop ---------------- */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full caption-bottom border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="[&_th]:border-b [&_th]:border-line">
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Certifications</Th>
              <Th>Status</Th>
              <Th align="right">Last active</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr
                key={member.id}
                className="group transition-colors duration-150 hover:bg-surface-sunken/60"
              >
                <Td className="min-w-64">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={member.name}
                      src={member.avatarUrl}
                      size="md"
                      status={member.status === 'active' ? 'online' : 'offline'}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        {member.name}
                        {member.id === currentUserId ? (
                          <Badge variant="outline" size="sm">
                            You
                          </Badge>
                        ) : null}
                        {member.role === 'owner' ? (
                          <SimpleTooltip label="Workspace owner">
                            <span className="inline-flex shrink-0" tabIndex={0}>
                              <Crown
                                className="size-3.5 text-warning"
                                aria-label="Workspace owner"
                              />
                            </span>
                          </SimpleTooltip>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted">{member.title}</p>
                      <p className="truncate text-xs text-subtle">{member.email}</p>
                    </div>
                  </div>
                </Td>

                <Td>
                  <Badge variant={ROLE_META[member.role].variant} size="sm">
                    {ROLE_META[member.role].label}
                  </Badge>
                  {member.isBookable ? (
                    <p className="mt-1 text-[0.6875rem] text-subtle">Assignable to departures</p>
                  ) : null}
                </Td>

                <Td className="max-w-56">
                  <CertificationList certifications={member.certifications} />
                </Td>

                <Td>
                  <Badge variant={STATUS_META[member.status].variant} size="sm" dot>
                    {STATUS_META[member.status].label}
                  </Badge>
                </Td>

                <Td align="right" className="whitespace-nowrap text-xs text-muted tabular">
                  {formatRelative(member.lastActiveAt, NOW)}
                </Td>

                <Td align="right">
                  <RowMenu
                    member={member}
                    isSelf={member.id === currentUserId}
                    onRoleChange={onRoleChange}
                    onRemove={onRemove}
                    onResendInvite={onResendInvite}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------------- Mobile ---------------- */}
      <ul className="flex flex-col gap-2 md:hidden">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5"
          >
            <div className="flex items-start gap-3">
              <Avatar name={member.name} src={member.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  {member.name}
                  {member.id === currentUserId ? (
                    <Badge variant="outline" size="sm">
                      You
                    </Badge>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted">{member.title}</p>
                <p className="truncate text-xs text-subtle">{member.email}</p>
              </div>
              <RowMenu
                member={member}
                isSelf={member.id === currentUserId}
                onRoleChange={onRoleChange}
                onRemove={onRemove}
                onResendInvite={onResendInvite}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={ROLE_META[member.role].variant} size="sm">
                {ROLE_META[member.role].label}
              </Badge>
              <Badge variant={STATUS_META[member.status].variant} size="sm" dot>
                {STATUS_META[member.status].label}
              </Badge>
              <span className="ml-auto text-xs text-subtle tabular">
                {formatRelative(member.lastActiveAt, NOW)}
              </span>
            </div>

            {member.certifications?.length ? (
              <CertificationList certifications={member.certifications} />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ========================================================================== */

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      scope="col"
      className={cn(
        'h-10 px-4 align-middle text-[0.6875rem] font-semibold tracking-[0.08em] whitespace-nowrap text-subtle uppercase',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  className,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td
      className={cn(
        'border-b border-line-subtle px-4 py-3 align-middle',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </td>
  )
}

function CertificationList({ certifications }: { certifications?: string[] }) {
  if (!certifications || certifications.length === 0) {
    return <span className="text-xs text-faint">—</span>
  }

  const [first, ...rest] = certifications

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant="outline" size="sm" className="max-w-44 truncate">
        <BadgeCheck className="size-3 shrink-0 text-success" aria-hidden="true" />
        <span className="truncate">{first}</span>
      </Badge>
      {rest.length > 0 ? (
        <SimpleTooltip label={rest.join(' · ')}>
          <Badge variant="neutral" size="sm" className="cursor-default" tabIndex={0}>
            +{rest.length}
          </Badge>
        </SimpleTooltip>
      ) : null}
    </div>
  )
}

function RowMenu({
  member,
  isSelf,
  onRoleChange,
  onRemove,
  onResendInvite,
}: {
  member: User
  isSelf: boolean
  onRoleChange: (userId: string, role: Role) => void
  onRemove: (userId: string) => void
  onResendInvite: (userId: string) => void
}) {
  const locked = member.role === 'owner'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={`Actions for ${member.name}`}
          className="opacity-70 transition-opacity group-hover:opacity-100"
        >
          <Ellipsis />
        </IconButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Role</DropdownMenuLabel>
        {locked ? (
          <div className="flex items-start gap-2.5 px-2.5 py-2 text-xs text-muted">
            <Crown className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            The owner role can only be transferred from billing settings.
          </div>
        ) : (
          <DropdownMenuRadioGroup
            value={member.role}
            onValueChange={(value) => onRoleChange(member.id, value as Role)}
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <DropdownMenuRadioItem key={role} value={role}>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm">{ROLE_META[role].label}</span>
                  <span className="text-xs text-subtle">{ROLE_META[role].blurb}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => onResendInvite(member.id)}>
          <Mail />
          {member.status === 'invited' ? 'Resend invitation' : 'Send a message'}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <KeyRound />
          Reset password
        </DropdownMenuItem>
        <DropdownMenuItem>
          <ShieldCheck />
          View audit log
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          tone="danger"
          disabled={locked || isSelf}
          onSelect={() => onRemove(member.id)}
        >
          {member.status === 'invited' ? <Trash2 /> : <UserMinus />}
          {member.status === 'invited' ? 'Revoke invitation' : 'Remove from workspace'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
