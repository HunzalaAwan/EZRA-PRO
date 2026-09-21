'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, ChevronsUpDown, Plus, Settings2 } from 'lucide-react'

import type { PlanTier, Tenant, VerticalKey } from '@/types'
import { cn } from '@/lib/utils'
import { TENANTS } from '@/lib/demo-core'
import { useWorkspace } from '@/components/dashboard/workspace-provider'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   TENANT SWITCHER

   Switching workspaces writes the workspace cookie through /dashboard/switch
   and reloads on the overview, so every server component re-reads the new
   business: a restaurant gets tables and orders, a hotel gets a front desk.
   ========================================================================== */

const VERTICAL_LABEL: Record<VerticalKey, string> = {
  watersports: 'Watersports',
  tours: 'Tours & sightseeing',
  restaurants: 'Restaurants',
  hotels: 'Hotels & stays',
  adventure: 'Adventure',
  island: 'Island & resort',
  wellness: 'Wellness',
}

const PLAN_BADGE: Record<PlanTier, BadgeVariant> = {
  starter: 'neutral',
  growth: 'primary',
  scale: 'accent',
  enterprise: 'info',
}

/**
 * Stable per-workspace tint. Index-keyed rather than hashed so the four demo
 * workspaces always read as four distinct colours in the list.
 */
const TINTS = [
  'bg-chart-1/18 text-chart-1',
  'bg-chart-3/18 text-chart-3',
  'bg-chart-5/18 text-chart-5',
  'bg-chart-7/18 text-chart-7',
] as const

function tintFor(tenantId: string) {
  const index = TENANTS.findIndex((t) => t.id === tenantId)
  return TINTS[(index < 0 ? 0 : index) % TINTS.length]
}

function WorkspaceMark({
  tenant,
  className,
  active = false,
}: {
  tenant: Pick<Tenant, 'id' | 'name'>
  className?: string
  active?: boolean
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 place-items-center rounded-lg font-display text-[0.8125rem] font-bold',
        'ring-1 ring-inset ring-line-subtle',
        active ? 'bg-primary text-on-primary ring-transparent' : tintFor(tenant.id),
        className,
      )}
    >
      {tenant.name.charAt(0)}
    </span>
  )
}

export interface TenantSwitcherProps {
  /** Icon-rail presentation: mark only, with the name moved into a tooltip. */
  collapsed?: boolean
  className?: string
}

export function TenantSwitcher({ collapsed = false, className }: TenantSwitcherProps) {
  const [open, setOpen] = React.useState(false)
  const { tenant: active } = useWorkspace()

  const select = React.useCallback(
    (tenant: Tenant) => {
      if (tenant.id === active.id) {
        toast.success(`Already in ${tenant.name}`)
        return
      }
      toast(`Switching to ${tenant.name}`, {
        description: `${VERTICAL_LABEL[tenant.vertical]} · ${tenant.city}, ${tenant.country}`,
      })
      window.location.assign(`/dashboard/switch?to=${encodeURIComponent(tenant.id)}`)
    },
    [active.id],
  )

  const trigger = collapsed ? (
    <button
      type="button"
      aria-label={`Workspace: ${active.name}. Switch workspace`}
      className={cn(
        'group mx-auto grid size-10 place-items-center rounded-xl border border-line bg-surface',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'hover:border-line-strong hover:bg-surface-sunken active:scale-[0.96]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'data-[state=open]:border-line-strong data-[state=open]:bg-surface-sunken',
      )}
    >
      <WorkspaceMark tenant={active} active className="size-7 text-xs" />
    </button>
  ) : (
    <button
      type="button"
      aria-label={`Workspace: ${active.name}. Switch workspace`}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-1.5 pr-2.5 text-left',
        'shadow-xs transition-all duration-200 ease-[var(--ease-out-expo)]',
        'hover:border-line-strong hover:bg-surface-sunken',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'data-[state=open]:border-line-strong data-[state=open]:bg-surface-sunken',
      )}
    >
      <WorkspaceMark tenant={active} active className="size-8" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-semibold tracking-[-0.01em] text-foreground">
          {active.name}
        </span>
        <span className="block truncate text-[0.6875rem] text-subtle capitalize">
          {active.plan} · {active.city}
        </span>
      </span>
      <ChevronsUpDown
        aria-hidden="true"
        className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-subtle"
      />
    </button>
  )

  // Radix Slot composes cleanly the other way round: the tooltip trigger wraps
  // the menu trigger, and both merge their props onto the same button.
  const menuTrigger = <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <SimpleTooltip label={active.name} side="right">
          {menuTrigger}
        </SimpleTooltip>
      ) : (
        menuTrigger
      )}

      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn('w-[17.5rem]', className)}
      >
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>

        {TENANTS.map((tenant) => {
          const isActive = tenant.id === active.id
          return (
            <DropdownMenuItem
              key={tenant.id}
              onSelect={() => select(tenant)}
              className="gap-2.5 py-2"
            >
              <WorkspaceMark tenant={tenant} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] font-medium text-foreground">
                    {tenant.name}
                  </span>
                  {tenant.status === 'trialing' ? (
                    <Badge variant="warning" size="sm" className="shrink-0">
                      Trial
                    </Badge>
                  ) : null}
                </span>
                <span className="block truncate text-[0.6875rem] text-subtle">
                  {VERTICAL_LABEL[tenant.vertical]}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge variant={PLAN_BADGE[tenant.plan]} size="sm" className="capitalize">
                  {tenant.plan}
                </Badge>
                {isActive ? (
                  <Check aria-hidden="true" className="size-4 text-primary" />
                ) : (
                  <span aria-hidden="true" className="size-4" />
                )}
              </span>
            </DropdownMenuItem>
          )
        })}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() =>
            toast('Create a workspace', {
              description: 'Workspace provisioning opens in the onboarding flow.',
            })
          }
        >
          <Plus aria-hidden="true" />
          Create workspace
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings2 aria-hidden="true" />
            Workspace settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
