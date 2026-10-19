'use client'

import {
  AlarmClock,
  Armchair,
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
  type LucideIcon,
} from 'lucide-react'

import { paletteItem, triggerMeta, type IconName } from '@/lib/flows/catalog'
import type { FlowStep, TriggerType } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

/* ==========================================================================
   The catalog names its icons as strings so it stays server-safe; this is
   the one place those names become lucide components.
   ========================================================================== */

export const FLOW_ICONS: Record<IconName, LucideIcon> = {
  AlarmClock,
  Armchair,
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

export function iconFor(name: IconName | undefined): LucideIcon {
  return (name && FLOW_ICONS[name]) || Clock
}

export function FlowIcon({ name, className }: { name: IconName | undefined; className?: string }) {
  const Icon = iconFor(name)
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0', className)} />
}

export function stepIconName(step: FlowStep): IconName {
  return paletteItem(step.type === 'action' ? { type: 'action', action: step.action } : step).icon
}

export function triggerIconName(type: TriggerType): IconName {
  return triggerMeta(type).icon
}

/** The tinted tile a card's icon sits in. Messages read in the brand colour, questions in blue, the rest stay neutral. */
export function iconTone(kind: FlowStep['type'] | 'trigger' | 'who' | 'exit'): string {
  switch (kind) {
    case 'email':
    case 'sms':
      return 'bg-primary-soft text-primary'
    case 'branch':
    case 'split':
      return 'bg-info-soft text-info'
    case 'trigger':
      return 'bg-foreground text-background'
    default:
      return 'bg-surface-sunken text-subtle'
  }
}
