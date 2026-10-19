'use client'

import * as React from 'react'
import { CircleAlert, DoorOpen, Minus, Plus, Settings2, TriangleAlert, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { PURPOSE_LABEL, STEP_PALETTE, triggerMeta } from '@/lib/flows/catalog'
import { describeExit, describeReach, describeStep, describeTrigger, describeWho, type DescribeLookups } from '@/lib/flows/describe'
import { childPaths, isParent, type PathKey, type StepPosition } from '@/lib/flows/tree'
import type { Flow, FlowAction, FlowIssue, FlowRun, FlowStep, FlowStepType, StepStats } from '@/lib/flows/types'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { FlowIcon, iconTone, stepIconName } from './icons'

/* ==========================================================================
   The canvas: one calm column that reads top to bottom like a sentence.
   "Starts when" → "Who can enter" → the steps, with a + between every pair
   → "Ends early when". Questions and A/B tests split into two columns
   (Yes / No, A / B), each as wide as what is in it, centred under the
   question, that join again below. When nested questions make it wider
   than the view, it scrolls sideways, opened centred on the main line, at
   full size so no text drops under 12px; the zoom buttons zoom out for an
   overview when the owner asks for one, and put it back.
   Every card carries the simulator's numbers for the last 60 days.
   ========================================================================== */

/** Cards on the main line, and cards inside a Yes / No or A / B path. */
const MAIN_WIDTH = 'w-[34rem] max-w-[calc(100vw-2rem)]'
const PATH_WIDTH = 'w-[20rem]'

const ZOOM_MIN = 0.55
const ZOOM_STEP = 0.1

export type Selection =
  | { kind: 'trigger' }
  | { kind: 'who' }
  | { kind: 'exit' }
  | { kind: 'settings' }
  | { kind: 'step'; id: string }
  | { kind: 'health' }
  | { kind: 'preview' }
  | null

export type Severity = FlowIssue['severity']

export interface CanvasProps {
  flow: Flow
  selection: Selection
  onSelect: (selection: Selection) => void
  onInsert: (at: StepPosition, type: FlowStepType, action?: FlowAction) => void
  run: FlowRun | null
  /** The worst issue per step id, and for 'trigger' / 'who' / 'exit'. */
  severities: Map<string, Severity>
  lookups: DescribeLookups
  currency: CurrencyCode
}

/** A path ends when it reaches "End here", or a question whose every path ends. */
function pathEnds(steps: FlowStep[]): boolean {
  return steps.some((step) => step.type === 'end' || (isParent(step) && childPaths(step).every(([, list]) => pathEnds(list))))
}

const fmtCount = (n: number) => n.toLocaleString('en-US')
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '0%')

export function Canvas(props: CanvasProps) {
  const { flow, selection, onSelect, run, severities, lookups } = props
  const meta = triggerMeta(flow.trigger.type)
  const marketing = flow.purpose === 'marketing'
  const reach = describeReach(flow.trigger, lookups)
  const kept = run ? run.skipped.reduce((sum, entry) => sum + entry.count, 0) : 0
  const exit = describeExit(flow)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const lastStep = flow.steps[flow.steps.length - 1] as FlowStep | undefined

  const innerRef = React.useRef<HTMLDivElement>(null)
  // null: full size. A number: the owner zoomed out for an overview.
  const [chosen, setChosen] = React.useState<number | null>(null)
  // Wider than the view at full size: the zoom buttons show.
  const [wide, setWide] = React.useState(false)
  const zoom = chosen ?? 1
  // How wide the flow is: changes only when paths are added or removed.
  const shape = React.useMemo(() => JSON.stringify(flow.steps, (key, value) => (key === 'type' || key === 'steps' || key === 'yes' || key === 'no' || key === 'a' || key === 'b' || typeof value === 'object' ? value : undefined)), [flow.steps])

  React.useLayoutEffect(() => {
    const scroller = rootRef.current?.parentElement
    const inner = innerRef.current
    if (!scroller || !inner) return
    const measure = () => {
      // The on-screen width, undone by the zoom applied now, against the room inside the side padding
      // (the column is at least that wide, so it only counts as wider when its cards really are).
      const applied = Number(inner.style.zoom) || 1
      const natural = inner.getBoundingClientRect().width / applied
      const style = rootRef.current ? window.getComputedStyle(rootRef.current) : null
      const room = scroller.clientWidth - (style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 48)
      setWide(natural > room + 1)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [shape])

  // Wider than the view even zoomed out: open it centred on the main line.
  React.useLayoutEffect(() => {
    const scroller = rootRef.current?.parentElement
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2
    }
  }, [zoom])

  const zoomBy = (delta: number) => {
    const next = Math.min(1, Math.max(ZOOM_MIN, Math.round((zoom + delta) * 100) / 100))
    setChosen(next >= 1 ? null : next)
  }

  // Arrow keys walk the cards in reading order.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const target = event.target as HTMLElement
    if (!target.dataset.card) return
    const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-card]'))
    const index = cards.indexOf(target)
    const next = cards[index + (event.key === 'ArrowDown' ? 1 : -1)]
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  return (
    <div ref={rootRef} className="relative w-max min-w-full px-4 py-8 sm:px-8" onKeyDown={onKeyDown}>
      {wide || chosen !== null ? (
        <div className="sticky left-4 top-3 z-10 -mb-9 flex w-fit items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => zoomBy(-ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
            className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setChosen(null)}
            disabled={chosen === null}
            aria-label="Back to full size"
            className="h-8 min-w-14 rounded-md px-2 text-xs font-semibold tabular-nums text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:hover:bg-transparent"
          >
            {`${Math.round(zoom * 100)}%`}
          </button>
          <button
            type="button"
            onClick={() => zoomBy(ZOOM_STEP)}
            disabled={zoom >= 1}
            aria-label="Zoom in"
            className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div ref={innerRef} className="mx-auto flex w-max min-w-full flex-col items-center" style={zoom < 1 ? { zoom } : undefined}>
        <Card
          id="trigger"
          selected={selection?.kind === 'trigger'}
          onSelect={() => onSelect({ kind: 'trigger' })}
          eyebrow="Starts when"
          icon={<FlowIcon name={meta.icon} />}
          tone={iconTone('trigger')}
          title={describeTrigger(flow.trigger, lookups)}
          detail={reach || meta.help}
          severity={severities.get('trigger')}
          chips={
            run ? (
              <>
                <Chip label="Started" value={fmtCount(run.entered)} />
                <Chip label="In it now" value={fmtCount(run.active)} />
                {run.finished > 0 ? <Chip label="Finished" value={fmtCount(run.finished)} /> : null}
              </>
            ) : null
          }
        />
        <Line />
        <Card
          id="who"
          selected={selection?.kind === 'who'}
          onSelect={() => onSelect({ kind: 'who' })}
          eyebrow="Who can enter"
          icon={<Users className="size-4" aria-hidden="true" />}
          tone={iconTone('who')}
          title={describeWho(flow, lookups)}
          detail={marketing ? 'Marketing: only guests who agreed to hear from you, within quiet hours and your weekly limit.' : 'Booking message: goes to everyone it applies to.'}
          severity={severities.get('who')}
          badge={<Badge size="sm" variant={marketing ? 'primary' : 'neutral'}>{PURPOSE_LABEL[flow.purpose]}</Badge>}
          chips={
            run && kept > 0 ? (
              <SimpleTooltip
                label={
                  <span className="flex flex-col gap-0.5">
                    {run.skipped.slice(0, 4).map((entry) => (
                      <span key={entry.reason}>
                        {entry.reason}: {fmtCount(entry.count)}
                      </span>
                    ))}
                  </span>
                }
              >
                {/* Not focusable on its own: the card is the button, and its panel lists the reasons. */}
                <span>
                  <Chip label="Kept out" value={fmtCount(kept)} />
                </span>
              </SimpleTooltip>
            ) : null
          }
        />
        <StepList {...props} steps={flow.steps} topLevel />
        {/* After a last question whose paths all end there is no line to carry on: just the gap. */}
        {lastStep && isParent(lastStep) && pathEnds([lastStep]) ? <span aria-hidden="true" className="h-5" /> : <Line />}
        <Card
          id="exit"
          selected={selection?.kind === 'exit'}
          onSelect={() => onSelect({ kind: 'exit' })}
          eyebrow="Ends early when"
          icon={<DoorOpen className="size-4" aria-hidden="true" />}
          tone={iconTone('exit')}
          title={exit ? exit.replace(/^Stops when /, '').replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase()) : 'It never ends early'}
          detail={exit ? 'Checked before every step.' : 'Guests go through every step, whatever they do.'}
          severity={severities.get('exit')}
          chips={run && run.exited > 0 ? <Chip label="Left early" value={fmtCount(run.exited)} /> : null}
        />
        <button
          type="button"
          onClick={() => onSelect({ kind: 'settings' })}
          aria-pressed={selection?.kind === 'settings'}
          className={cn(
            'mt-3 inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[0.8125rem] font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            selection?.kind === 'settings' ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface hover:text-foreground',
          )}
        >
          <Settings2 className="size-4" aria-hidden="true" />
          More settings
        </button>
      </div>
    </div>
  )
}

/* ---------- steps ---------- */

function StepList(props: CanvasProps & { steps: FlowStep[]; parentId?: string; branch?: PathKey; topLevel?: boolean }) {
  const { steps, parentId, branch, topLevel, onInsert } = props
  const at = (index: number): StepPosition => ({ parentId, branch, index })

  // An empty path gets a card of its own, as wide as the other side, so the two read as a pair.
  if (steps.length === 0 && !topLevel) {
    return (
      <div className="flex w-full flex-col items-center">
        <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
        <Insert onPick={(type, action) => onInsert(at(0), type, action)} placeholder />
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-center">
      <Insert onPick={(type, action) => onInsert(at(0), type, action)} big={steps.length === 0 && topLevel} />
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        // Nothing follows "End here", nor a last question whose every path ends (no loose + under it).
        const stops = step.type === 'end' || (last && pathEnds([step]))
        return (
          <React.Fragment key={step.id}>
            <StepNode {...props} step={step} inPath={!topLevel} />
            {stops ? null : <Insert onPick={(type, action) => onInsert(at(index + 1), type, action)} labelled={last && !topLevel} big={last && topLevel} />}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function StepNode(props: CanvasProps & { step: FlowStep; inPath: boolean }) {
  const { step, inPath, selection, onSelect, run, severities, lookups, flow, currency } = props
  const d = describeStep(step, lookups)
  const stats = run?.perStep[step.id]
  const card = (
    <Card
      id={step.id}
      width={inPath ? PATH_WIDTH : MAIN_WIDTH}
      selected={selection?.kind === 'step' && selection.id === step.id}
      onSelect={() => onSelect({ kind: 'step', id: step.id })}
      icon={<FlowIcon name={stepIconName(step)} />}
      tone={iconTone(step.type)}
      title={d.title}
      detail={d.detail}
      severity={severities.get(step.id)}
      chips={stats ? <StepChips step={step} stats={stats} marketing={flow.purpose === 'marketing'} currency={currency} /> : null}
    />
  )
  if (step.type !== 'branch' && step.type !== 'split') return card

  const paths = childPaths(step)
  const ends = paths.map(([, list]) => pathEnds(list))
  const label = (key: PathKey) =>
    step.type === 'split' ? `${key.toUpperCase()} · ${key === 'a' ? step.percentA : 100 - step.percentA}%` : key === 'yes' ? 'Yes' : 'No'
  // Each side draws its part of the joining lines, from its own centre to the middle of the
  // gap (gap-x-8, so 1rem past its edge). Together they run from one centre to the other,
  // which always passes under the question, so the main line meets them above and below.
  const half = (index: number) => (index === 0 ? 'left-1/2 -right-4' : '-left-4 right-1/2')

  return (
    <div className="flex flex-col items-center">
      {card}
      <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
      {/* Each side is as wide as what is in it; the joining lines run centre to centre through the gap. */}
      <div className="grid w-max grid-cols-[auto_auto] gap-x-8" role="group" aria-label={step.type === 'branch' ? 'Yes and No paths' : 'A and B paths'}>
        {paths.map(([key, list], index) => (
          <div key={key} className="relative flex min-w-[20rem] flex-col items-center">
            <span aria-hidden="true" className={cn('absolute top-0 h-px bg-line-strong', half(index))} />
            <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                key === 'yes' ? 'border-success/30 bg-success-soft text-success' : key === 'no' ? 'border-line bg-surface text-muted' : 'border-info/30 bg-info-soft text-info',
              )}
            >
              {label(key)}
            </span>
            {/* topLevel is spelled out: the props spread down from the main line carry topLevel true. */}
            <StepList {...props} steps={list} parentId={step.id} branch={key} topLevel={false} />
            {ends[index] ? null : (
              <>
                <span aria-hidden="true" className="min-h-3 w-px flex-1 bg-line-strong" />
                <span aria-hidden="true" className={cn('absolute bottom-0 h-px bg-line-strong', half(index))} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StepChips({ step, stats, marketing, currency }: { step: FlowStep; stats: StepStats; marketing: boolean; currency: CurrencyCode }) {
  const waiting = stats.waiting > 0 ? <Chip label="Waiting here" value={fmtCount(stats.waiting)} /> : null
  if (step.type === 'email' || step.type === 'sms') {
    return (
      <>
        <Chip label="Sent" value={fmtCount(stats.sent)} />
        {step.type === 'email' ? <Chip label="Opened" value={pct(stats.opened, stats.sent)} estimate /> : null}
        <Chip label="Clicked" value={pct(stats.clicked, stats.sent)} estimate />
        {marketing ? <Chip label="Booked" value={stats.bookings > 0 ? `${fmtCount(stats.bookings)} · ${formatCurrency(stats.revenue, currency)}` : '0'} /> : null}
        {waiting}
      </>
    )
  }
  if (step.type === 'branch' || step.type === 'split') {
    return (
      <>
        <Chip label={step.type === 'branch' ? 'Yes' : 'A'} value={fmtCount(stats.yes ?? 0)} />
        <Chip label={step.type === 'branch' ? 'No' : 'B'} value={fmtCount(stats.no ?? 0)} />
      </>
    )
  }
  return (
    <>
      <Chip label={step.type === 'action' ? 'Done' : 'Reached'} value={fmtCount(stats.reached)} />
      {waiting}
    </>
  )
}

/* ---------- pieces ---------- */

function Chip({ label, value, estimate }: { label: string; value: string; estimate?: boolean }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-md bg-surface-sunken px-1.5 text-xs text-subtle tabular">
      {label}
      <span className="font-medium text-foreground">{value}</span>
      {estimate ? <span className="text-faint">est.</span> : null}
    </span>
  )
}

function Card({
  id,
  width = MAIN_WIDTH,
  selected,
  onSelect,
  eyebrow,
  icon,
  tone,
  title,
  detail,
  chips,
  severity,
  badge,
}: {
  id: string
  width?: string
  selected: boolean
  onSelect: () => void
  eyebrow?: string
  icon: React.ReactNode
  tone: string
  title: string
  detail?: string
  chips?: React.ReactNode
  severity?: Severity
  badge?: React.ReactNode
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-card={id}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        'group relative flex shrink-0 cursor-pointer items-start gap-3 rounded-xl border bg-surface px-4 py-3.5 text-left shadow-xs',
        width,
        'transition-[border-color,box-shadow] duration-150',
        'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/30',
        selected ? 'border-primary ring-1 ring-primary' : severity === 'blocker' ? 'border-danger/50 hover:border-danger' : 'border-line hover:border-line-strong',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tone)}>{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {eyebrow || badge ? (
          <div className="flex items-center justify-between gap-2">
            {eyebrow ? <p className="text-xs font-medium text-subtle">{eyebrow}</p> : <span />}
            {badge}
          </div>
        ) : null}
        <p className="text-sm font-medium text-foreground">{title}</p>
        {detail ? <p className="line-clamp-2 text-[0.8125rem] leading-snug text-muted">{detail}</p> : null}
        {chips ? <div className="mt-2 flex flex-wrap gap-1.5">{chips}</div> : null}
      </div>
      {severity === 'blocker' || severity === 'warning' ? (
        <span className="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full border border-surface bg-surface shadow-xs" title={severity === 'blocker' ? 'Needs fixing' : 'Worth a look'}>
          {severity === 'blocker' ? <CircleAlert className="size-4 text-danger" aria-hidden="true" /> : <TriangleAlert className="size-4 text-warning" aria-hidden="true" />}
          <span className="sr-only">{severity === 'blocker' ? 'Needs fixing' : 'Worth a look'}</span>
        </span>
      ) : null}
    </div>
  )
}

function Line() {
  return <span aria-hidden="true" className="h-5 w-px bg-line-strong" />
}

/** A + between steps, a labelled "Add a step" at the end of a path, or the card an empty path shows. */
function Insert({
  onPick,
  labelled,
  big,
  placeholder,
}: {
  onPick: (type: FlowStepType, action?: FlowAction) => void
  labelled?: boolean
  big?: boolean
  placeholder?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const menu = (
    <PopoverContent width="auto" padding="none" className="w-[32rem] max-w-[calc(100vw-1.5rem)] p-1.5" align="center">
      <StepMenu
        onPick={(type, action) => {
          onPick(type, action)
          setOpen(false)
        }}
      />
    </PopoverContent>
  )

  if (placeholder) {
    return (
      <div className={cn(PATH_WIDTH, 'flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-line-strong bg-surface px-4 py-5 text-center')}>
        <p className="text-[0.8125rem] text-muted">Nothing here — they carry on</p>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-[0.8125rem] font-medium text-primary shadow-xs transition-colors hover:border-primary/50 hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:bg-primary-soft"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add a step
            </button>
          </PopoverTrigger>
          {menu}
        </Popover>
      </div>
    )
  }

  const trigger = big ? (
    <button
      type="button"
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-surface px-3.5 text-[0.8125rem] font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:bg-primary-soft"
    >
      <Plus className="size-4" aria-hidden="true" />
      Add a step
    </button>
  ) : labelled ? (
    <button
      type="button"
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-dashed border-line-strong bg-surface px-2.5 text-xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:text-primary"
    >
      <Plus className="size-3.5" aria-hidden="true" />
      Add a step
    </button>
  ) : (
    <button
      type="button"
      aria-label="Add a step here"
      className="grid size-7 place-items-center rounded-full border border-line-strong bg-surface text-subtle shadow-xs transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary data-[state=open]:border-primary data-[state=open]:text-primary"
    >
      <Plus className="size-4" aria-hidden="true" />
    </button>
  )

  return (
    <div className="flex flex-col items-center">
      <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
      <Popover open={open} onOpenChange={setOpen}>
        {labelled || big ? <PopoverTrigger asChild>{trigger}</PopoverTrigger> : (
          <SimpleTooltip label="Add a step here">
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          </SimpleTooltip>
        )}
        {menu}
      </Popover>
      <span aria-hidden="true" className="h-3 w-px bg-line-strong" />
    </div>
  )
}

export function StepMenu({ onPick }: { onPick: (type: FlowStepType, action?: FlowAction) => void }) {
  return (
    <div className="flex flex-col" role="group" aria-label="Add a step">
      {STEP_PALETTE.map((group) => (
        <div key={group.group} className="py-1">
          <p className="px-2.5 pt-1 pb-1 text-xs font-medium text-subtle">{group.group}</p>
          <div className={cn('grid gap-0.5', group.items.length > 1 && 'sm:grid-cols-2')}>
            {group.items.map((item) => (
              <button
                key={`${item.type}-${item.action ?? ''}`}
                type="button"
                onClick={() => onPick(item.type, item.action)}
                className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
              >
                <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-md', iconTone(item.type))}>
                  <FlowIcon name={item.icon} className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs leading-snug text-subtle">{item.help}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
