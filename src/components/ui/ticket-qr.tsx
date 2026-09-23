'use client'

import * as React from 'react'
import qrcode from 'qrcode-generator'

import { cn } from '@/lib/utils'

/* ==========================================================================
   <TicketQr> — a QR code drawn as one SVG path, crisp at any size and in
   either theme (it paints with currentColor on a white quiet zone so every
   scanner reads it). The ticket format is "EZRA:<reference>".
   ========================================================================== */

export const ticketPayload = (reference: string) => `EZRA:${reference}`

/** The reference inside a scanned or typed code: "EZRA:EZR-8KQ2M", "ezr-8kq2m" or a URL ending in it. */
export function parseTicket(raw: string): string {
  const value = raw.trim().toUpperCase()
  const match = value.match(/EZR-[A-Z0-9]{4,8}/)
  return match ? match[0] : value.replace(/^EZRA:/, '')
}

export function TicketQr({ value, size = 160, className, label }: { value: string; size?: number; className?: string; label?: string }) {
  const { path, count } = React.useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`
      }
    }
    return { path: d, count: n }
  }, [value])

  const quiet = 3
  return (
    <svg
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`}
      shapeRendering="crispEdges"
      className={cn('rounded-lg bg-white text-[#0b0b12]', className)}
    >
      <rect x={-quiet} y={-quiet} width={count + quiet * 2} height={count + quiet * 2} fill="#ffffff" />
      <path d={path} fill="currentColor" />
    </svg>
  )
}
