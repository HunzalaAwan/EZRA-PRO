'use client'

import * as React from 'react'

import { CURRENT_TENANT } from '@/lib/demo-core'
import { getWorkspaceProfile, type WorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

/* ==========================================================================
   <WorkspaceProvider> — the current business, for every client component in
   the dashboard shell.

   Resolved once per request in the dashboard layout (from the workspace
   cookie) and handed down here, so the sidebar, topbar, palette and menus
   all agree on which business they are showing without any of them reading
   a cookie or importing the dataset.
   ========================================================================== */

export interface WorkspaceContextValue {
  tenant: Tenant
  profile: WorkspaceProfile
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ tenant, children }: { tenant: Tenant; children: React.ReactNode }) {
  const value = React.useMemo<WorkspaceContextValue>(
    () => ({ tenant, profile: getWorkspaceProfile(tenant.vertical) }),
    [tenant],
  )
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

/** Falls back to the default workspace outside the dashboard shell (storybook, storefront previews). */
export function useWorkspace(): WorkspaceContextValue {
  const value = React.useContext(WorkspaceContext)
  return (
    value ?? {
      tenant: CURRENT_TENANT,
      profile: getWorkspaceProfile(CURRENT_TENANT.vertical),
    }
  )
}
