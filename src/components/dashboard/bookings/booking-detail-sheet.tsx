'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/icon-button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BookingDetailContent } from '@/components/dashboard/bookings/booking-detail'
import { fetchBookingDetail, type BookingDetailData } from '@/lib/actions/dashboard'

/* ==========================================================================
   BOOKING DETAIL SHEET
   The reservations desk never navigates away to read a booking — the whole
   record slides in over the list, with prev/next so an operator can walk a
   filtered queue without bouncing back to the table.
   ========================================================================== */

export interface BookingDetailSheetProps {
  /** `null` keeps the sheet closed. */
  bookingId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Human reference for the panel heading, e.g. "EZR-8KQ2M". */
  reference?: string
  /** Position inside the current result set, for the "3 of 25" affordance. */
  position?: { index: number; total: number }
  onPrevious?: () => void
  onNext?: () => void
  className?: string
}

export function BookingDetailSheet({
  bookingId,
  open,
  onOpenChange,
  reference,
  position,
  onPrevious,
  onNext,
  className,
}: BookingDetailSheetProps) {
  const hasNav = Boolean(onPrevious || onNext)

  // The record is loaded through a Server Action so the bookings index never
  // ships to the client; the previous record stays on screen while the next
  // one is in flight, which keeps prev/next walking feel instant.
  const [detail, setDetail] = React.useState<BookingDetailData | null>(null)
  React.useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    fetchBookingDetail(bookingId).then((next) => {
      if (!cancelled) setDetail(next)
    })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        size="xl"
        className={cn('w-full sm:max-w-3xl', className)}
      >
        <SheetHeader className="flex-row items-center gap-3">
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">
              {reference ? (
                <span className="font-mono tracking-tight">{reference}</span>
              ) : (
                'Reservation'
              )}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Full reservation record, guest profile and payment history
            </SheetDescription>
          </div>

          {hasNav ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {position ? (
                <Badge variant="neutral" size="sm" className="tabular-nums">
                  {position.index + 1} of {position.total}
                </Badge>
              ) : null}
              <IconButton
                aria-label="Previous reservation"
                size="sm"
                variant="secondary"
                onClick={onPrevious}
                disabled={!onPrevious}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                aria-label="Next reservation"
                size="sm"
                variant="secondary"
                onClick={onNext}
                disabled={!onNext}
              >
                <ChevronRight />
              </IconButton>
            </div>
          ) : null}
        </SheetHeader>

        <SheetBody className="bg-background-subtle px-4 py-4 sm:px-5">
          {bookingId && detail && detail.booking.id === bookingId ? (
            <BookingDetailContent
              key={bookingId}
              detail={detail}
              layout="panel"
              onRequestClose={() => onOpenChange(false)}
            />
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
