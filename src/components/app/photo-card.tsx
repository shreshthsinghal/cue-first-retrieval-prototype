'use client'

// Photo rendering shared by the Retrieve results and the Library grid.
// Ghosts (deleted) render grayscale with a deleted ribbon; screenshots get
// an origin badge. Evidence chips show why a photo matched (Move 4).

import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import type { Photo, ScoredPhoto } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

const monthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export function PhotoThumb({
  photo,
  className,
  sizes = '(max-width: 640px) 50vw, 240px',
  priority = false,
}: {
  photo: Photo
  className?: string
  sizes?: string
  priority?: boolean
}) {
  const ghost = Boolean(photo.deleted)
  return (
    <div className={cn('group relative overflow-hidden rounded-xl bg-muted', className)}>
      <Image
        src={photo.src}
        alt={`${photo.album}, ${monthLabel(photo.date)}${ghost ? ' (deleted)' : ''}`}
        width={photo.width}
        height={photo.height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        className={cn(
          'h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
          ghost && 'opacity-60 grayscale',
        )}
      />
      {ghost && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-foreground/80 px-2.5 py-1.5 text-[11px] font-medium text-background">
          <span className="inline-flex items-center gap-1">
            <ImageOff className="h-3 w-3" aria-hidden />
            Deleted
          </span>
          <span>{photo.deleted ? new Date(photo.deleted.on + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}</span>
        </div>
      )}
      {photo.origin === 'screenshot' && !ghost && (
        <div className="absolute left-2 top-2 rounded-md bg-foreground/75 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
          screenshot
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/75 via-foreground/25 to-transparent px-2.5 pb-1.5 pt-6 text-[11px] font-medium text-background">
        <span className="block truncate font-mono opacity-90">{photo.id}</span>
        <span className="block opacity-75">{monthLabel(photo.date)}</span>
      </div>
    </div>
  )
}

export function EvidenceChips({ items, limit = 3 }: { items: ScoredPhoto['evidence']; limit?: number }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.slice(0, limit).map((e, i) => (
        <li
          key={`${e.hypothesisId}-${i}`}
          className="rounded-full border border-primary/25 bg-primary/[0.08] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground/85"
        >
          {e.text}
        </li>
      ))}
    </ul>
  )
}

export function ScorePercent({ score }: { score: number }) {
  // Confidence display: normalized against the practical max score (~8).
  const pct = Math.max(6, Math.min(98, Math.round((score / 8) * 100)))
  return (
    <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
  )
}
