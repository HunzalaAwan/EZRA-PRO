'use client'

import * as React from 'react'

import { STAY_SEARCH_EVENT, defaultStaySearch, parseStaySearch, readStaySearchRaw, staySearchKey, writeStaySearch, type StaySearch } from '@/lib/stay-search'

function subscribe(slug: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === staySearchKey(slug)) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(STAY_SEARCH_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(STAY_SEARCH_EVENT, onChange)
  }
}

export function useStaySearch(slug: string, todayKey: string) {
  const raw = React.useSyncExternalStore(
    React.useCallback((cb) => subscribe(slug, cb), [slug]),
    () => readStaySearchRaw(slug),
    () => '',
  )
  const search = React.useMemo(() => (raw ? parseStaySearch(raw, todayKey) : defaultStaySearch(todayKey)), [raw, todayKey])
  const update = React.useCallback((change: Partial<StaySearch>) => writeStaySearch(slug, parseStaySearch(JSON.stringify({ ...parseStaySearch(readStaySearchRaw(slug), todayKey), ...change }), todayKey)), [slug, todayKey])
  return { search, update }
}
