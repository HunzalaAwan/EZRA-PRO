import type { OrderLine } from '@/lib/hospitality/types'
import { cn } from '@/lib/utils'

import { compactLines, ticketGroups, type TicketGroup } from './order-line-text'

/* ==========================================================================
   <OrderLineChoices> — what the guest picked on one order line, grouped
   the way the kitchen reads it. Full size on the ticket: a small heading
   per group, "2× Extra feta", removals in red, a linked dish's own picks
   indented, the meal under its own divider. Compact on a board card: one
   short line per group. Old lines show their flat labels.
   ========================================================================== */

export interface OrderLineChoicesProps {
  line: Pick<OrderLine, 'choices' | 'modifiers'>
  /** One line per group, for board cards. */
  compact?: boolean
  /** Kitchen headings and short labels. */
  kitchen?: boolean
  /** Most group lines in compact mode. */
  maxLines?: number
  className?: string
}

export function OrderLineChoices({ line, compact = false, kitchen = false, maxLines = 3, className }: OrderLineChoicesProps) {
  if (compact) {
    const lines = compactLines(line, kitchen)
    if (!lines.length) return null
    const shown = lines.slice(0, maxLines)
    return (
      <span className={cn('flex min-w-0 flex-col', className)}>
        {shown.map((text, index) => (
          <span key={index} className="block truncate text-xs text-muted">
            {text}
          </span>
        ))}
        {lines.length > shown.length ? <span className="text-xs text-subtle">+{lines.length - shown.length} more</span> : null}
      </span>
    )
  }

  const groups = ticketGroups(line, kitchen)
  if (!groups.length) return line.modifiers.length ? <p className={cn('text-xs text-muted', className)}>{line.modifiers.join(' · ')}</p> : null
  const dish = groups.filter((g) => !g.meal)
  const meal = groups.filter((g) => g.meal)
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {dish.map((g, index) => (
        <Group key={`d${index}`} group={g} />
      ))}
      {meal.length ? (
        <>
          <div className="flex items-center gap-2 pt-0.5" role="separator" aria-label="Meal">
            <span className="text-xs font-medium text-muted">Meal</span>
            <span className="h-px flex-1 bg-line-subtle" />
          </div>
          {meal.map((g, index) => (
            <Group key={`m${index}`} group={g} />
          ))}
        </>
      ) : null}
    </div>
  )
}

function Group({ group, nested = false }: { group: TicketGroup; nested?: boolean }) {
  return (
    <div className={cn('min-w-0', nested && 'border-l border-line pl-2.5')}>
      <p className="text-xs font-medium uppercase tracking-wide text-subtle">{group.heading}</p>
      <ul className="flex flex-col gap-0.5">
        {group.picks.map((pick, index) => (
          <li key={index} className="min-w-0">
            <span className={cn('text-xs', pick.remove ? 'font-medium text-danger' : 'text-foreground')}>{pick.text}</span>
            {pick.nested.length ? (
              <div className="mt-1 flex flex-col gap-1 pl-1">
                {pick.nested.map((g, n) => (
                  <Group key={n} group={g} nested />
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
