'use server'

import { searchEverything, type SearchResults } from '@/lib/demo'

/**
 * The ONLY bridge the command palette has into `@/lib/demo`'s full dataset.
 *
 * A Server Action's body — and everything it imports — runs exclusively on
 * the server; Next.js gives the client a small RPC stub instead of the real
 * function. That is what lets `CommandPalette` (mounted on every dashboard
 * page) search live across bookings and customers without ever bundling, or
 * re-running, the multi-thousand-row generation in the browser.
 */
export async function searchCommandPalette(tenantId: string, query: string): Promise<SearchResults> {
  return searchEverything(tenantId, query)
}
