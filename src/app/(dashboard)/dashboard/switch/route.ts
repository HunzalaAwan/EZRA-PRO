import { NextResponse, type NextRequest } from 'next/server'

import { tenantById } from '@/lib/demo-core'
import { WORKSPACE_COOKIE } from '@/lib/workspace'

/**
 * GET /dashboard/switch?to=<tenantId>&next=/dashboard/...
 *
 * Writes the workspace cookie and sends the operator on. A plain redirect
 * rather than a server action so the tenant switcher, a bookmark and a
 * headless screenshot run can all use the same door.
 */
export function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to') ?? ''
  const next = request.nextUrl.searchParams.get('next') ?? '/dashboard'
  const safeNext = next.startsWith('/dashboard') ? next : '/dashboard'

  const response = NextResponse.redirect(new URL(safeNext, request.url), 303)
  if (tenantById.has(to)) {
    response.cookies.set(WORKSPACE_COOKIE, to, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }
  return response
}
