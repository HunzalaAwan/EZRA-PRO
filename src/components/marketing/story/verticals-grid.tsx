'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, Compass, Sparkles } from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { VERTICAL_PITCHES } from '@/content/marketing'
import { cn } from '@/lib/utils'
import type { VerticalKey } from '@/types'
import { PHOTOS, photoUrl, type Photo } from './photos'

/* ==========================================================================
   VerticalsGrid — who this is for, as photographs rather than generic icons.
   ========================================================================== */

interface Tile {
  key: VerticalKey
  tag: string
  label: string
  detail: string
  photo: Photo
}

const TILES: Tile[] = [
  {
    key: 'adventure',
    tag: 'Outdoor Adventure',
    label: 'Alpine & Canopy Adventures',
    detail: 'Weight & age gating, gear allocations, real-time weather threshold holds',
    photo: PHOTOS.ziplineCanopy,
  },
  {
    key: 'tours',
    tag: 'Guided Experiences',
    label: 'Sightseeing & Cultural Tours',
    detail: 'Guide rostering, hotel pickup lists, multi-language & private group tiers',
    photo: PHOTOS.fujiPagoda,
  },
  {
    key: 'island',
    tag: 'Attractions & Parks',
    label: 'Resorts & Landmark Attractions',
    detail: 'Central desk selling 20+ operators, automated partner commissions',
    photo: PHOTOS.aerialAttraction,
  },
  {
    key: 'watersports',
    tag: 'Active Recreation',
    label: 'Outdoor & Marine Expeditions',
    detail: 'Per-vessel capacity limits, digital waivers, instant condition holds',
    photo: PHOTOS.rockClimbing,
  },
  {
    key: 'restaurants',
    tag: 'Culinary Hospitality',
    label: 'Fine Dining & Food Walks',
    detail: 'Timed seatings, deposit protection against no-shows, allergen tagging',
    photo: PHOTOS.plated,
  },
  {
    key: 'wellness',
    tag: 'Retreats & Studios',
    label: 'Wellness & Mindfulness Retreats',
    detail: 'Multi-day packages, recurring class packs, structured instalment plans',
    photo: PHOTOS.waterTemple,
  },
]

export function VerticalsGrid({ className }: { className?: string }) {
  return (
    <section className={cn('bg-background py-24 sm:py-32', className)} aria-labelledby="verticals-title">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.14em] text-primary uppercase">
              <Compass className="size-4" />
              Tailored for Every Operator Vertical
            </div>
            <h2
              id="verticals-title"
              className="mt-3 font-display text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1.04] font-semibold tracking-[-0.03em] text-foreground text-balance"
            >
              Every category of experience. One unified booking platform.
            </h2>
          </div>
          <p className="max-w-md text-base leading-relaxed text-muted">
            From alpine ziplines and historic walking tours to tasting menus and wellness retreats.
            Engineered with each vertical’s specific operational rules out of the box.
          </p>
        </div>

        <StaggerGroup as="ul" stagger={0.08} className="mt-14 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((tile) => {
            const pitch = VERTICAL_PITCHES[tile.key]
            return (
              <StaggerItem as="li" key={tile.key} distance={18} className="min-w-0">
                <Link
                  href={`/solutions/${tile.key}`}
                  className={cn(
                    'group relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-ink-950 text-white shadow-xl transition-all duration-300',
                    'min-h-[380px] sm:min-h-[420px] p-6 sm:p-7 border border-line/40 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1.5',
                    'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
                  )}
                >
                  <Image
                    src={photoUrl(tile.photo, 1400)}
                    alt={tile.photo.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-108 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    style={{ objectPosition: tile.photo.focus }}
                  />

                  {/* Multi-stop cinematic gradient for guaranteed text readability */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/60 to-ink-950/25 transition-opacity duration-300 group-hover:from-ink-950 group-hover:via-ink-950/70"
                  />

                  {/* Top pill badge */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-ink-950/60 px-3 py-1 font-mono text-[0.6875rem] font-semibold text-white/90 backdrop-blur-md shadow-sm">
                      <span className="size-1.5 rounded-full bg-primary" />
                      {tile.tag}
                    </span>
                  </div>

                  {/* Bottom details */}
                  <div className="relative z-10 mt-auto flex items-end justify-between gap-4 pt-8">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl text-white group-hover:text-primary transition-colors">
                        {tile.label}
                      </h3>
                      <p className="mt-2 block max-w-sm text-[0.875rem] leading-relaxed text-white/80">
                        {tile.detail}
                      </p>
                      <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
                        <CheckCircle2 className="size-3.5" />
                        <span>{pitch.proofStat}</span>
                        <span className="text-white/70 font-normal">{pitch.proofLabel}</span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink-950 shadow-xl',
                        'transition-all duration-300 ease-[var(--ease-out-expo)] group-hover:bg-primary group-hover:text-white group-hover:scale-110 group-hover:-translate-y-1',
                        'motion-reduce:transition-none',
                      )}
                    >
                      <ArrowUpRight aria-hidden="true" className="size-5" strokeWidth={2.2} />
                    </span>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}
