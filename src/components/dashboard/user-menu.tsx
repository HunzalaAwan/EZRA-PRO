'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Keyboard, LifeBuoy, LogOut, SlidersHorizontal, UserRound } from 'lucide-react'

import { CURRENT_USER } from '@/lib/demo-core'
import { useWorkspace } from '@/components/dashboard/workspace-provider'
import { cn, titleCase } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KbdGroup } from '@/components/ui/kbd'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   USER MENU
   ========================================================================== */

const SHORTCUTS: { group: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: 'General',
    items: [
      { keys: ['⌘', 'K'], label: 'Open command palette' },
      { keys: ['⌘', 'B'], label: 'Collapse or expand the sidebar' },
      { keys: ['⌘', '/'], label: 'Keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close any panel or dialog' },
    ],
  },
  {
    group: 'Navigate',
    items: [
      { keys: ['G', 'O'], label: 'Overview' },
      { keys: ['G', 'C'], label: 'Calendar' },
      { keys: ['G', 'B'], label: 'Bookings' },
      { keys: ['G', 'M'], label: 'Manifest' },
    ],
  },
  {
    group: 'Actions',
    items: [
      { keys: ['N'], label: 'New booking' },
      { keys: ['A'], label: 'New activity' },
      { keys: ['⌘', 'Enter'], label: 'Save and close' },
    ],
  },
]

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader divider>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            EZRA Pro is built to be driven from the keyboard — these work anywhere in the dashboard.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-6 sm:grid-cols-3">
          {SHORTCUTS.map((section) => (
            <section key={section.group}>
              <h3 className="mb-2.5 text-[0.6875rem] font-semibold tracking-[0.09em] text-faint uppercase">
                {section.group}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {section.items.map((shortcut) => (
                  <li key={shortcut.label} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-[0.8125rem] text-muted">{shortcut.label}</span>
                    <KbdGroup keys={shortcut.keys} size="sm" className="shrink-0" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export function UserMenu({ className }: { className?: string }) {
  const { tenant } = useWorkspace()
  const router = useRouter()
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  // ⌘/ — the shortcut the menu advertises, so it had better work.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setShortcutsOpen((previous) => !previous)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Account menu for ${CURRENT_USER.name}`}
            className={cn(
              'rounded-full transition-transform duration-200 ease-[var(--ease-out-expo)]',
              'hover:scale-[1.04] active:scale-[0.96]',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              className,
            )}
          >
            <Avatar
              size="sm"
              name={CURRENT_USER.name}
              src={CURRENT_USER.avatarUrl}
              className="ring-1 ring-line"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={10} className="w-[16.5rem]">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar size="md" name={CURRENT_USER.name} src={CURRENT_USER.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-semibold tracking-[-0.01em]">
                {CURRENT_USER.name}
              </p>
              <p className="truncate text-[0.6875rem] text-subtle">{CURRENT_USER.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-2.5">
            <Badge variant="primary" size="sm">
              {titleCase(CURRENT_USER.role)}
            </Badge>
            <Badge variant="outline" size="sm" className="max-w-full truncate">
              {tenant.name}
            </Badge>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link href="/dashboard/team">
              <UserRound aria-hidden="true" />
              Profile
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings">
              <SlidersHorizontal aria-hidden="true" />
              Preferences
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
            <Keyboard aria-hidden="true" />
            Keyboard shortcuts
            <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href="/contact">
              <LifeBuoy aria-hidden="true" />
              Help &amp; support
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            tone="danger"
            onSelect={() => {
              toast('Signed out', { description: 'See you soon, ' + CURRENT_USER.name.split(' ')[0] + '.' })
              router.push('/login')
            }}
          >
            <LogOut aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  )
}
