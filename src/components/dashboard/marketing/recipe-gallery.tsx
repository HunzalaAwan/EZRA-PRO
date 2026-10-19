'use client'

import * as React from 'react'
import {
  AlarmClock,
  Armchair,
  ArrowLeft,
  ArrowRight,
  Backpack,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarHeart,
  CalendarPlus,
  CalendarX,
  Check,
  CircleStop,
  Clock,
  CloudLightning,
  CreditCard,
  Crown,
  Gift,
  GitBranch,
  Hand,
  History,
  Hourglass,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  ListTodo,
  Mail,
  MailPlus,
  MessageSquare,
  Minus,
  PencilRuler,
  Plus,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Split,
  Star,
  StickyNote,
  Tag,
  TagX,
  TicketPercent,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { FLOW_GOALS, PURPOSE_LABEL, TRIGGERS, TRIGGER_GROUPS, blankFlow, goalMeta, type IconName } from '@/lib/flows/catalog'
import { describeFlow, type DescribeLookups } from '@/lib/flows/describe'
import { RECIPES, recipeDefaults, settleAnswers, type Recipe, type RecipeAnswers, type RecipeQuestion } from '@/lib/flows/recipes'
import type { Flow, FlowGoal, FlowPurpose } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

/* ==========================================================================
   RECIPE GALLERY
   "What do you want to happen?" Goals on the left, ready-made automations
   on the right with the steps they take and what they tend to achieve.
   Picking one asks up to three plain questions, shows the result as a
   sentence, then opens it in the builder as a draft. "Start from scratch"
   picks what starts it first.
   ========================================================================== */

/** The catalog names its icons; these are the components. */
export const FLOW_ICON: Record<IconName, LucideIcon> = {
  Armchair,
  AlarmClock,
  Backpack,
  BellOff,
  BellRing,
  CalendarCheck,
  CalendarClock,
  CalendarHeart,
  CalendarPlus,
  CalendarX,
  CircleStop,
  Clock,
  CloudLightning,
  CreditCard,
  Crown,
  Gift,
  GitBranch,
  Hand,
  History,
  Hourglass,
  Inbox,
  LifeBuoy,
  ListTodo,
  Mail,
  MailPlus,
  MessageSquare,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Split,
  Star,
  StickyNote,
  Tag,
  TagX,
  TicketPercent,
  UserCheck,
  UserX,
  Users,
  Wallet,
}

export function FlowIcon({ name, className }: { name: IconName; className?: string }) {
  const Icon = FLOW_ICON[name] ?? Mail
  return <Icon className={className} aria-hidden="true" />
}

type Stage = { kind: 'browse'; goal: FlowGoal | 'all' } | { kind: 'setup'; recipe: Recipe; answers: RecipeAnswers; from: FlowGoal | 'all' } | { kind: 'scratch'; from: FlowGoal | 'all' }

export interface RecipeGalleryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Open straight on this recipe's questions (deep links from the Overview). */
  initialRecipeId?: string | null
  activities: { slug: string; name: string }[]
  business: string
  nowIso: string
  lookups?: DescribeLookups
  /** Recipes the business already has an automation from. */
  usedRecipeIds?: string[]
  /** The draft to open in the builder. */
  onStart: (flow: Flow) => void
}

export function RecipeGallery({ open, onOpenChange, initialRecipeId, activities, business, nowIso, lookups, usedRecipeIds = [], onStart }: RecipeGalleryProps) {
  const startStage = (): Stage => {
    const recipe = initialRecipeId ? RECIPES.find((entry) => entry.id === initialRecipeId) : undefined
    return recipe ? { kind: 'setup', recipe, answers: recipeDefaults(recipe), from: recipe.goal } : { kind: 'browse', goal: 'all' }
  }
  const [stage, setStage] = React.useState<Stage>(startStage)
  const ctx = React.useMemo(() => ({ activities, nowIso, business }), [activities, nowIso, business])
  const used = React.useMemo(() => new Set(usedRecipeIds), [usedRecipeIds])

  // Each time it opens: on the asked-for recipe, or on every idea. Set while rendering, so the last visit never flashes first.
  const openedFor = open ? `open:${initialRecipeId ?? ''}` : null
  const [lastOpened, setLastOpened] = React.useState(openedFor)
  if (openedFor !== lastOpened) {
    setLastOpened(openedFor)
    if (openedFor) setStage(startStage())
  }

  // Who each recipe goes to, worked out once from its defaults.
  // Only while open: nothing to build on the server or while it is closed.
  const purposeOf = React.useMemo(() => {
    const out = new Map<string, FlowPurpose>()
    if (!open) return out
    for (const recipe of RECIPES) {
      try {
        out.set(recipe.id, recipe.build(recipeDefaults(recipe), ctx).purpose)
      } catch {
        /* a recipe that cannot build here simply shows no label */
      }
    }
    return out
  }, [ctx, open])

  const counts = React.useMemo(() => {
    const out = new Map<FlowGoal, number>()
    for (const recipe of RECIPES) out.set(recipe.goal, (out.get(recipe.goal) ?? 0) + 1)
    return out
  }, [])

  const pick = (recipe: Recipe, from: FlowGoal | 'all') => setStage({ kind: 'setup', recipe, answers: recipeDefaults(recipe), from })
  const currentGoal = stage.kind === 'browse' ? stage.goal : stage.from

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className="sm:max-w-6xl">
        <DialogHeader divider>
          <DialogTitle>{stage.kind === 'setup' ? stage.recipe.name : stage.kind === 'scratch' ? 'Start from scratch' : 'New automation'}</DialogTitle>
          <DialogDescription>
            {stage.kind === 'setup'
              ? stage.recipe.blurb
              : stage.kind === 'scratch'
                ? 'Pick the moment that starts it. You add the messages and steps next.'
                : 'Pick what you want to happen. Each one comes with the wording written, and starts as a draft you can change.'}
          </DialogDescription>
        </DialogHeader>

        {stage.kind === 'setup' ? (
          <SetupStage
            recipe={stage.recipe}
            answers={stage.answers}
            onAnswers={(answers) => setStage({ ...stage, answers })}
            ctx={ctx}
            lookups={lookups}
            backLabel={stage.from === 'all' ? 'All ideas' : goalMeta(stage.from).label}
            onBack={() => setStage({ kind: 'browse', goal: stage.from })}
            onStart={(flow) => onStart(flow)}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            {/* ---------- goals ---------- */}
            <nav aria-label="Goals" className="shrink-0 border-b border-line-subtle md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
              <ul className="flex list-none gap-1 overflow-x-auto p-3 no-scrollbar md:flex-col md:overflow-x-visible">
                <li>
                  <GoalButton active={stage.kind === 'browse' && currentGoal === 'all'} icon={LayoutGrid} label="All ideas" count={RECIPES.length} onClick={() => setStage({ kind: 'browse', goal: 'all' })} />
                </li>
                {FLOW_GOALS.filter((goal) => (counts.get(goal.goal) ?? 0) > 0).map((goal) => (
                  <li key={goal.goal}>
                    <GoalButton
                      active={stage.kind === 'browse' && currentGoal === goal.goal}
                      icon={FLOW_ICON[goal.icon]}
                      label={goal.label}
                      blurb={goal.blurb}
                      count={counts.get(goal.goal) ?? 0}
                      onClick={() => setStage({ kind: 'browse', goal: goal.goal })}
                    />
                  </li>
                ))}
                <li className="md:mt-2 md:border-t md:border-line-subtle md:pt-3">
                  <GoalButton active={stage.kind === 'scratch'} icon={PencilRuler} label="Start from scratch" blurb="Choose what starts it and build it step by step." onClick={() => setStage({ kind: 'scratch', from: currentGoal })} />
                </li>
              </ul>
            </nav>

            {/* ---------- ideas, or the moments that start one ---------- */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {stage.kind === 'scratch' ? (
                <ScratchStage nowIso={nowIso} onStart={onStart} />
              ) : stage.goal === 'all' ? (
                <div className="flex flex-col gap-8">
                  {FLOW_GOALS.map((goal) => {
                    const list = RECIPES.filter((recipe) => recipe.goal === goal.goal)
                    if (list.length === 0) return null
                    return (
                      <section key={goal.goal} aria-labelledby={`goal-${goal.goal}`}>
                        <div className="mb-3 flex items-baseline justify-between gap-3">
                          <h3 id={`goal-${goal.goal}`} className="text-sm font-semibold text-foreground">{goal.label}</h3>
                          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setStage({ kind: 'browse', goal: goal.goal })}>
                            Only these
                          </button>
                        </div>
                        <RecipeGrid list={list} purposeOf={purposeOf} used={used} onPick={(recipe) => pick(recipe, 'all')} />
                      </section>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{goalMeta(stage.goal).label}</h3>
                    <p className="mt-0.5 text-sm text-muted">{goalMeta(stage.goal).blurb}</p>
                  </div>
                  <RecipeGrid list={RECIPES.filter((recipe) => recipe.goal === stage.goal)} purposeOf={purposeOf} used={used} onPick={(recipe) => pick(recipe, stage.goal)} />
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------- goals list ---------- */

function GoalButton({ active, icon: Icon, label, blurb, count, onClick }: { active: boolean; icon: LucideIcon; label: string; blurb?: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-max items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors md:w-full',
        active ? 'bg-primary-soft text-foreground' : 'text-muted hover:bg-surface-sunken hover:text-foreground',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-subtle')} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium whitespace-nowrap md:whitespace-normal">{label}</span>
          {count !== undefined ? <span className="hidden text-xs text-subtle tabular-nums md:inline">{count}</span> : null}
        </span>
        {blurb ? <span className="mt-0.5 hidden text-xs leading-snug text-subtle md:block">{blurb}</span> : null}
      </span>
    </button>
  )
}

/* ---------- recipe cards ---------- */

function RecipeGrid({ list, purposeOf, used, onPick }: { list: Recipe[]; purposeOf: Map<string, FlowPurpose>; used: Set<string>; onPick: (recipe: Recipe) => void }) {
  return (
    <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((recipe) => (
        <li key={recipe.id} className="flex">
          <RecipeCard recipe={recipe} purpose={purposeOf.get(recipe.id)} inUse={used.has(recipe.id)} onPick={() => onPick(recipe)} />
        </li>
      ))}
    </ul>
  )
}

function RecipeCard({ recipe, purpose, inUse, onPick }: { recipe: Recipe; purpose?: FlowPurpose; inUse: boolean; onPick: () => void }) {
  const goal = goalMeta(recipe.goal)
  const steps = recipe.steps.slice(0, 4)
  const id = React.useId()
  return (
    // The name is the button; it stretches over the whole card so anywhere on it picks it.
    <article
      aria-labelledby={id}
      className="relative flex w-full flex-col rounded-xl border border-line bg-surface p-4 text-left shadow-xs transition-colors hover:border-primary/50 has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-primary"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
          <FlowIcon name={goal.icon} className="size-4" />
        </span>
        <h4 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          <button id={id} type="button" onClick={onPick} className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none">
            {recipe.name}
          </button>
        </h4>
        {inUse ? (
          <Badge variant="success" size="sm">
            <Check /> In use
          </Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-snug text-muted">{recipe.blurb}</p>
      <ol aria-label="Steps" className="mt-3 mb-3.5 flex list-none flex-col gap-1.5 p-0">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-2 text-xs text-muted">
            <span aria-hidden="true" className="mt-px grid size-4 shrink-0 place-items-center rounded-full border border-line text-xs leading-none text-subtle tabular-nums">
              {index + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
        {recipe.steps.length > steps.length ? <li className="pl-6 text-xs text-subtle">and {recipe.steps.length - steps.length} more</li> : null}
      </ol>
      <div className="mt-auto flex items-start justify-between gap-3 border-t border-line-subtle pt-3">
        <p className="flex min-w-0 items-start gap-1.5 text-xs leading-snug text-foreground">
          <TrendingUp className="mt-px size-3.5 shrink-0 text-success" aria-hidden="true" />
          {recipe.outcome}
        </p>
        {purpose ? <span className="shrink-0 text-xs text-subtle">{PURPOSE_LABEL[purpose]}</span> : null}
      </div>
    </article>
  )
}

/* ---------- the guided questions ---------- */

function SetupStage({
  recipe,
  answers,
  onAnswers,
  ctx,
  lookups,
  backLabel,
  onBack,
  onStart,
}: {
  recipe: Recipe
  answers: RecipeAnswers
  onAnswers: (answers: RecipeAnswers) => void
  ctx: { activities: { slug: string; name: string }[]; nowIso: string; business: string }
  lookups?: DescribeLookups
  backLabel: string
  onBack: () => void
  onStart: (flow: Flow) => void
}) {
  const settled = React.useMemo(() => settleAnswers(recipe, answers), [recipe, answers])
  const flow = React.useMemo(() => {
    try {
      return recipe.build(settled, ctx)
    } catch {
      return null
    }
  }, [recipe, settled, ctx])
  const summary = React.useMemo(() => (flow ? describeFlow(flow, { activities: ctx.activities, ...lookups }) : []), [flow, ctx.activities, lookups])
  const questions = (recipe.questions ?? []).slice(0, 3)
  // A discount that only applies with a code is hidden while the code is off.
  const shown = questions.filter((question) => !(question.id === 'percent' && settled.withCode === false))
  const set = (id: string, value: RecipeAnswers[string]) => onAnswers({ ...answers, [id]: value })

  return (
    <>
      <DialogBody className="py-5">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div className="flex flex-col gap-6">
            <button type="button" onClick={onBack} className="inline-flex w-max items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
              <ArrowLeft className="size-4" aria-hidden="true" />
              {backLabel}
            </button>

            {shown.length > 0 ? (
              <ol className="flex list-none flex-col gap-5 p-0">
                {shown.map((question, index) => (
                  <li key={question.id} className="rounded-xl border border-line bg-surface p-4">
                    <p className="text-xs font-medium text-subtle">Question {index + 1} of {shown.length}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{question.label}</p>
                    {question.help ? <p className="mt-0.5 text-xs text-subtle">{question.help}</p> : null}
                    <div className="mt-3">
                      <QuestionControl question={question} value={settled[question.id]} onChange={(value) => set(question.id, value)} activities={ctx.activities} />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="text-sm font-semibold text-foreground">Nothing to set up</p>
                <p className="mt-0.5 text-sm text-muted">It works as it is. Open it to read the wording, then turn it on when you are happy.</p>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4 rounded-xl border border-line bg-surface-sunken/50 p-4 lg:self-start">
            <div>
              <p className="text-xs font-medium text-subtle">What it will do</p>
              {summary.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-foreground">
                  {summary.map((sentence, index) => (
                    <p key={index}>{sentence}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">This one could not be set up with these answers. Try the defaults.</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 border-t border-line pt-3 text-xs text-muted">
              <p className="flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-success" aria-hidden="true" />
                {recipe.outcome}
              </p>
              {flow ? <p>{flow.purpose === 'marketing' ? 'Marketing: only guests who agreed to hear from you get it, with an unsubscribe link.' : 'Booking message: goes to every guest it applies to.'}</p> : null}
              <p>It starts as a draft. Nothing goes out until you turn it on.</p>
            </div>
          </aside>
        </div>
      </DialogBody>
      <DialogFooter divider>
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button rightIcon={<ArrowRight />} disabled={!flow} onClick={() => flow && onStart(flow)}>
          Open in the builder
        </Button>
      </DialogFooter>
    </>
  )
}

function QuestionControl({
  question,
  value,
  onChange,
  activities,
}: {
  question: RecipeQuestion
  value: RecipeAnswers[string] | undefined
  onChange: (value: RecipeAnswers[string]) => void
  activities: { slug: string; name: string }[]
}) {
  if (question.kind === 'activities') {
    const list = Array.isArray(value) ? value : []
    return (
      <div role="group" aria-label={question.label} className="flex flex-wrap gap-1.5">
        <Chip on={list.length === 0} onClick={() => onChange([])}>All activities</Chip>
        {activities.map((activity) => {
          const on = list.includes(activity.slug)
          return (
            <Chip key={activity.slug} on={on} onClick={() => onChange(on ? list.filter((slug) => slug !== activity.slug) : [...list, activity.slug])}>
              {activity.name}
            </Chip>
          )
        })}
      </div>
    )
  }
  if (question.kind === 'yesno') {
    return (
      <Segmented
        label={question.label}
        value={value === true ? 'yes' : 'no'}
        onValueChange={(next) => onChange(next === 'yes')}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />
    )
  }
  const n = typeof value === 'number' ? value : question.default
  const unit = question.kind === 'percent' ? '%' : question.kind === 'days' ? (n === 1 ? 'day' : 'days') : (question.unit ?? '')
  // Discounts: the usual sizes. How full a departure is: the usual thresholds.
  const presets = question.kind === 'percent' ? (question.id === 'fillBelow' ? [30, 50, 70] : [10, 15, 20, 25]).filter((entry) => entry >= question.min && entry <= question.max) : []
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Stepper label={question.label} value={n} min={question.min} max={question.max} step={question.kind === 'percent' ? 5 : 1} unit={unit} onChange={onChange} />
      {presets.length > 0 ? (
        <div role="group" aria-label="Common choices" className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <Chip key={preset} on={n === preset} onClick={() => onChange(preset)}>
              {preset}%
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Stepper({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)))
  // What is typed stays as typed until it is a whole number in range (or the field is left), so 25 can be typed past a minimum of 5.
  const [text, setText] = React.useState(String(value))
  const [shownFor, setShownFor] = React.useState(value)
  if (value !== shownFor) {
    setShownFor(value)
    setText(String(value))
  }
  const commit = () => {
    const next = Number(text)
    const settled = text.trim() === '' || !Number.isFinite(next) ? value : clamp(next)
    setText(String(settled))
    if (settled !== value) onChange(settled)
  }
  // Steps of five land on round numbers: 12 → 15, not 17.
  const down = () => onChange(clamp(step > 1 && value % step !== 0 ? Math.floor(value / step) * step : value - step))
  const up = () => onChange(clamp(step > 1 && value % step !== 0 ? Math.ceil(value / step) * step : value + step))
  return (
    <div className="inline-flex items-center gap-1.5">
      <IconButton aria-label={`Less: ${label}`} variant="secondary" size="sm" disabled={value <= min} onClick={down}>
        <Minus />
      </IconButton>
      <Input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const next = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isInteger(next) && next >= min && next <= max) onChange(next)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        suffix={unit || undefined}
        className="w-32"
        inputClassName="text-center tabular-nums"
      />
      <IconButton aria-label={`More: ${label}`} variant="secondary" size="sm" disabled={value >= max} onClick={up}>
        <Plus />
      </IconButton>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('rounded-full border px-3 py-1 text-sm transition-colors', on ? 'border-primary bg-primary-soft text-foreground' : 'border-line text-muted hover:border-line-strong hover:text-foreground')}
    >
      {children}
    </button>
  )
}

/* ---------- start from scratch: what starts it ---------- */

function ScratchStage({ nowIso, onStart }: { nowIso: string; onStart: (flow: Flow) => void }) {
  return (
    <div className="flex flex-col gap-7">
      {TRIGGER_GROUPS.map((group) => {
        const list = TRIGGERS.filter((trigger) => trigger.group === group)
        if (list.length === 0) return null
        return (
          <section key={group} aria-label={group}>
            <h3 className="mb-3 text-sm font-semibold text-foreground">{group}</h3>
            <ul className="grid list-none gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((trigger) => (
                <li key={trigger.type} className="flex">
                  <button
                    type="button"
                    onClick={() => onStart(blankFlow({ trigger: trigger.type, nowIso }))}
                    className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
                      <FlowIcon name={trigger.icon} className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{trigger.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-subtle">{trigger.help}</span>
                      {trigger.volume === 'none' ? <span className="mt-1 block text-xs text-faint">Started by your team</span> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
