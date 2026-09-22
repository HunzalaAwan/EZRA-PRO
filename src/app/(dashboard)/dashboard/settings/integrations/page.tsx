'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3,
  Blocks,
  CheckCircle2,
  CreditCard,
  Globe,
  MessageSquare,
  Plug,
  Settings2,
  Wrench,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { INTEGRATIONS } from '@/content/marketing'
import { cn } from '@/lib/utils'
import type { Integration } from '@/types'

/* ==========================================================================
   CATEGORIES
   ========================================================================== */

type Category = Integration['category']

const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof Plug; chip: string }
> = {
  payments: { label: 'Payments', icon: CreditCard, chip: 'bg-chart-1/12 text-chart-1' },
  ota: { label: 'Marketplaces', icon: Globe, chip: 'bg-chart-2/12 text-chart-2' },
  marketing: { label: 'Marketing', icon: BarChart3, chip: 'bg-chart-3/12 text-chart-3' },
  accounting: { label: 'Accounting', icon: Settings2, chip: 'bg-chart-4/14 text-chart-4' },
  comms: { label: 'Communication', icon: MessageSquare, chip: 'bg-chart-5/12 text-chart-5' },
  ops: { label: 'Operations', icon: Wrench, chip: 'bg-chart-6/12 text-chart-6' },
}

const CATEGORY_ORDER: Category[] = ['payments', 'ota', 'marketing', 'accounting', 'comms', 'ops']

/** The apps this workspace already has switched on. */
const CONNECTED_AT_LOAD = new Set([
  'int-stripe',
  'int-viator',
  'int-gyg',
  'int-google',
  'int-klaviyo',
  'int-ga4',
  'int-quickbooks',
  'int-twilio',
  'int-slack',
])

/** Content authored for the marketing site carries HTML entities. */
function decode(text: string) {
  return text
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export default function IntegrationsSettingsPage() {
  const reduceMotion = useReducedMotionSafe()
  const [connected, setConnected] = React.useState<Set<string>>(new Set(CONNECTED_AT_LOAD))
  const [category, setCategory] = React.useState<Category | 'all' | 'connected'>('all')
  const [query, setQuery] = React.useState('')

  const toggle = React.useCallback((integration: Integration) => {
    setConnected((prev) => {
      const next = new Set(prev)
      if (next.has(integration.id)) {
        next.delete(integration.id)
        toast(`${integration.name} disconnected`, {
          description: 'Data already synced stays where it is.',
        })
      } else {
        next.add(integration.id)
        toast.success(`${integration.name} connected`, {
          description: 'First sync usually completes within a minute.',
        })
      }
      return next
    })
  }, [])

  const counts = React.useMemo(() => {
    const map = new Map<Category, number>()
    for (const i of INTEGRATIONS) map.set(i.category, (map.get(i.category) ?? 0) + 1)
    return map
  }, [])

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return INTEGRATIONS.filter((i) => {
      if (category === 'connected' && !connected.has(i.id)) return false
      if (category !== 'all' && category !== 'connected' && i.category !== category) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        decode(i.description).toLowerCase().includes(q) ||
        CATEGORY_META[i.category].label.toLowerCase().includes(q)
      )
    })
  }, [category, connected, query])

  const grouped = React.useMemo(() => {
    const map = new Map<Category, Integration[]>()
    for (const i of visible) {
      const list = map.get(i.category)
      if (list) list.push(i)
      else map.set(i.category, [i])
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map(
      (c) => [c, map.get(c) as Integration[]] as const,
    )
  }, [visible])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ---------------- Summary ---------------- */}
      <Card variant="gradient">
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface shadow-sm ring-1 ring-line"
          >
            <Blocks className="size-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
              {connected.size} of {INTEGRATIONS.length} apps connected
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              Availability, guests and payouts stay in sync automatically. Nothing here needs a
              developer.
            </p>
          </div>
          <Button variant="outline" size="sm" leftIcon={<Plug />}>
            Browse directory
          </Button>
        </CardContent>
      </Card>

      {/* ---------------- Filters ---------------- */}
      <div className="flex flex-col gap-3">
        <SearchInput
          label="Search integrations"
          placeholder="Search integrations…"
          debounceMs={120}
          onValueChange={setQuery}
          className="max-w-md"
        />

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <FilterChip
            active={category === 'all'}
            onClick={() => setCategory('all')}
            label="All apps"
            count={INTEGRATIONS.length}
          />
          <FilterChip
            active={category === 'connected'}
            onClick={() => setCategory('connected')}
            label="Connected"
            count={connected.size}
          />
          {CATEGORY_ORDER.map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={CATEGORY_META[c].label}
              count={counts.get(c) ?? 0}
            />
          ))}
        </div>
      </div>

      {/* ---------------- Grid ---------------- */}
      {visible.length === 0 ? (
        <EmptyState
          variant="no-results"
          title="No integrations match that"
          description="Try a different category, or clear the search to see all 20 apps."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCategory('all')
                setQuery('')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-7">
          {grouped.map(([cat, items]) => {
            const meta = CATEGORY_META[cat]
            const Icon = meta.icon
            return (
              <section key={cat} aria-labelledby={`integrations-${cat}`}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="size-4 text-subtle" aria-hidden="true" />
                  <h3
                    id={`integrations-${cat}`}
                    className="font-display text-sm font-semibold tracking-tight text-foreground"
                  >
                    {meta.label}
                  </h3>
                  <span className="text-xs text-faint tabular">{items.length}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {items.map((integration) => (
                      <motion.div
                        key={integration.id}
                        layout={!reduceMotion}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
                        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <IntegrationCard
                          integration={integration}
                          connected={connected.has(integration.id)}
                          onToggle={() => toggle(integration)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* ---------------- Custom ---------------- */}
      <Card variant="outline" className="border-dashed">
        <CardHeader>
          <CardTitle>Build your own</CardTitle>
          <CardDescription>
            The REST API and webhooks cover every object you see in this dashboard — activities,
            departures, bookings, guests and payouts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button variant="outline" size="sm">
            View API docs
          </Button>
          <Button variant="ghost" size="sm">
            Create an API key
          </Button>
          <Button variant="ghost" size="sm">
            Webhook endpoints
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================== */

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5',
        'text-[0.8125rem] font-medium whitespace-nowrap',
        'transition-colors duration-200 ease-[var(--ease-out-expo)]',
        active
          ? 'border-primary/40 bg-primary-soft text-primary'
          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs tabular',
          active ? 'bg-primary/15' : 'bg-surface-sunken text-faint',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function IntegrationCard({
  integration,
  connected,
  onToggle,
}: {
  integration: Integration
  connected: boolean
  onToggle: () => void
}) {
  const meta = CATEGORY_META[integration.category]
  const switchId = `integration-${integration.id}`

  return (
    <Card
      className={cn(
        'h-full transition-all duration-300 ease-[var(--ease-out-expo)]',
        connected
          ? 'border-primary/30 shadow-md'
          : 'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
      )}
    >
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-xl font-display text-sm font-bold',
              meta.chip,
            )}
          >
            {integration.name.slice(0, 2).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{integration.name}</p>
            <p className="text-xs text-subtle">{meta.label}</p>
          </div>

          <Switch
            id={switchId}
            size="sm"
            checked={connected}
            onCheckedChange={onToggle}
            aria-label={`${connected ? 'Disconnect' : 'Connect'} ${integration.name}`}
            className="mt-0.5 shrink-0"
          />
        </div>

        <p className="flex-1 text-xs leading-relaxed text-muted">
          {decode(integration.description)}
        </p>

        <div className="flex items-center justify-between gap-2 border-t border-line-subtle pt-3">
          {connected ? (
            <Badge variant="success" size="sm">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" size="sm">
              Not connected
            </Badge>
          )}

          {connected ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                toast(`${integration.name} settings`, {
                  description: 'Field mapping and sync frequency open in a side panel.',
                })
              }
            >
              Configure
            </Button>
          ) : (
            <Button variant="outline" size="xs" onClick={onToggle}>
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
