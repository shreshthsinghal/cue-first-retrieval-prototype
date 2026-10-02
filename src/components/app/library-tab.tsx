'use client'

// The synthetic evaluation library, browsable. Shows exactly what the engine
// searches: event-clustered albums, a screenshots origin, and deleted ghosts
// kept as existence records (the G1 hard boundary).

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DELETED_PHOTOS, PHOTOS } from '@/lib/engine/library'
import { PhotoThumb } from './photo-card'
import { cn } from '@/lib/utils'

const ALBUM_ORDER = Array.from(new Set(PHOTOS.map((p) => p.album)))

export function LibraryTab() {
  const [album, setAlbum] = useState<string>('all')
  const [showDeleted, setShowDeleted] = useState(true)

  const photos = useMemo(
    () =>
      PHOTOS.filter((p) => (album === 'all' || p.album === album)).sort((a, b) => b.date.localeCompare(a.date)),
    [album],
  )
  const visible = photos.filter((p) => showDeleted || !p.deleted)
  const screenshots = PHOTOS.filter((p) => p.origin === 'screenshot').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">The evaluation library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            A synthetic camera roll of one persona, structured the way the research says real libraries behave:
            life-event clusters, chat-origin screenshots, and two deleted photos kept as existence records.
            Every benchmark case resolves against this manifest.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary" className="rounded-full px-3 py-1">{PHOTOS.length} items</Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">{screenshots} screenshots</Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">{DELETED_PHOTOS.length} deleted</Badge>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <FilterChip active={album === 'all'} onClick={() => setAlbum('all')}>All albums</FilterChip>
        {ALBUM_ORDER.map((a) => (
          <FilterChip key={a} active={album === a} onClick={() => setAlbum(a)}>{a}</FilterChip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
        <FilterChip active={showDeleted} onClick={() => setShowDeleted((v) => !v)}>
          {showDeleted ? 'Deleted: shown' : 'Deleted: hidden'}
        </FilterChip>
      </div>

      <div className="mt-6 columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
        {visible.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03 }}
          >
            <PhotoThumb photo={p} className="w-full" sizes="(max-width: 640px) 50vw, 300px" />
            <p className="mt-1.5 px-0.5 text-xs text-muted-foreground">{p.album}</p>
          </motion.div>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="mt-10 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing here with the current filters.
        </p>
      )}

      <p className="mt-8 flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        All photographs are AI-generated for evaluation; no real person&apos;s library is simulated. Deleted
        ghosts are retained in the manifest as existence records only, mirroring the research rule that
        deleted-photo cases stay adjacent and are never sold as a search problem.
      </p>
    </div>
  )
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
