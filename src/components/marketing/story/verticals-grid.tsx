'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { VERTICAL_PITCHES } from '@/content/marketing'
import { cn } from '@/lib/utils'
import type { VerticalKey } from '@/types'
import { PHOTOS, photoUrl, type Photo } from './photos'

/* ==========================================================================
   VerticalsGrid — who this is for, as photographs rather than generic icons.

   An asymmetric grid showcasing the core verticals EZRA Pro powers.
   ========================================================================== */

interface Tile {
  key: VerticalKey
  label: string
  detail: string
  photo: Photo
  span: string
  aspect: string
}

const TILES: Tile[] = [
  {
    key: 'adventure',
    label: 'Alpine & Outdoor Adventure',
    detail: 'Weight and age safety gating, gear allocations, automated condition holds',
    photo: PHOTOS.ziplineCanopy,
    span: 'col-span-1',
    aspect: 'aspect-[4/3]',
  },
  {
    key: 'tours',
    label: 'Sightseeing & Guided Tours',
    detail: 'Guide rostering, pickup lists by hotel, private and group tier pricing',
    photo: PHOTOS.fujiPagoda,
    span: 'col-span-1',
    aspect: 'aspect-[4/3]',
  },
  {
    key: 'island',
    label: 'Resorts & Landmark Attractions',
    detail: 'One centralized desk selling dozens of activities, automated commission tracking',
    photo: PHOTOS.aerialAttraction,
    span: 'col-span-1',
    aspect: 'aspect-[4/3]',
  },
  {
    key: 'watersports',
    label: 'Outdoor & Marine Recreation',
    detail: 'Per-vessel capacity, certifications at checkout, condition alerts in one tap',
    photo: PHOTOS.rockClimbing,
    span: 'col-span-1',
    aspect: 'aspect-[4/3]',
  },
  {
    key: 'restaurants',
    label: 'Culinary & Dining Experiences',
    detail: 'Timed seatings, deposits that eliminate no-shows, dietary notes on the pass',
    photo: PHOTOS.plated,
    span: 'col-span-1',
    aspect: 'aspect-[4/3]',
  },
  {
    key: 'wellness',
    label: 'Wellness & Retreats',
    detail: 'Class passes, memberships, multi-day retreat packages with instalment plans',
    photo: PHOTOS.waterTemple,
    span: 'col-span-1',
    aspect: 'aspect-[4/3]',
  },
]

export function VerticalsGrid({ className }: { className?: string }) {
  return (
    <section className={cn('bg-background py-24 sm:py-32', className)} aria-labelledby="verticals-title">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-[0.75rem] font-semibold tracking-[0.14em] text-primary uppercase">
              Tailored for Every Operator
            </p>
            <h2
              id="verticals-title"
              className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-foreground text-balance"
            >
              Every category of experience. One unified booking platform.
            </h2>
          </div>
          <p className="max-w-sm text-[0.9375rem] leading-relaxed text-muted">
            From alpine ziplines and historic walking tours to tasting menus and wellness retreats.
            Built with each vertical&rsquo;s operational constraints out of the box.
          </p>
        </div>

        <StaggerGroup as="ul" stagger={0.08} className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((tile) => {
            const pitch = VERTICAL_PITCHES[tile.key]
            return (
              <StaggerItem as="li" key={tile.key} distance={18} className={cn('min-w-0', tile.span)}>
                <Link
                  href={`/solutions/${tile.key}`}
                  className={cn(
                    'group relative block h-full overflow-hidden rounded-3xl bg-ink-950 text-white shadow-md hover:shadow-xl transition-shadow',
                    'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
                    tile.aspect,
                  )}
                >
                  <Image
                    src={photoUrl(tile.photo, 1400)}
                    alt={tile.photo.alt}
                    fill
                    sizes="(min-width: 768px) 60vw, 100vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.05] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    style={{ objectPosition: tile.photo.focus }}
                  />
                  {/* Subtle dark scrim that darkens gently on hover for readability */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/40 to-transparent transition-opacity duration-300 group-hover:opacity-95"
                  />

                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 sm:p-6">
                    <span className="min-w-0">
                      <span className="block font-display text-lg font-semibold tracking-[-0.015em] sm:text-xl text-white">
                        {tile.label}
                      </span>
                      <span className="mt-1 block max-w-md text-[0.8125rem] leading-snug text-white/85">
                        {tile.detail}
                      </span>
                      <span className="mt-2 block text-[0.6875rem] font-semibold text-primary tabular-nums">
                        {pitch.proofStat} {pitch.proofLabel}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink-950 shadow-md',
                        'transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:bg-primary group-hover:text-white',
                        'motion-reduce:transition-none',
                      )}
                    >
                      <ArrowUpRight aria-hidden="true" className="size-4" strokeWidth={2.25} />
                    </span>
                  </span>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}
