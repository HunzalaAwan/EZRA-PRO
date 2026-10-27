'use client'

import * as React from 'react'

import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { ledgerHolds, transferOf, type TransferHold, type TransferSource } from '@/lib/transfers'
import type { Activity } from '@/types'

const NO_HOLDS: TransferHold[] = []

/**
 * Which vehicles are out when, as this browser sees it: the server's seeded
 * rides (`buildTransferAvailability`), less the seeded bookings this browser
 * moved or cancelled, plus every ride booked or changed here (the ledger).
 * On the server and the first render the ledger is empty, so the widget,
 * checkout and the manage page render the same thing on both sides.
 */
export function useTransferHolds(
  activity: TransferSource & Pick<Activity, 'slug'>,
  tenantSlug: string,
  serverHolds: TransferHold[] = NO_HOLDS,
): TransferHold[] {
  const ledger = useBookingLedger(tenantSlug)
  return React.useMemo(() => {
    if (!transferOf(activity)) return NO_HOLDS
    const local = ledgerHolds(activity, ledger)
    if (local.holds.length === 0 && local.replaced.length === 0) return serverHolds
    const replaced = new Set(local.replaced)
    // A booking made in this browser is in the ledger already; never count it twice.
    const own = new Set(local.holds.map((hold) => hold.reference))
    return [...serverHolds.filter((hold) => !replaced.has(hold.reference) && !own.has(hold.reference)), ...local.holds]
  }, [activity, ledger, serverHolds])
}
