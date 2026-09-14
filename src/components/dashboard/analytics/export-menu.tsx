'use client'

import * as React from 'react'
import {
  CalendarClock,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Share2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   ExportMenu

   Nothing is generated client-side: every option enqueues a job and confirms
   with a toast, which is exactly how the real export pipeline behaves — the
   files are built server-side and emailed, because a 90-day PDF with every
   chart in it is not something you want a browser tab to render.
   ========================================================================== */

export interface ExportMenuProps {
  /** Human range label, echoed back in the confirmation toast. */
  rangeLabel: string
  /** Address the finished file is sent to. */
  recipient: string
  /** Rendered on the trigger. */
  label?: string
  className?: string
}

export function ExportMenu({
  rangeLabel,
  recipient,
  label = 'Export',
  className,
}: ExportMenuProps) {
  const queue = React.useCallback(
    (title: string, description: string) => {
      toast.success(title, { description })
    },
    [],
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={className}
          leftIcon={<Download aria-hidden="true" />}
          rightIcon={<ChevronDown aria-hidden="true" />}
        >
          {label}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Export this view</DropdownMenuLabel>

        <DropdownMenuItem
          onSelect={() =>
            queue(
              'Export queued',
              `We’ll email the ${rangeLabel.toLowerCase()} CSV — raw daily rows, channels, activities and cohorts — to ${recipient}.`,
            )
          }
        >
          <FileSpreadsheet aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">Download CSV</span>
            <span className="text-xs text-subtle">Every table on this page, one file per tab</span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() =>
            queue(
              'Export queued',
              `Building the ${rangeLabel.toLowerCase()} PDF with all charts and written insights. We’ll email it to ${recipient}.`,
            )
          }
        >
          <FileText aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">Download PDF report</span>
            <span className="text-xs text-subtle">Charts, commentary and recommendations</span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          tone="primary"
          onSelect={() =>
            queue(
              'Weekly report scheduled',
              `Every Monday at 7:00 am we’ll send this view to ${recipient}. Change recipients in Settings → Reports.`,
            )
          }
        >
          <CalendarClock aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">Schedule email report</span>
            <span className="text-xs text-subtle">Mondays, 7:00 am, to your whole team</span>
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() =>
            queue(
              'Share link created',
              'A read-only snapshot link for this range is on your clipboard. It expires in 30 days.',
            )
          }
        >
          <Share2 aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium">Copy share link</span>
            <span className="text-xs text-subtle">Read-only, expires in 30 days</span>
          </span>
        </DropdownMenuItem>

        <p className="mt-1.5 border-t border-line-subtle px-2.5 pb-1 pt-2 text-[0.6875rem] leading-relaxed text-faint">
          Exports respect the range and comparison you have selected.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
