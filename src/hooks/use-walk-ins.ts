'use client'

import * as React from 'react'

import type { WalkInRecord, WalkInStatus } from '@/lib/walk-ins'

/* ==========================================================================
   The walk-in log for one business: sales made in this browser, laid over
   the seeded history, plus status changes (checked in, refunded) and the
   end-of-day cash count. Read after mount so SSR and hydration agree.
   ========================================================================== */

interface Stored {
  sales: WalkInRecord[]
  status: Record<string, WalkInStatus>
  cashUps: Record<string, { counted: number; at: string }>
}

const EMPTY: Stored = { sales: [], status: {}, cashUps: {} }
const keyFor = (slug: string) => `ezra:walkins:v2:${slug}`

export function useWalkIns(tenantSlug: string, seed: WalkInRecord[]) {
  const [stored, setStored] = React.useState<Stored>(EMPTY)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(keyFor(tenantSlug))
      if (raw) setStored({ ...EMPTY, ...(JSON.parse(raw) as Partial<Stored>) })
    } catch {
      /* storage blocked: start empty */
    }
  }, [tenantSlug])

  const write = React.useCallback(
    (next: (current: Stored) => Stored) =>
      setStored((current) => {
        const value = next(current)
        try {
          window.localStorage.setItem(keyFor(tenantSlug), JSON.stringify(value))
        } catch {
          /* storage blocked: the change lives until reload */
        }
        return value
      }),
    [tenantSlug],
  )

  const records = React.useMemo(
    () =>
      [...stored.sales, ...seed]
        .map((record) => (stored.status[record.reference] ? { ...record, status: stored.status[record.reference] } : record))
        .sort((a, b) => b.soldAt.localeCompare(a.soldAt)),
    [stored, seed],
  )

  return {
    records,
    cashUps: stored.cashUps,
    add: (record: WalkInRecord) => write((current) => ({ ...current, sales: [record, ...current.sales].slice(0, 500) })),
    setStatus: (reference: string, status: WalkInStatus) =>
      write((current) => ({ ...current, status: { ...current.status, [reference]: status } })),
    saveCashUp: (dateKey: string, counted: number) =>
      write((current) => ({ ...current, cashUps: { ...current.cashUps, [dateKey]: { counted, at: new Date().toISOString() } } })),
  }
}
