import { newId } from './catalog'
import type { BranchStep, EmailStep, Flow, FlowCredit, FlowRun, FlowStep, SmsStep, SplitStep } from './types'

/* ==========================================================================
   Flow tree — pure helpers over the nested steps of an automation. Steps
   live in lists; questions (branch) hold a yes and a no list, A/B tests
   (split) hold an a and a b list. Every change returns new arrays along the
   changed path and leaves the rest shared, so React can compare cheaply.
   ========================================================================== */

export type PathKey = 'yes' | 'no' | 'a' | 'b'

/** A step that holds other steps. */
export type ParentStep = BranchStep | SplitStep

export interface StepPosition {
  /** The question or test holding it. Absent at the top level. */
  parentId?: string
  /** Which side of the parent. Absent at the top level. */
  branch?: PathKey
  index: number
}

export interface WalkInfo {
  depth: number
  parent?: ParentStep
  branch?: PathKey
  index: number
  /** The list the step sits in. */
  list: FlowStep[]
}

export function isParent(step: FlowStep): step is ParentStep {
  return step.type === 'branch' || step.type === 'split'
}

/** The sides of a question or test, in display order. */
export function childPaths(step: FlowStep): [PathKey, FlowStep[]][] {
  if (step.type === 'branch') return [['yes', step.yes], ['no', step.no]]
  if (step.type === 'split') return [['a', step.a], ['b', step.b]]
  return []
}

function withPath(step: ParentStep, key: PathKey, list: FlowStep[]): ParentStep {
  if (step.type === 'branch') return key === 'yes' ? { ...step, yes: list } : key === 'no' ? { ...step, no: list } : step
  return key === 'a' ? { ...step, a: list } : key === 'b' ? { ...step, b: list } : step
}

/** Visit every step depth first, in reading order. Return false from `fn` to skip a step's paths. */
export function walkSteps(
  steps: FlowStep[],
  fn: (step: FlowStep, info: WalkInfo) => void | false,
  depth = 0,
  parent?: ParentStep,
  branch?: PathKey,
): void {
  steps.forEach((step, index) => {
    const goOn = fn(step, { depth, parent, branch, index, list: steps })
    if (goOn === false || !isParent(step)) return
    for (const [key, list] of childPaths(step)) walkSteps(list, fn, depth + 1, step, key)
  })
}

export function findStep(steps: FlowStep[], id: string): FlowStep | undefined {
  for (const step of steps) {
    if (step.id === id) return step
    for (const [, list] of childPaths(step)) {
      const found = findStep(list, id)
      if (found) return found
    }
  }
  return undefined
}

/** Where a step sits, or undefined when it is not in the tree. */
export function locateStep(steps: FlowStep[], id: string): StepPosition | undefined {
  let found: StepPosition | undefined
  walkSteps(steps, (step, info) => {
    if (found) return false
    if (step.id === id) found = { parentId: info.parent?.id, branch: info.branch, index: info.index }
  })
  return found
}

/** Rebuild the tree, giving `fn` each list (top level and every path) to change. */
function mapLists(steps: FlowStep[], fn: (list: FlowStep[], parentId?: string, branch?: PathKey) => FlowStep[], parentId?: string, branch?: PathKey): FlowStep[] {
  const inner = steps.map((step) => {
    if (!isParent(step)) return step
    let next: ParentStep = step
    for (const [key, list] of childPaths(step)) {
      const mapped = mapLists(list, fn, step.id, key)
      if (mapped !== list) next = withPath(next, key, mapped)
    }
    return next
  })
  const changed = inner.some((step, index) => step !== steps[index])
  return fn(changed ? inner : steps, parentId, branch)
}

/** Replace every step (deeply) by `fn`'s result. Paths are mapped before their parent. */
export function mapSteps(steps: FlowStep[], fn: (step: FlowStep) => FlowStep): FlowStep[] {
  return mapLists(steps, (list) => {
    const next = list.map(fn)
    return next.some((step, index) => step !== list[index]) ? next : list
  })
}

/** Change one step by a patch or a function. The id and type always stay. */
export function updateStep(steps: FlowStep[], id: string, change: Partial<FlowStep> | ((step: FlowStep) => FlowStep)): FlowStep[] {
  return mapLists(steps, (list) => {
    const index = list.findIndex((step) => step.id === id)
    if (index < 0) return list
    const current = list[index]
    const next = typeof change === 'function' ? change(current) : ({ ...current, ...change } as FlowStep)
    const kept = { ...next, id: current.id, type: current.type } as FlowStep
    return [...list.slice(0, index), kept, ...list.slice(index + 1)]
  })
}

/** Take a step out, with everything inside it. */
export function removeStep(steps: FlowStep[], id: string): FlowStep[] {
  return mapLists(steps, (list) => (list.some((step) => step.id === id) ? list.filter((step) => step.id !== id) : list))
}

/**
 * Put a step in a list: the top level when there is no parent, else the
 * named side of that question or test. The index is clamped; -1 or past the
 * end adds it last.
 */
export function insertStep(steps: FlowStep[], at: { parentId?: string; branch?: PathKey; index: number }, step: FlowStep): FlowStep[] {
  const place = (list: FlowStep[]) => {
    const index = at.index < 0 || at.index > list.length ? list.length : at.index
    return [...list.slice(0, index), step, ...list.slice(index)]
  }
  if (!at.parentId) return place(steps)
  const parent = findStep(steps, at.parentId)
  if (!parent || !isParent(parent)) return steps
  // A side that doesn't belong to this kind of parent (a/b on a question) falls back to its first side.
  const sides: PathKey[] = parent.type === 'branch' ? ['yes', 'no'] : ['a', 'b']
  const key: PathKey = at.branch && sides.includes(at.branch) ? at.branch : sides[0]
  return mapLists(steps, (list, parentId, branch) => (parentId === at.parentId && branch === key ? place(list) : list))
}

/** Move a step up (-1) or down (1) within its own list. */
export function moveStep(steps: FlowStep[], id: string, dir: -1 | 1): FlowStep[] {
  return mapLists(steps, (list) => {
    const index = list.findIndex((step) => step.id === id)
    const target = index + dir
    if (index < 0 || target < 0 || target >= list.length) return list
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
}

/** A deep copy with fresh ids for the step and everything inside it. */
export function cloneStep(step: FlowStep): FlowStep {
  const copy = { ...step, id: newId('step') } as FlowStep
  if (copy.type === 'branch') {
    const conditions = copy.when.conditions.map((c) => ({ ...deepCopy(c), id: newId('cond') }))
    return { ...copy, when: { ...copy.when, conditions }, yes: copy.yes.map(cloneStep), no: copy.no.map(cloneStep) }
  }
  if (copy.type === 'split') return { ...copy, a: copy.a.map(cloneStep), b: copy.b.map(cloneStep) }
  return deepCopy(copy)
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Put a copy of the step right after it. The copy is at the original's index + 1. */
export function duplicateStep(steps: FlowStep[], id: string): FlowStep[] {
  return mapLists(steps, (list) => {
    const index = list.findIndex((step) => step.id === id)
    if (index < 0) return list
    return [...list.slice(0, index + 1), cloneStep(list[index]), ...list.slice(index + 1)]
  })
}

/** Every step in the tree, counting the ones inside questions and tests. */
export function countSteps(steps: FlowStep[]): number {
  let count = 0
  walkSteps(steps, () => {
    count += 1
  })
  return count
}

/** The emails and texts, in reading order. */
export function messageSteps(steps: FlowStep[]): (EmailStep | SmsStep)[] {
  const found: (EmailStep | SmsStep)[] = []
  walkSteps(steps, (step) => {
    if (step.type === 'email' || step.type === 'sms') found.push(step)
  })
  return found
}

/** The questions and tests a step sits inside, outermost first. Empty at the top level or when not found. */
export function pathTo(steps: FlowStep[], id: string): ParentStep[] {
  for (const step of steps) {
    if (step.id === id) return []
    if (!isParent(step)) continue
    for (const [, list] of childPaths(step)) {
      if (findStep(list, id)) return [step, ...pathTo(list, id)]
    }
  }
  return []
}

/**
 * A flow as the simulator reads it, for the server actions. Email designs are left out (uploaded
 * photos are data URLs that can run to megabytes, over the server's upload limit), and so are the
 * preheader, the description and the history: the replay never reads them.
 */
export function forSimulation(flow: Flow): Flow {
  const steps = mapSteps(flow.steps, (step) => {
    if (step.type !== 'email' || (step.design === undefined && step.preheader === undefined)) return step
    const slim: EmailStep = { id: step.id, type: 'email', subject: step.subject, body: step.body }
    if (step.subjectB !== undefined) slim.subjectB = step.subjectB
    return slim
  })
  return { ...flow, steps, description: '', history: [] }
}

/** What a list of flows reads to the simulator, as one string: changes only when a replay would. */
export function simulationKey(flows: Flow[]): string {
  return JSON.stringify(
    flows.map((flow) => {
      const slim = forSimulation(flow)
      return [slim.id, slim.purpose, slim.trigger, slim.who, slim.steps, slim.exit, slim.settings]
    }),
  )
}

/**
 * Bookings and revenue across several flows, each booking counted once: a guest who got two
 * automations' messages and then booked is credited to the one whose message went last before it.
 * Runs without credits (an older server) fall back to their own totals.
 */
export function creditedTotals(runs: (Pick<FlowRun, 'bookings' | 'revenue' | 'credits'> | undefined)[]): { bookings: number; revenue: number; credits: FlowCredit[] } {
  const best = new Map<string, FlowCredit>()
  let bookings = 0
  let revenue = 0
  for (const run of runs) {
    if (!run) continue
    if (!run.credits) {
      bookings += run.bookings
      revenue += run.revenue
      continue
    }
    for (const credit of run.credits) {
      const seen = best.get(credit.bookingId)
      if (!seen || credit.sentAt > seen.sentAt) best.set(credit.bookingId, credit)
    }
  }
  const credits = [...best.values()]
  for (const credit of credits) {
    bookings += 1
    revenue += credit.value
  }
  return { bookings, revenue, credits }
}

/** How deep a step sits: 0 at the top level, -1 when not found. */
export function depthOf(steps: FlowStep[], id: string): number {
  if (!findStep(steps, id)) return -1
  return pathTo(steps, id).length
}
