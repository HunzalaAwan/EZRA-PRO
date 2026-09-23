'use client'

import * as React from 'react'
import { Camera, CameraOff, CheckCircle2, ScanLine, ShieldAlert, ShieldCheck, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { parseTicket } from '@/components/ui/ticket-qr'
import type { TicketRow } from '@/lib/operations'
import { cn, formatCurrency, formatTime, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   CHECK-IN
   Scan a ticket's QR code with the camera (where the browser can read QR),
   or type the confirmation code. The party comes up with its waivers,
   balance and notes; check it in or mark it a no-show.
   ========================================================================== */

type Outcome = 'in' | 'no_show'

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

export function CheckInScanner({ tickets, currency, todayKey }: { tickets: TicketRow[]; currency: CurrencyCode; todayKey: string }) {
  const [code, setCode] = React.useState('')
  const [current, setCurrent] = React.useState<TicketRow | null>(null)
  const [missing, setMissing] = React.useState<string | null>(null)
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({})
  const [recent, setRecent] = React.useState<string[]>([])
  const [cameraOn, setCameraOn] = React.useState(false)
  const [cameraSupported, setCameraSupported] = React.useState(false)
  const [override, setOverride] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)

  React.useEffect(() => {
    setCameraSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window && Boolean(navigator.mediaDevices?.getUserMedia))
  }, [])

  const lookup = React.useCallback(
    (raw: string) => {
      const reference = parseTicket(raw)
      const found = tickets.find((ticket) => ticket.reference === reference)
      setOverride(false)
      if (found) {
        setCurrent(found)
        setMissing(null)
      } else {
        setCurrent(null)
        setMissing(reference)
      }
    },
    [tickets],
  )

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  React.useEffect(() => stopCamera, [stopCamera])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setCameraOn(true)
      const Detector = (window as unknown as { BarcodeDetector: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
      const detector = new Detector({ formats: ['qr_code'] })
      requestAnimationFrame(async function loop() {
        const video = videoRef.current
        if (!streamRef.current || !video) return
        if (video.srcObject !== stream) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        try {
          const codes = await detector.detect(video)
          if (codes[0]?.rawValue) {
            lookup(codes[0].rawValue)
            stopCamera()
            return
          }
        } catch {
          /* frame not ready */
        }
        requestAnimationFrame(loop)
      })
    } catch {
      toast.error('The camera is not available', { description: 'Type the confirmation code instead.' })
      stopCamera()
    }
  }

  const record = (ticket: TicketRow, outcome: Outcome) => {
    setOutcomes((all) => ({ ...all, [ticket.id]: outcome }))
    setRecent((list) => [ticket.id, ...list.filter((id) => id !== ticket.id)].slice(0, 8))
    toast.success(outcome === 'in' ? `${ticket.guestName} checked in` : `${ticket.guestName} marked no-show`, {
      description: outcome === 'in' ? `${ticket.party} ${pluralize(ticket.party, 'guest')} · ${ticket.activityName} ${formatTime(ticket.startsAt)}` : 'The no-show fee rule applies.',
    })
    setCode('')
    setCurrent(null)
  }

  const todayTickets = tickets.filter((ticket) => ticket.startsAt.slice(0, 10) === todayKey)
  const checkedIn = todayTickets.filter((ticket) => outcomes[ticket.id] === 'in').reduce((sum, ticket) => sum + ticket.party, 0)
  const expected = todayTickets.reduce((sum, ticket) => sum + ticket.party, 0)
  const waiversOk = current ? current.waiversSigned >= current.waiversTotal : true
  const isToday = current ? current.startsAt.slice(0, 10) === todayKey : true

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (code.trim()) lookup(code)
          }}
        >
          <p className="text-sm font-semibold text-foreground">Scan or type a ticket</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="EZR-8KQ2M"
              aria-label="Confirmation code"
              className="font-mono uppercase"
              leftIcon={<ScanLine />}
              autoFocus
            />
            <Button type="submit" disabled={!code.trim()}>Find ticket</Button>
            {cameraSupported ? (
              <Button type="button" variant="secondary" leftIcon={cameraOn ? <CameraOff /> : <Camera />} onClick={cameraOn ? stopCamera : startCamera}>
                {cameraOn ? 'Stop camera' : 'Scan QR'}
              </Button>
            ) : null}
          </div>
          {!cameraSupported ? (
            <p className="text-xs text-subtle">This browser cannot read QR codes from the camera. A handheld scanner types the code into the box, or type it yourself.</p>
          ) : null}
          {cameraOn ? <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" /> : null}
        </form>

        {missing ? (
          <div role="alert" className="rounded-2xl border border-danger/40 bg-danger-soft/40 px-5 py-4 text-sm">
            <p className="font-semibold text-danger">No ticket {missing} for today or tomorrow.</p>
            <p className="mt-1 text-muted">Check the code, or find the guest on the manifest.</p>
          </div>
        ) : null}

        {current ? (
          <article className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs tracking-wide text-subtle">{current.reference}</p>
                <h2 className="text-xl font-semibold text-foreground">{current.guestName}</h2>
                <p className="text-sm text-muted">
                  {current.party} {pluralize(current.party, 'guest')} · {current.activityName} · {formatTime(current.startsAt)}
                  {!isToday ? ' tomorrow' : ''}
                </p>
              </div>
              {outcomes[current.id] ? (
                <Badge variant={outcomes[current.id] === 'in' ? 'success' : 'danger'}>{outcomes[current.id] === 'in' ? 'Already checked in' : 'No-show'}</Badge>
              ) : null}
            </div>

            <ul className="mt-4 flex list-none flex-col gap-2 p-0 text-sm">
              <li className={cn('flex items-center gap-2 rounded-lg px-3 py-2', waiversOk ? 'bg-success-soft/50 text-success' : 'bg-warning-soft text-warning')}>
                {waiversOk ? <ShieldCheck className="size-4" aria-hidden="true" /> : <ShieldAlert className="size-4" aria-hidden="true" />}
                {waiversOk ? 'All waivers signed' : `${current.waiversTotal - current.waiversSigned} of ${current.waiversTotal} waivers to sign`}
              </li>
              {current.balance > 0 ? (
                <li className="rounded-lg bg-danger-soft px-3 py-2 font-medium text-danger">{formatCurrency(current.balance, currency)} still to collect</li>
              ) : null}
              {current.pickup ? <li className="rounded-lg bg-info-soft px-3 py-2 text-info">Picked up from {current.pickup}</li> : null}
              {current.notes.map((note) => (
                <li key={note} className="rounded-lg bg-surface-sunken px-3 py-2 text-muted">{note}</li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              {waiversOk || override ? (
                <Button leftIcon={<CheckCircle2 />} onClick={() => record(current, 'in')}>
                  Check in {current.party} {pluralize(current.party, 'guest')}
                </Button>
              ) : (
                <Button variant="secondary" leftIcon={<ShieldAlert />} onClick={() => setOverride(true)}>
                  Waiver signed on paper, allow check-in
                </Button>
              )}
              <Button variant="ghost" leftIcon={<UserX />} onClick={() => record(current, 'no_show')}>
                No-show
              </Button>
            </div>
          </article>
        ) : null}
      </div>

      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-xs font-medium text-muted">Checked in today</p>
          <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
            {checkedIn}
            <span className="text-lg text-subtle"> / {expected}</span>
          </p>
          <p className="text-xs text-subtle">{todayTickets.length} {pluralize(todayTickets.length, 'booking')} on today&rsquo;s tickets</p>
        </div>
        {recent.length > 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold">Just scanned</p>
            <ul className="mt-2 flex list-none flex-col gap-1.5 p-0 text-sm">
              {recent.map((id) => {
                const ticket = tickets.find((entry) => entry.id === id)
                if (!ticket) return null
                return (
                  <li key={id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{ticket.guestName}</span>
                    <Badge variant={outcomes[id] === 'in' ? 'success' : 'danger'} size="sm">{outcomes[id] === 'in' ? 'In' : 'No-show'}</Badge>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <div className="rounded-2xl border border-dashed border-line p-5 text-xs text-subtle">
          <p>Try a ticket from today</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {todayTickets.slice(0, 4).map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => { setCode(ticket.reference); lookup(ticket.reference) }} className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-foreground hover:border-primary/50">
                {ticket.reference}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
