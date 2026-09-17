'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Parallax } from '@/components/motion/parallax'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/* ==========================================================================
   ClosingCta — a row of the trades, drifting at different speeds, and the ask.
   ========================================================================== */

const COLLAGE: { photo: Photo; rotate: string; speed: number; offset: string }[] = [
  { photo: PHOTOS.supperClub, rotate: '-rotate-3', speed: 0.5, offset: 'mt-10' },
  { photo: PHOTOS.kitchenClass, rotate: 'rotate-2', speed: 0.9, offset: 'mt-0' },
  { photo: PHOTOS.wineToast, rotate: '-rotate-1', speed: 0.7, offset: 'mt-14' },
  { photo: PHOTOS.sunsetYoga, rotate: 'rotate-3', speed: 1.1, offset: 'mt-4' },
  { photo: PHOTOS.confettiCrowd, rotate: '-rotate-2', speed: 0.6, offset: 'mt-12' },
]

const PROMISES = ['Free migration, done by us', 'No card to start', 'Cancel any month']

export function ClosingCta({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="closing-title"
      className={cn('relative overflow-hidden border-t border-line bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))] py-20 sm:py-24', className)}
    >
      <StaggerGroup
        as="ul"
        stagger={0.07}
        margin="-10%"
        aria-hidden="true"
        className="mx-auto flex max-w-7xl justify-center gap-3 px-4 sm:gap-5 sm:px-6 lg:px-8"
      >
        {COLLAGE.map((item, i) => (
          <StaggerItem
            as="li"
            key={item.photo.id}
            direction="up"
            distance={28}
            className={cn('w-[30vw] max-w-[15rem] shrink-0 sm:w-[19vw]', i > 2 && 'hidden sm:block', item.offset)}
          >
            <Parallax speed={item.speed} distance={40}>
              <figure
                className={cn(
                  'relative m-0 aspect-[4/5] overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-black/10',
                  item.rotate,
                )}
              >
                <Image
                  src={photoUrl(item.photo, 960, 82)}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 19vw, 30vw"
                  className="object-cover"
                  style={{ objectPosition: item.photo.focus }}
                />
              </figure>
            </Parallax>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <Reveal className="mx-auto mt-12 max-w-2xl px-4 text-center sm:mt-16 sm:px-6">
        <h2
          id="closing-title"
          className="font-display text-display-sm font-semibold tracking-[-0.035em] text-balance text-foreground md:text-display-md"
        >
          Your next season, on one calendar.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          Bring your products, tables or dates across this week. Most businesses are taking
          bookings by the weekend.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="xl" className="rounded-full px-8" rightIcon={<ArrowRight aria-hidden="true" />}>
            <Link href="/signup">Start free</Link>
          </Button>
          <Button asChild size="xl" variant="outline" className="rounded-full bg-surface px-8">
            <Link href="/contact">Talk to a person</Link>
          </Button>
        </div>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.8125rem] text-subtle">
          {PROMISES.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <Check aria-hidden="true" className="size-3.5 text-success" strokeWidth={2.5} />
              {p}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}
