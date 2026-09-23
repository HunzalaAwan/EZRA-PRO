import type { Metadata } from 'next'

import { PageTransition, RouteLoadingBar } from '@/components/motion/page-transition'
import { CommandPalette, CommandPaletteProvider } from '@/components/dashboard/command-palette'
import { Sidebar, type NavCounts } from '@/components/dashboard/sidebar'
import { Topbar } from '@/components/dashboard/topbar'
import { WorkspaceProvider } from '@/components/dashboard/workspace-provider'
import { countOpenAbandoned } from '@/lib/data/abandoned'
import { BOOKINGS, NOW, getDeparturesForDay, getNotifications } from '@/lib/demo'
import { getHospitalityCounts } from '@/lib/hospitality'
import { getWorkspaceTenant } from '@/lib/workspace'
import type { Tenant } from '@/types'
import { countOpenThreads } from '@/lib/inbox'
import { getWorkspaceProfile } from '@/lib/workspace-profile'

export const metadata: Metadata = {
  title: {
    default: 'Dashboard',
    template: '%s · EZRA Pro',
  },
}

/**
 * Nav count chips, computed once per request on the server. This — along
 * with `getNotifications` below — is the ONLY place in the dashboard shell
 * that touches `@/lib/demo`'s full dataset; every shell component receives
 * the result as a prop instead of importing the module itself, which is what
 * keeps the shared layout's client bundle (and every route that mounts
 * inside it) free of the multi-thousand-row generation.
 */
function computeNavCounts(tenant: Tenant): NavCounts {
  const pendingBookings = BOOKINGS.reduce(
    (total, booking) =>
      booking.tenantId === tenant.id && booking.status === 'pending' ? total + 1 : total,
    0,
  )
  return {
    pendingBookings,
    todayDepartures: getDeparturesForDay(tenant.id, NOW).length,
    unreadMessages: getNotifications(tenant.id).filter((n) => !n.read).length,
    abandonedCarts: countOpenAbandoned(tenant),
    openConversations: getWorkspaceProfile(tenant.vertical).family === 'experiences' ? countOpenThreads(tenant.id) : 0,
    ...getHospitalityCounts(tenant),
  }
}

/**
 * The operator shell: a collapsible rail, a glass topbar and one scrolling
 * content column. Every dashboard route renders inside it.
 *
 * The command palette lives at this level so ⌘K is registered exactly once and
 * the topbar search button can reach the same state through context.
 *
 * `<Toaster />` is intentionally NOT mounted here — the root layout already
 * mounts it, and Sonner renders every toast once per mounted Toaster.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getWorkspaceTenant()
  const navCounts = computeNavCounts(tenant)
  const notifications = getNotifications(tenant.id)

  return (
    <WorkspaceProvider tenant={tenant}>
    <CommandPaletteProvider>
      <RouteLoadingBar />

      <a
        href="#dashboard-content"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]"
      >
        Skip to content
      </a>

      <div className="dash-type flex min-h-dvh bg-background-dashboard">
        <Sidebar navCounts={navCounts} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar navCounts={navCounts} notifications={notifications} />

          <main
            id="dashboard-content"
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
          >
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>

      <CommandPalette />
    </CommandPaletteProvider>
    </WorkspaceProvider>
  )
}
