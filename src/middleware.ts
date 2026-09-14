import { NextResponse, type NextRequest } from 'next/server'

/**
 * Multi-tenant request routing.
 *
 * EZRA Pro resolves a tenant in two ways, in priority order:
 *
 *   1. Subdomain      blue-horizon.ezrapro.com/...   -> rewritten to /book/blue-horizon/...
 *   2. Path           /book/blue-horizon/...          -> used as-is
 *
 * Subdomains are the production storefront surface (operators hand them out and
 * can CNAME a custom domain at them). The path form is what local development
 * and preview deploys use, since wildcard subdomains are not available there.
 *
 * The resolved tenant slug is forwarded on the `x-tenant-slug` header so server
 * components can read it without re-parsing the host.
 */

/** Hosts that are the marketing/app surface, never a tenant storefront. */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'app',
  'admin',
  'api',
  'docs',
  'help',
  'status',
  'staging',
  'preview',
])

const ROOT_DOMAINS = ['ezrapro.com', 'localhost']

function resolveTenantFromHost(host: string): string | null {
  // Strip port, normalise.
  const hostname = host.split(':')[0].toLowerCase()

  // Vercel preview URLs and bare IPs never carry a tenant subdomain.
  if (hostname.endsWith('.vercel.app') || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return null
  }

  const root = ROOT_DOMAINS.find((d) => hostname === d || hostname.endsWith(`.${d}`))
  if (!root) return null

  if (hostname === root) return null

  const subdomain = hostname.slice(0, -(root.length + 1))
  // Only a single label is a tenant slug; deeper nesting is not a storefront.
  if (!subdomain || subdomain.includes('.')) return null
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null

  return subdomain
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  const headers = new Headers(request.headers)

  // Path-based tenancy: /book/<slug>/...
  const pathMatch = pathname.match(/^\/book\/([^/]+)/)
  if (pathMatch) {
    headers.set('x-tenant-slug', pathMatch[1])
    headers.set('x-tenant-source', 'path')
    return NextResponse.next({ request: { headers } })
  }

  const subdomainTenant = resolveTenantFromHost(host)
  if (subdomainTenant) {
    headers.set('x-tenant-slug', subdomainTenant)
    headers.set('x-tenant-source', 'subdomain')

    // Rewrite the subdomain root onto the storefront route tree so a single set
    // of components serves both addressing schemes.
    const url = request.nextUrl.clone()
    url.pathname = `/book/${subdomainTenant}${pathname === '/' ? '' : pathname}`
    url.search = search
    return NextResponse.rewrite(url, { request: { headers } })
  }

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Keeping images and
     * fonts out of the matcher avoids a needless middleware invocation per asset.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)',
  ],
}
