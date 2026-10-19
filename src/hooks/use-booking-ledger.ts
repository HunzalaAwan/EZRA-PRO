'use client'

import * as React from 'react'

import { LEDGER_EVENT, ledgerKey, parseLedger, seatDeltas, type LedgerStore } from '@/lib/booking-ledger'

/* ==========================================================================
   useBookingLedger — the browser's bookings and booking changes, live, with
   the seats each departure gains or loses from them.
   ========================================================================== */

export function useBookingLedger(slug: string): LedgerStore & { delta: Record<string, number> } {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(LEDGER_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(LEDGER_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(ledgerKey(slug)) ?? ''
      } catch {
        return ''
      }
    },
    () => '',
  )
  return React.useMemo(() => {
    const store = parseLedger(raw || null)
    return { ...store, delta: seatDeltas(store) }
  }, [raw])
}
