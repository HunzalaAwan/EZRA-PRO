'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, MoreHorizontal, Play, SkipForward } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import { HOUSEKEEPING_META, HOUSEKEEPING_TASK_LABEL, type HousekeepingStatus, type HousekeepingTask, type HousekeepingTaskStatus, type Room, type RoomType, type Stay } from '@/lib/hospitality/types'
import { cn } from '@/lib/utils'

import { Dot, StatTile, StatusWord, guestName } from './shared'

/* ==========================================================================
   <HousekeepingBoard> — the morning's rooms, one column per attendant.

   A card is one room to do: what kind of clean, by when, roughly how long,
   and anything the desk wants them to know. Rush turnovers sit at the top.
   ========================================================================== */

type Filter = 'all' | 'rush' | 'departure' | 'stayover' | 'done'

export interface Attendant {
  id: string
  name: string
  avatarUrl: string
}

export interface HousekeepingBoardProps {
  tasks: HousekeepingTask[]
  rooms: Room[]
  roomTypes: RoomType[]
  attendants: Attendant[]
  /** Arriving and in-house stays, for names and ETAs. */
  stays: Stay[]
  nowTime: string
}

const TASK_STATUS_META: Record<HousekeepingTaskStatus, { label: string; tone: string }> = {
  todo: { label: 'To do', tone: 'bg-warning' },
  in_progress: { label: 'In progress', tone: 'bg-info' },
  done: { label: 'Done', tone: 'bg-success' },
  skipped: { label: 'Skipped', tone: 'bg-line-strong' },
}

export function HousekeepingBoard({ tasks: initialTasks, rooms: initialRooms, roomTypes, attendants, stays, nowTime }: HousekeepingBoardProps) {
  const [tasks, setTasks] = React.useState(initialTasks)
  const [rooms, setRooms] = React.useState(initialRooms)
  const [filter, setFilter] = React.useState<Filter>('all')

  const roomById = React.useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])
  const typeById = React.useMemo(() => new Map(roomTypes.map((t) => [t.id, t])), [roomTypes])
  const stayById = React.useMemo(() => new Map(stays.map((s) => [s.id, s])), [stays])
  const attendantById = React.useMemo(() => new Map(attendants.map((a) => [a.id, a])), [attendants])

  const stats = React.useMemo(() => {
    const open = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
    const done = tasks.filter((t) => t.status === 'done').length
    const rush = open.filter((t) => t.priority === 'rush').length
    const minutes = open.reduce((s, t) => s + t.minutes, 0)
    const byState = (Object.keys(HOUSEKEEPING_META) as HousekeepingStatus[]).map((k) => ({ k, n: rooms.filter((r) => r.housekeeping === k).length }))
    return { open: open.length, done, rush, minutes, byState }
  }, [tasks, rooms])

  const visible = tasks.filter((t) => {
    switch (filter) {
      case 'rush':
        return t.priority === 'rush' && t.status !== 'done'
      case 'departure':
        return (t.kind === 'departure_clean' || t.kind === 'turnover') && t.status !== 'done'
      case 'stayover':
        return t.kind === 'stayover' && t.status !== 'done'
      case 'done':
        return t.status === 'done' || t.status === 'skipped'
      default:
        return t.status !== 'done' && t.status !== 'skipped'
    }
  })

  const columns = [{ id: null as string | null, name: 'Unassigned', avatarUrl: '' }, ...attendants]

  /* ---------- actions ---------- */

  const setTask = (id: string, change: (t: HousekeepingTask) => HousekeepingTask) => setTasks((current) => current.map((t) => (t.id === id ? change(t) : t)))
  const setRoom = (id: string, change: (r: Room) => Room) => setRooms((current) => current.map((r) => (r.id === id ? change(r) : r)))

  const start = (task: HousekeepingTask) => {
    setTask(task.id, (t) => ({ ...t, status: 'in_progress' }))
    if (task.kind !== 'maintenance' && task.kind !== 'arrival_inspect') setRoom(task.roomId, (r) => ({ ...r, housekeeping: 'in_progress' }))
    toast(`Room ${roomById.get(task.roomId)?.number} started`)
  }

  const finish = (task: HousekeepingTask) => {
    setTask(task.id, (t) => ({ ...t, status: 'done' }))
    const room = roomById.get(task.roomId)
    if (task.kind === 'arrival_inspect') setRoom(task.roomId, (r) => ({ ...r, housekeeping: 'inspected' }))
    else if (task.kind === 'maintenance') setRoom(task.roomId, (r) => ({ ...r, housekeeping: 'dirty', notes: null }))
    else setRoom(task.roomId, (r) => ({ ...r, housekeeping: 'clean' }))
    toast.success(`Room ${room?.number} ${task.kind === 'arrival_inspect' ? 'inspected' : 'clean'}`, {
      description: task.priority === 'rush' ? 'The desk has been told the room is ready.' : undefined,
    })
  }

  const skip = (task: HousekeepingTask) => {
    setTask(task.id, (t) => ({ ...t, status: 'skipped' }))
    toast(`Room ${roomById.get(task.roomId)?.number} skipped today`, { description: 'Do-not-disturb noted. It is back on tomorrow’s list.' })
  }

  const assign = (task: HousekeepingTask, assigneeId: string | null) => {
    setTask(task.id, (t) => ({ ...t, assigneeId }))
    toast(assigneeId ? `Room ${roomById.get(task.roomId)?.number} to ${attendantById.get(assigneeId)?.name.split(' ')[0]}` : `Room ${roomById.get(task.roomId)?.number} unassigned`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="To do" hint="rooms" value={stats.open} line={`About ${Math.round(stats.minutes / 60)} h ${stats.minutes % 60} min of work left`} tone="bg-warning" />
        <StatTile label="Rush" hint="arrival before the room is due" value={stats.rush} line={stats.rush ? 'Turnovers with a guest arriving early' : 'No rush rooms'} tone="bg-danger" active={filter === 'rush'} onClick={() => setFilter(filter === 'rush' ? 'all' : 'rush')} />
        <StatTile label="Done" hint={`since ${nowTime.startsWith('0') ? '07:00' : '07:00'}`} value={stats.done} line={`${attendants.length} attendants on today`} tone="bg-success" active={filter === 'done'} onClick={() => setFilter(filter === 'done' ? 'all' : 'done')} />
        <StatTile label="Rooms" hint="by state" value={rooms.length} line={stats.byState.filter((b) => b.n).map((b) => `${HOUSEKEEPING_META[b.k].label} ${b.n}`).join(' · ')} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            size="sm"
            label="Tasks"
            options={[
              { value: 'all', label: 'Open' },
              { value: 'rush', label: 'Rush' },
              { value: 'departure', label: 'Departures' },
              { value: 'stayover', label: 'Stayovers' },
              { value: 'done', label: 'Done' },
            ]}
            value={filter}
            onValueChange={setFilter}
          />
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/rooms">All rooms</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/front-desk">Front desk</Link>
            </Button>
          </div>
        </div>
        <CardContent className="p-3 sm:p-4">
          {visible.length === 0 ? (
            <EmptyState variant="no-data" size="sm" title={filter === 'done' ? 'Nothing finished yet' : 'Nothing to do'} description={filter === 'done' ? 'Finished rooms show here.' : 'Every room on the list is done.'} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {columns.map((col) => {
                const cards = visible.filter((t) => t.assigneeId === col.id).sort((a, b) => (a.priority === b.priority ? a.dueBy.localeCompare(b.dueBy) : a.priority === 'rush' ? -1 : 1))
                if (col.id === null && cards.length === 0) return null
                const minutes = cards.filter((t) => t.status !== 'done').reduce((s, t) => s + t.minutes, 0)
                return (
                  <section key={col.id ?? 'none'} aria-label={col.name} className="flex min-w-0 flex-col rounded-xl bg-surface-sunken/60 p-2">
                    <header className="flex items-center gap-2 px-1.5 pt-1 pb-2">
                      {col.id ? <Avatar name={col.name} src={col.avatarUrl} size="xs" /> : null}
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted">{col.name}</span>
                      <span className="text-xs text-faint tabular-nums">
                        {cards.length}
                        {minutes ? ` · ${Math.round(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}` : ''}
                      </span>
                    </header>
                    <div className="flex flex-col gap-2">
                      {cards.length === 0 ? <p className="px-1.5 py-6 text-center text-xs text-faint">All done</p> : null}
                      {cards.map((t) => {
                        const room = roomById.get(t.roomId)
                        const stay = room ? stayById.get(room.arrivingStayId ?? room.currentStayId ?? '') : undefined
                        const arriving = room?.arrivingStayId ? stayById.get(room.arrivingStayId) : undefined
                        return (
                          <article key={t.id} className={cn('rounded-lg border bg-surface p-3', t.priority === 'rush' && t.status !== 'done' ? 'border-danger/50' : 'border-line')}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[0.8125rem] text-foreground tabular-nums">Room {room?.number}</span>
                              <span className="text-xs text-subtle tabular-nums">by {t.dueBy}</span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted">
                              {HOUSEKEEPING_TASK_LABEL[t.kind]} · {typeById.get(room?.typeId ?? '')?.name.split(' ')[0]} · {t.minutes} min
                            </p>
                            {arriving ? <p className="mt-1.5 truncate text-xs text-foreground">{guestName(arriving.customer)} arrives{arriving.eta ? ` ${arriving.eta}` : ' today'}</p> : stay && t.kind === 'stayover' ? <p className="mt-1.5 truncate text-xs text-muted">{guestName(stay.customer)} · in house</p> : null}
                            {t.note ? <p className="mt-1.5 text-xs text-warning">{t.note}</p> : null}
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                                <Dot tone={t.priority === 'rush' && t.status !== 'done' ? 'bg-danger' : TASK_STATUS_META[t.status].tone} />
                                {t.priority === 'rush' && t.status !== 'done' ? 'Rush' : TASK_STATUS_META[t.status].label}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                {t.status === 'todo' ? (
                                  <Button size="xs" variant="secondary" leftIcon={<Play />} onClick={() => start(t)}>
                                    Start
                                  </Button>
                                ) : null}
                                {t.status === 'in_progress' ? (
                                  <Button size="xs" leftIcon={<Check />} onClick={() => finish(t)}>
                                    Done
                                  </Button>
                                ) : null}
                                {t.status === 'todo' ? (
                                  <Button size="xs" variant="ghost" leftIcon={<Check />} onClick={() => finish(t)} aria-label="Mark done" />
                                ) : null}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <IconButton size="xs" variant="ghost" aria-label={`More for room ${room?.number}`}>
                                      <MoreHorizontal />
                                    </IconButton>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                                    {attendants.map((a) => (
                                      <DropdownMenuItem key={a.id} onSelect={() => assign(t, a.id)}>
                                        {a.name}
                                        {t.assigneeId === a.id ? <Check className="ml-auto" /> : null}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuItem onSelect={() => assign(t, null)}>Nobody yet</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {t.status !== 'done' ? (
                                      <DropdownMenuItem onSelect={() => skip(t)}>
                                        <SkipForward />
                                        Skip today (do not disturb)
                                      </DropdownMenuItem>
                                    ) : null}
                                    <DropdownMenuItem asChild>
                                      <Link href="/dashboard/rooms">Open room</Link>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </span>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
        {(Object.keys(HOUSEKEEPING_META) as HousekeepingStatus[]).map((k) => (
          <li key={k}>
            <StatusWord label={`${HOUSEKEEPING_META[k].label} · ${rooms.filter((r) => r.housekeeping === k).length}`} tone={HOUSEKEEPING_META[k].tone} className="text-xs" />
          </li>
        ))}
      </ul>
    </div>
  )
}
