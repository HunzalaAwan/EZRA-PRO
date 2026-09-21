import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { CURRENT_TENANT, tenantById } from '@/lib/demo-core'
import { getWorkspaceProfile, type WorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

/* ==========================================================================
   The current workspace, server side.

   The signed-in operator can belong to several businesses. Which one the
   dashboard is showing lives in one cookie, written by /dashboard/switch and
   read here on every request. Client components never read the cookie: the
   dashboard layout resolves it once and hands the result down through
   <WorkspaceProvider>.
   ========================================================================== */

export const WORKSPACE_COOKIE = 'ezra-workspace'

export async function getWorkspaceTenant(): Promise<Tenant> {
  try {
    const store = await cookies()
    const id = store.get(WORKSPACE_COOKIE)?.value
    if (id) {
      const tenant = tenantById.get(id)
      if (tenant) return tenant
    }
  } catch {
    /* outside a request scope (static analysis, tests): fall through */
  }
  return CURRENT_TENANT
}

export interface Workspace {
  tenant: Tenant
  profile: WorkspaceProfile
}

export async function getWorkspace(): Promise<Workspace> {
  const tenant = await getWorkspaceTenant()
  return { tenant, profile: getWorkspaceProfile(tenant.vertical) }
}

/**
 * Every page that belongs to one family calls this first: a restaurant that
 * opens /dashboard/manifest lands on its floor plan, a dive shop that opens
 * /dashboard/orders lands on its bookings. Returns the workspace otherwise.
 */
export async function requireWorkspaceRoute(pathname: string): Promise<Workspace> {
  const workspace = await getWorkspace()
  const target = workspace.profile.redirects[pathname]
  if (target) redirect(target)
  return workspace
}
