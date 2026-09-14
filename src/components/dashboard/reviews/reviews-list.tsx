'use client'

/**
 * Reputation inbox. Every rated booking becomes a card; low ratings that nobody
 * has answered yet float to the top of the "Needs a reply" view and carry a
 * warning rail so they cannot be scrolled past.
 */

import * as React from 'react'
import Link from 'next/link'
import {
  CornerDownRight,
  Download,
  Filter,
  MessageSquareOff,
  MessageSquareWarning,
  Send,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react'

import { cn, formatCurrency, formatDateLong, formatNumber, formatRelative } from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
import { countryFlag } from '@/components/charts/geo-bars'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { StarRating } from '@/components/dashboard/reviews/rating-summary'
import type { Activity, CurrencyCode } from '@/types'

export interface ReviewItem {
  /** The booking id — a review is a rated booking. */
  id: string
  reference: string
  guestId: string
  guestName: string
  guestAvatar?: string
  countryCode: string
  rating: number
  text?: string
  activityId: string
  activityName: string
  colorKey: Activity['colorKey']
  departureAt: string
  channelLabel: string
  partySize: number
  /** Minor units. */
  total: number
}

export interface ReviewActivityOption {
  id: string
  name: string
  count: number
  average: number
}

export interface ReviewsListProps {
  /** The loaded working set — the most recent reviews, not the whole archive. */
  reviews: ReviewItem[]
  /** Every rated booking on file, for an honest "N of M" readout. */
  totalCount: number
  activities: ReviewActivityOption[]
  currency: CurrencyCode
  operator: { name: string; title: string; avatarUrl?: string }
  className?: string
}

type ViewKey = 'all' | 'attention' | 'comments' | 'replied'
type SortKey = 'newest' | 'oldest' | 'lowest' | 'highest'

const VIEWS: { value: ViewKey; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'attention', label: 'Needs a reply' },
  { value: 'comments', label: 'With comments' },
  { value: 'replied', label: 'Replied' },
]

const RANGES: { value: string; label: string; days: number }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '14d', label: 'Last 14 days', days: 14 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: 'all', label: 'All loaded', days: 100_000 },
]

const DAY_MS = 86_400_000

function ratingTone(rating: number) {
  if (rating >= 4) return 'text-success'
  if (rating === 3) return 'text-warning'
  return 'text-danger'
}

function templatesFor(review: ReviewItem, operatorName: string) {
  const first = review.guestName.split(' ')[0]
  if (review.rating >= 4) {
    return [
      `Thank you ${first} — the crew will be thrilled to read this. Come see us again soon!`,
      `So glad you enjoyed ${review.activityName}, ${first}. We’ve passed your note to the whole team.`,
    ]
  }
  return [
    `${first}, thank you for the honest feedback — this isn’t the standard we hold ourselves to. I’d like to make it right; I’ll email you today. — ${operatorName}`,
    `I’m sorry ${review.activityName} fell short, ${first}. We’ve reviewed this with the crew and would love another chance to host you.`,
  ]
}

/* ========================================================================== */

export function ReviewsList({
  reviews,
  totalCount,
  activities,
  currency,
  operator,
  className,
}: ReviewsListProps) {
  const [view, setView] = React.useState<ViewKey>('all')
  const [rating, setRating] = React.useState<string>('all')
  const [activityId, setActivityId] = React.useState<string>('all')
  const [range, setRange] = React.useState<string>('30d')
  const [sort, setSort] = React.useState<SortKey>('newest')
  const [query, setQuery] = React.useState('')
  const [visible, setVisible] = React.useState(12)
  const [openReply, setOpenReply] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const [replies, setReplies] = React.useState<Record<string, { body: string; at: string }>>({})

  const rangeDays = RANGES.find((option) => option.value === range)?.days ?? 100_000

  const inRange = React.useMemo(() => {
    const cutoff = NOW.getTime() - rangeDays * DAY_MS
    return reviews.filter((review) => new Date(review.departureAt).getTime() >= cutoff)
  }, [reviews, rangeDays])

  const attentionCount = React.useMemo(
    () => inRange.filter((review) => review.rating <= 3 && !replies[review.id]).length,
    [inRange, replies],
  )

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()

    const matches = inRange.filter((review) => {
      if (view === 'attention' && !(review.rating <= 3 && !replies[review.id])) return false
      if (view === 'comments' && !review.text) return false
      if (view === 'replied' && !replies[review.id]) return false

      if (rating === 'low' && review.rating > 3) return false
      if (rating !== 'all' && rating !== 'low' && review.rating !== Number(rating)) return false

      if (activityId !== 'all' && review.activityId !== activityId) return false

      if (!needle) return true
      return (
        review.guestName.toLowerCase().includes(needle) ||
        review.activityName.toLowerCase().includes(needle) ||
        review.reference.toLowerCase().includes(needle) ||
        (review.text ?? '').toLowerCase().includes(needle)
      )
    })

    return matches.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.departureAt.localeCompare(b.departureAt)
        case 'lowest':
          return a.rating - b.rating || b.departureAt.localeCompare(a.departureAt)
        case 'highest':
          return b.rating - a.rating || b.departureAt.localeCompare(a.departureAt)
        case 'newest':
        default:
          return b.departureAt.localeCompare(a.departureAt)
      }
    })
  }, [inRange, view, rating, activityId, query, sort, replies])

  React.useEffect(() => {
    setVisible(12)
  }, [view, rating, activityId, range, query, sort])

  const page = filtered.slice(0, visible)
  const filtersActive =
    view !== 'all' || rating !== 'all' || activityId !== 'all' || query.length > 0

  const resetFilters = () => {
    setView('all')
    setRating('all')
    setActivityId('all')
    setQuery('')
  }

  const submitReply = (review: ReviewItem) => {
    const body = draft.trim()
    if (!body) {
      toast.error('Write a reply first.')
      return
    }
    setReplies((current) => ({ ...current, [review.id]: { body, at: NOW.toISOString() } }))
    setOpenReply(null)
    setDraft('')
    toast.success(`Reply published to ${review.guestName}`, {
      description: `${review.activityName} · ${review.rating}★`,
    })
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* ---- filters ---- */}
      <Card>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="Review view"
              value={view}
              onValueChange={(next) => setView(next as ViewKey)}
              size="sm"
              options={VIEWS.map((option) => ({
                value: option.value,
                label: option.label,
                count: option.value === 'attention' ? attentionCount : undefined,
              }))}
            />

            <div className="flex items-center gap-2">
              {filtersActive ? (
                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<X className="size-3.5" />}
                  onClick={resetFilters}
                >
                  Clear
                </Button>
              ) : null}
              <p className="tabular hidden text-xs text-subtle sm:block">
                <span className="font-medium text-foreground">{formatNumber(filtered.length)}</span>{' '}
                shown · {formatNumber(totalCount)} all-time
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search guest, trip or wording…"
              size="sm"
              aria-label="Search reviews"
              fieldClassName="w-full sm:w-64"
            />

            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger
                size="sm"
                className="w-[9.5rem]"
                aria-label="Filter by rating"
                icon={<Star className="size-3.5" />}
              >
                <SelectValue placeholder="All ratings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ratings</SelectItem>
                <SelectItem value="5">5 stars</SelectItem>
                <SelectItem value="4">4 stars</SelectItem>
                <SelectItem value="3">3 stars</SelectItem>
                <SelectItem value="2">2 stars</SelectItem>
                <SelectItem value="1">1 star</SelectItem>
                <SelectItem value="low">3 stars and below</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityId} onValueChange={setActivityId}>
              <SelectTrigger
                size="sm"
                className="w-full sm:w-56"
                aria-label="Filter by activity"
                icon={<Filter className="size-3.5" />}
              >
                <SelectValue placeholder="All activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activities</SelectItem>
                {activities.map((activity) => (
                  <SelectItem
                    key={activity.id}
                    value={activity.id}
                    description={`${activity.average.toFixed(2)}★ · ${formatNumber(activity.count)} reviews`}
                  >
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={range} onValueChange={setRange}>
              <SelectTrigger size="sm" className="w-[9.5rem]" aria-label="Filter by date">
                <SelectValue placeholder="Last 30 days" />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(next) => setSort(next as SortKey)}>
              <SelectTrigger size="sm" className="w-[9.5rem] sm:ml-auto" aria-label="Sort reviews">
                <SelectValue placeholder="Newest" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="lowest">Lowest rated</SelectItem>
                <SelectItem value="highest">Highest rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* ---- list ---- */}
      {page.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              variant="no-results"
              icon={MessageSquareOff}
              title="No reviews match those filters"
              description="Widen the date range or clear the rating filter to see more."
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {page.map((review) => {
            const reply = replies[review.id]
            const needsAttention = review.rating <= 3 && !reply
            const isOpen = openReply === review.id

            return (
              <li key={review.id}>
                <Card
                  className={cn(
                    'overflow-hidden transition-[border-color,box-shadow] duration-300',
                    needsAttention && 'border-warning/45 shadow-md',
                  )}
                >
                  {needsAttention ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-warning"
                    />
                  ) : null}

                  <div className="p-4 sm:p-5">
                    {/* header */}
                    <div className="flex items-start gap-3">
                      <Link href={`/dashboard/customers/${review.guestId}`} className="shrink-0">
                        <Avatar name={review.guestName} src={review.guestAvatar} size="md" />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/dashboard/customers/${review.guestId}`}
                            className="truncate text-sm font-semibold text-foreground transition-colors hover:text-primary"
                          >
                            {review.guestName}
                          </Link>
                          <span aria-hidden="true" className="text-xs leading-none">
                            {countryFlag(review.countryCode)}
                          </span>
                          {needsAttention ? (
                            <Badge size="sm" variant="warning">
                              <MessageSquareWarning aria-hidden="true" />
                              Needs a reply
                            </Badge>
                          ) : null}
                          {reply ? (
                            <Badge size="sm" variant="success">
                              <CornerDownRight aria-hidden="true" />
                              Replied
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <StarRating value={review.rating} size="sm" />
                          <span className={cn('tabular text-xs font-semibold', ratingTone(review.rating))}>
                            {review.rating}.0
                          </span>
                          <span className="text-[0.6875rem] text-faint" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-subtle">
                            {formatRelative(review.departureAt, NOW)}
                          </span>
                          <span className="text-[0.6875rem] text-faint" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-xs text-subtle">{review.channelLabel}</span>
                        </div>
                      </div>

                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        <span className="tabular text-sm font-semibold text-foreground">
                          {formatCurrency(review.total, currency)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[0.6875rem] text-subtle">
                          <Users className="size-3" aria-hidden="true" />
                          {review.partySize}
                        </span>
                      </div>
                    </div>

                    {/* body */}
                    {review.text ? (
                      <blockquote className="mt-3 border-l-2 border-line pl-3 text-[0.8125rem] leading-relaxed text-muted">
                        {review.text}
                      </blockquote>
                    ) : (
                      <p className="mt-3 text-xs text-faint italic">
                        Rating only — this guest didn’t leave a comment.
                      </p>
                    )}

                    {/* meta */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Link
                          href={`/dashboard/activities/${review.activityId}`}
                          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground transition-colors hover:text-primary"
                        >
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-full"
                            style={{ background: ACTIVITY_COLOR_VAR[review.colorKey] }}
                          />
                          <span className="truncate">{review.activityName}</span>
                        </Link>
                        <span className="text-[0.6875rem] text-faint" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-xs text-subtle">
                          {formatDateLong(review.departureAt)}
                        </span>
                        <span className="font-mono text-[0.625rem] text-faint">
                          {review.reference}
                        </span>
                      </div>

                      {!reply ? (
                        <Button
                          variant={needsAttention ? 'primary' : 'outline'}
                          size="xs"
                          leftIcon={<CornerDownRight className="size-3.5" />}
                          onClick={() => {
                            setOpenReply(isOpen ? null : review.id)
                            setDraft('')
                          }}
                        >
                          {isOpen ? 'Cancel' : 'Reply'}
                        </Button>
                      ) : null}
                    </div>

                    {/* published reply */}
                    {reply ? (
                      <div className="mt-3 flex gap-2.5 rounded-xl border border-line-subtle bg-surface-sunken/60 p-3">
                        <Avatar
                          name={operator.name}
                          src={operator.avatarUrl}
                          size="xs"
                          className="mt-0.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[0.6875rem] text-subtle">
                            <span className="font-medium text-foreground">{operator.name}</span> ·{' '}
                            {operator.title} · {formatRelative(reply.at, NOW)}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted">{reply.body}</p>
                        </div>
                      </div>
                    ) : null}

                    {/* composer */}
                    {isOpen && !reply ? (
                      <div className="mt-3 rounded-xl border border-line bg-surface-sunken/50 p-3">
                        <Textarea
                          value={draft}
                          onChange={(event) => setDraft(event.currentTarget.value)}
                          rows={3}
                          autoFocus
                          placeholder={`Reply publicly to ${review.guestName.split(' ')[0]}…`}
                          aria-label={`Reply to ${review.guestName}`}
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Sparkles className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                          {templatesFor(review, operator.name).map((template, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setDraft(template)}
                              className="rounded-lg border border-line bg-surface px-2 py-1 text-[0.6875rem] text-muted transition-colors duration-200 hover:border-primary/50 hover:text-primary"
                            >
                              Suggested {index + 1}
                            </button>
                          ))}
                          <div className="ml-auto flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setOpenReply(null)
                                setDraft('')
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="xs"
                              leftIcon={<Send className="size-3.5" />}
                              onClick={() => submitReply(review)}
                            >
                              Publish reply
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {visible < filtered.length ? (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" onClick={() => setVisible((n) => n + 12)}>
            Load {Math.min(12, filtered.length - visible)} more
          </Button>
        </div>
      ) : filtered.length > 0 ? (
        <p className="pt-1 text-center text-xs text-faint">
          That’s all {formatNumber(filtered.length)} matching{' '}
          {filtered.length === 1 ? 'review' : 'reviews'} in the{' '}
          {formatNumber(reviews.length)} most recent of {formatNumber(totalCount)} on file.
        </p>
      ) : null}
    </div>
  )
}

/* ==========================================================================
   Header actions — keeps the reviews page itself a server component.
   ========================================================================== */

export function ReviewsPageActions({ pendingCount }: { pendingCount: number }) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Download className="size-4" />}
        onClick={() => toast.success('Review export queued')}
      >
        Export
      </Button>
      <Button
        size="sm"
        leftIcon={<Send className="size-4" />}
        onClick={() =>
          toast.success('Review requests scheduled', {
            description: `${formatNumber(pendingCount)} guests who travelled in the last 14 days will be asked tomorrow morning.`,
          })
        }
      >
        Request reviews
      </Button>
    </>
  )
}
