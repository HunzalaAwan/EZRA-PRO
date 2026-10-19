import { cleanCode } from '@/lib/marketing'
import type { PromoCode } from '@/lib/pricing'

import { walkSteps } from './tree'
import type { Flow } from './types'

/* ==========================================================================
   Automation codes in Promo codes. A "Give a discount code" step hands each
   guest their own code, PREFIX-XXXX. Checkout knows them through one promo
   per prefix, marked per guest, so it takes any PREFIX-XXXX. These keep
   that promo in line with the automations: on while one is live, off when
   it is paused, deleted or no longer gives that code.
   ========================================================================== */

/** The note on an automation's code in Promo codes. */
export function flowPromoNote(flow: Pick<Flow, 'name'>): string {
  return `From the “${flow.name}” automation`
}

/** The prefix every guest's code starts with, as checkout reads it. The engine makes codes the same way. */
export function codePrefix(prefix: string | undefined): string {
  return cleanCode(prefix ?? '') || 'CODE'
}

/** The codes a flow gives, by prefix. */
export function flowCodes(flow: Flow): { prefix: string; percent: number }[] {
  const out: { prefix: string; percent: number }[] = []
  walkSteps(flow.steps, (step) => {
    if (step.type !== 'action' || step.action !== 'give_code') return
    const prefix = codePrefix(step.code?.prefix ?? 'THANKS')
    if (!out.some((entry) => entry.prefix === prefix)) out.push({ prefix, percent: step.code?.percent ?? 10 })
  })
  return out
}

/**
 * Promo codes with every live automation's codes in them and the codes of automations that stopped
 * switched off. A code another source owns (a campaign, the pop-up, one the owner made) is left
 * alone. `reactivate`: switch an automation's code back on if it was off (after a save or turning
 * it on); a passing check leaves a code the owner switched off as it is.
 * Returns the same array when nothing changes.
 */
export function syncFlowPromos(promos: PromoCode[], flows: Flow[], options: { reactivate?: boolean } = {}): PromoCode[] {
  const wanted = new Map<string, { flow: Flow; percent: number }>()
  for (const flow of flows) {
    if (flow.status !== 'live') continue
    for (const code of flowCodes(flow)) if (!wanted.has(code.prefix)) wanted.set(code.prefix, { flow, percent: code.percent })
  }
  let changed = false
  let next = promos.map((promo) => {
    if (!promo.flowId || !promo.active) return promo
    const want = wanted.get(promo.code)
    if (want && want.flow.id === promo.flowId) return promo
    // Taken over by another live automation with the same prefix: it follows that one.
    if (want) return promo
    changed = true
    return { ...promo, active: false }
  })
  for (const [code, { flow, percent }] of wanted) {
    const existing = next.find((promo) => promo.code === code)
    const note = flowPromoNote(flow)
    if (existing && !existing.flowId && existing.note !== note) continue
    const value = Math.min(100, Math.max(1, Math.round(percent)))
    const promo: PromoCode = {
      code,
      kind: existing?.kind ?? 'percent',
      value: existing && existing.kind !== 'percent' ? existing.value : value,
      activitySlugs: existing?.activitySlugs ?? [],
      minSubtotal: existing?.minSubtotal ?? 0,
      startsOn: existing?.startsOn,
      endsOn: existing?.endsOn,
      maxUses: existing?.maxUses ?? 100000,
      used: existing?.used ?? 0,
      active: existing ? existing.active || Boolean(options.reactivate) : true,
      note,
      perGuest: true,
      flowId: flow.id,
    }
    if (
      existing &&
      existing.value === promo.value &&
      existing.active === promo.active &&
      existing.note === promo.note &&
      existing.perGuest === true &&
      existing.flowId === promo.flowId
    )
      continue
    changed = true
    next = existing ? next.map((entry) => (entry.code === code ? promo : entry)) : [promo, ...next]
  }
  return changed ? next : promos
}
