'use client'

import * as React from 'react'
import { BellOff, BellRing, CircleStop, Clock, GitBranch, ListTodo, Mail, MessageSquareText, Plus, Split, StickyNote, Tag, TagX, TicketPercent, Zap, type LucideIcon } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DescribeLookups } from '@/lib/flows/describe'
import { childPaths, type PathKey, type StepPosition } from '@/lib/flows/tree'
import type { Flow, FlowAction, FlowRun, FlowStep, FlowStepType, StepStats } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

import { MAIN_STEPS, MORE_STEPS, STEP_LABEL, kindOf, stepTitle, triggerTitle, type StepKind } from './meta'

/* ==========================================================================
   The canvas: the trigger at the top, then one card per step, a + between
   each, Yes / No paths side by side under a condition, and End.
   ========================================================================== */

export type Selection = { kind: 'trigger' } | { kind: 'settings' } | { kind: 'step'; id: string } | null

export const KIND_ICON: Record<StepKind | 'trigger', LucideIcon> = {
  trigger: Zap,
  email: Mail,
  sms: MessageSquareText,
  wait: Clock,
  branch: GitBranch,
  split: Split,
  code: TicketPercent,
  notify: BellRing,
  tag: Tag,
  untag: TagX,
  task: ListTodo,
  note: StickyNote,
  unsubscribe: BellOff,
  end: CircleStop,
}

export const KIND_TONE: Record<StepKind | 'trigger', string> = {
  trigger: 'bg-primary text-white',
  email: 'bg-info-soft text-info',
  sms: 'bg-info-soft text-info',
  wait: 'bg-warning-soft text-warning',
  branch: 'bg-accent-soft text-accent',
  split: 'bg-accent-soft text-accent',
  code: 'bg-success-soft text-success',
  notify: 'bg-success-soft text-success',
  tag: 'bg-success-soft text-success',
  untag: 'bg-success-soft text-success',
  task: 'bg-success-soft text-success',
  note: 'bg-success-soft text-success',
  unsubscribe: 'bg-surface-sunken text-muted',
  end: 'bg-surface-sunken text-muted',
}

interface CanvasProps {
  flow: Flow
  lookups: DescribeLookups
  run: FlowRun | null
  selection: Selection
  problems: Set<string>
  onSelect: (selection: Selection) => void
  onInsert: (at: StepPosition, type: FlowStepType, action?: FlowAction) => void
}

const fmt = (n: number) => n.toLocaleString('en-US')

function statsLine(step: FlowStep, stats: StepStats | undefined): string | null {
  if (!stats || stats.reached === 0) return null
  if (step.type === 'email') return `${fmt(stats.sent)} sent · ${stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0}% opened`
  if (step.type === 'sms') return `${fmt(stats.sent)} sent`
  if (step.type === 'branch') return `${fmt(stats.yes ?? 0)} yes · ${fmt(stats.no ?? 0)} no`
  if (step.type === 'wait' && stats.waiting > 0) return `${fmt(stats.waiting)} waiting now`
  return null
}

export function Canvas(props: CanvasProps) {
  const { flow, lookups, run, selection, onSelect } = props
  return (
    <div className="flex min-w-max flex-col items-center px-6 py-10">
      <Card
        kind="trigger"
        label="Trigger"
        title={triggerTitle(flow.trigger, lookups)}
        stats={run && run.entered > 0 ? `${fmt(run.entered)} guests in the last 60 days` : null}
        selected={selection?.kind === 'trigger'}
        onClick={() => onSelect({ kind: 'trigger' })}
      />
      <StepList {...props} steps={flow.steps} />
      <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-subtle">End</span>
    </div>
  )
}

function StepList(props: CanvasProps & { steps: FlowStep[]; parentId?: string; branch?: PathKey }) {
  const { steps, parentId, branch, onInsert } = props
  const at = (index: number): StepPosition => ({ parentId, branch, index })
  return (
    <div className="flex flex-col items-center">
      <Connector onPick={(type, action) => onInsert(at(0), type, action)} />
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <StepNode {...props} step={step} />
          {step.type === 'end' ? null : <Connector onPick={(type, action) => onInsert(at(index + 1), type, action)} />}
        </React.Fragment>
      ))}
    </div>
  )
}

function StepNode(props: CanvasProps & { step: FlowStep }) {
  const { step, lookups, run, selection, problems, onSelect } = props
  const kind = kindOf(step)
  const card = (
    <Card
      kind={kind}
      label={STEP_LABEL[kind]}
      title={stepTitle(step, lookups)}
      stats={statsLine(step, run?.perStep[step.id])}
      selected={selection?.kind === 'step' && selection.id === step.id}
      problem={problems.has(step.id)}
      onClick={() => onSelect({ kind: 'step', id: step.id })}
    />
  )
  if (step.type !== 'branch' && step.type !== 'split') return card

  const paths = childPaths(step)
  const name = (key: PathKey) => (key === 'yes' ? 'Yes' : key === 'no' ? 'No' : step.type === 'split' ? `${key.toUpperCase()} · ${key === 'a' ? step.percentA : 100 - step.percentA}%` : key)
  return (
    <div className="flex flex-col items-center">
      {card}
      <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
      <div className="grid grid-cols-[auto_auto] gap-x-10">
        {paths.map(([key, list], index) => (
          <div key={key} className="relative flex flex-col items-center">
            {/* Each side draws its half of the bar, centre to the middle of the gap. */}
            <span aria-hidden="true" className={cn('absolute top-0 h-px bg-line-strong', index === 0 ? 'right-[-1.25rem] left-1/2' : 'right-1/2 left-[-1.25rem]')} />
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', key === 'yes' ? 'bg-success-soft text-success' : key === 'no' ? 'bg-surface-sunken text-muted' : 'bg-accent-soft text-accent')}>{name(key)}</span>
            <StepList {...props} steps={list} parentId={step.id} branch={key} />
            <span aria-hidden="true" className="min-h-2 w-px flex-1 bg-line-strong" />
            <span aria-hidden="true" className={cn('absolute bottom-0 h-px bg-line-strong', index === 0 ? 'right-[-1.25rem] left-1/2' : 'right-1/2 left-[-1.25rem]')} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Card({
  kind,
  label,
  title,
  stats,
  selected,
  problem,
  onClick,
}: {
  kind: StepKind | 'trigger'
  label: string
  title: string
  stats?: string | null
  selected: boolean
  problem?: boolean
  onClick: () => void
}) {
  const Icon = KIND_ICON[kind]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'group w-80 rounded-xl border bg-surface px-4 py-3 text-left shadow-xs transition-[border-color,box-shadow] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected ? 'border-primary ring-2 ring-primary/15' : problem ? 'border-danger/60' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="flex items-center gap-3">
        <span aria-hidden="true" className={cn('grid size-8 shrink-0 place-items-center rounded-lg', KIND_TONE[kind])}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-subtle">
            {label}
            {problem ? <span className="text-danger">· needs a look</span> : null}
          </span>
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        </span>
      </span>
      {stats ? <span className="mt-2 block border-t border-line-subtle pt-2 text-xs text-subtle tabular-nums">{stats}</span> : null}
    </button>
  )
}

function Connector({ onPick }: { onPick: (type: FlowStepType, action?: FlowAction) => void }) {
  const [open, setOpen] = React.useState(false)
  const pick = (type: FlowStepType, action?: FlowAction) => {
    onPick(type, action)
    setOpen(false)
  }
  return (
    <div className="flex flex-col items-center">
      <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Add a step here"
            className={cn(
              'grid size-7 place-items-center rounded-full border bg-surface text-muted transition-colors',
              'hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              open ? 'border-primary text-primary' : 'border-line-strong',
            )}
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent width="auto" padding="none" align="center" className="w-60 p-1.5">
          <StepMenuList items={MAIN_STEPS} onPick={pick} />
          <p className="mt-1 border-t border-line-subtle px-2.5 pt-2 pb-1 text-xs font-medium text-subtle">More</p>
          <StepMenuList items={MORE_STEPS} onPick={pick} />
        </PopoverContent>
      </Popover>
      <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
    </div>
  )
}

function StepMenuList({ items, onPick }: { items: { kind: StepKind; type: FlowStepType; action?: FlowAction }[]; onPick: (type: FlowStepType, action?: FlowAction) => void }) {
  return (
    <ul className="flex list-none flex-col p-0">
      {items.map((item) => {
        const Icon = KIND_ICON[item.kind]
        return (
          <li key={item.kind}>
            <button
              type="button"
              onClick={() => onPick(item.type, item.action)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none"
            >
              <span aria-hidden="true" className={cn('grid size-6 place-items-center rounded-md', KIND_TONE[item.kind])}>
                <Icon className="size-3.5" />
              </span>
              {STEP_LABEL[item.kind]}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
