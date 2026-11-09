'use client'

import * as React from 'react'

import { detachSharedGroup, groupFromModifier, normaliseGroup, normaliseItem } from '@/lib/hospitality/menu-pricing'
import { MENU_EVENT, menuKey, mergeMenu, readMenuRaw, writeMenu } from '@/lib/hospitality/menu-store'
import type { Menu, MenuCategory, MenuGroupRef, MenuItem, MenuItemStatus, MenuOptionGroup } from '@/lib/hospitality/types'

/* ==========================================================================
   useMenu — one business's menu with the owner's edits laid over the seed.
   The dashboard writes it; the ordering page and phone orders read it.
   The server snapshot is '' so the first render is the seed and hydration
   always matches; saved edits arrive straight after.
   ========================================================================== */

function subscribe(tenantId: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === menuKey(tenantId)) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(MENU_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(MENU_EVENT, onChange)
  }
}

const withoutLinksTo = (refs: MenuGroupRef[], itemId: string): MenuGroupRef[] =>
  refs.map((ref) => (ref.type === 'own' ? { type: 'own', group: { ...ref.group, options: ref.group.options.filter((o) => o.itemId !== itemId) } } : ref))

export function useMenu(tenantId: string, seed: Menu) {
  const raw = React.useSyncExternalStore(
    React.useCallback((cb: () => void) => subscribe(tenantId, cb), [tenantId]),
    () => readMenuRaw(tenantId),
    () => '',
  )
  const menu = React.useMemo(() => mergeMenu(seed, raw), [seed, raw])

  const commit = React.useCallback(
    (change: (current: Menu) => Menu) => writeMenu(tenantId, change(mergeMenu(seed, readMenuRaw(tenantId)))),
    [tenantId, seed],
  )

  const saveItem = React.useCallback(
    (item: MenuItem) =>
      commit((m) => {
        const clean = normaliseItem(item)
        const exists = m.items.some((i) => i.id === clean.id)
        return { ...m, items: exists ? m.items.map((i) => (i.id === clean.id ? clean : i)) : [...m.items, clean] }
      }),
    [commit],
  )

  /** Also drops options in other dishes and saved groups that linked to it. */
  const removeItem = React.useCallback(
    (itemId: string) =>
      commit((m) => ({
        ...m,
        sharedGroups: (m.sharedGroups ?? []).map((g) => ({ ...g, options: g.options.filter((o) => o.itemId !== itemId) })),
        items: m.items
          .filter((i) => i.id !== itemId)
          .map((i) => {
            const next: MenuItem = { ...i }
            if (i.groups) next.groups = withoutLinksTo(i.groups, itemId)
            if (i.meal) next.meal = { ...i.meal, groups: withoutLinksTo(i.meal.groups, itemId) }
            return next
          }),
      })),
    [commit],
  )

  const setItemStatus = React.useCallback(
    (itemId: string, status: MenuItemStatus) => commit((m) => ({ ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, status } : i)) })),
    [commit],
  )

  /** itemId absent = a saved group. For a dish, its own group in the dish or its meal; old-style choices are converted first. */
  const setOptionSoldOut = React.useCallback(
    (ref: { itemId?: string; groupId: string; optionId: string }, soldOut: boolean) =>
      commit((m) => {
        const flip = (group: MenuOptionGroup): MenuOptionGroup =>
          group.id !== ref.groupId ? group : { ...group, options: group.options.map((o) => (o.id === ref.optionId ? { ...o, soldOut } : o)) }
        if (!ref.itemId) return { ...m, sharedGroups: (m.sharedGroups ?? []).map(flip) }
        const flipRefs = (refs: MenuGroupRef[]): MenuGroupRef[] => refs.map((r) => (r.type === 'own' ? { type: 'own', group: flip(r.group) } : r))
        return {
          ...m,
          items: m.items.map((i) => {
            if (i.id !== ref.itemId) return i
            const groups: MenuGroupRef[] = i.groups ?? i.modifiers.map((mod) => ({ type: 'own', group: groupFromModifier(mod) }))
            const next: MenuItem = { ...i, groups: flipRefs(groups), modifiers: [] }
            if (i.meal) next.meal = { ...i.meal, groups: flipRefs(i.meal.groups) }
            return next
          }),
        }
      }),
    [commit],
  )

  /** Dishes in removed sections move to the first section left. */
  const saveCategories = React.useCallback(
    (categories: MenuCategory[], removedIds: string[]) =>
      commit((m) => {
        const removed = new Set(removedIds)
        const kept = categories.filter((c) => !removed.has(c.id))
        const fallback = kept[0]?.id
        return {
          ...m,
          categories: kept,
          items: m.items.map((i) => (fallback && (removed.has(i.categoryId) || !kept.some((c) => c.id === i.categoryId)) ? { ...i, categoryId: fallback } : i)),
        }
      }),
    [commit],
  )

  const saveSharedGroup = React.useCallback(
    (group: MenuOptionGroup) =>
      commit((m) => {
        const clean = normaliseGroup(group)
        const list = m.sharedGroups ?? []
        const exists = list.some((g) => g.id === clean.id)
        return { ...m, sharedGroups: exists ? list.map((g) => (g.id === clean.id ? clean : g)) : [...list, clean] }
      }),
    [commit],
  )

  /** Dishes that used it keep their own copy. */
  const removeSharedGroup = React.useCallback(
    (groupId: string) =>
      commit((m) => {
        const detached = detachSharedGroup(m, groupId)
        return { ...detached, sharedGroups: (detached.sharedGroups ?? []).filter((g) => g.id !== groupId) }
      }),
    [commit],
  )

  const replace = React.useCallback((next: Menu) => writeMenu(tenantId, next), [tenantId])
  const reset = React.useCallback(() => writeMenu(tenantId, null), [tenantId])

  return {
    menu,
    edited: raw !== '',
    saveItem,
    removeItem,
    setItemStatus,
    setOptionSoldOut,
    saveCategories,
    saveSharedGroup,
    removeSharedGroup,
    replace,
    reset,
  }
}
