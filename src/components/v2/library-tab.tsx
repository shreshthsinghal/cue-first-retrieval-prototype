'use client'

// Library tab: the full demo library for browsing, with honest badges.
// Held-out photos appear here (they are part of the persona's library) but
// are excluded from search results; the badge says so.

import { useEffect, useState } from 'react'

interface ManifestItem {
  id: string; file: string; ts: string; source: string; deleted: boolean
  deletedNote?: string; license: string; attribution: string; generated: boolean
  width: number; height: number
}
interface Payload {
  entries: Array<{ id: string; hints: string[]; screenshotProb: number; cluster: string }>
  persona: { name: string; homeCity: string; birthday: { month: number; day: number }; referenceNow: string; importantDates: Array<{ key: string; label: string; date: string }> }
  manifest: { items: ManifestItem[]; notes: string[] }
  heldoutCount: number
  indexHash: string
}

export function LibraryTabV2() {
  const [data, setData] = useState<Payload | null>(null)
  const [filter, setFilter] = useState<'all' | 'searchable' | 'heldout'>('all')

  useEffect(() => {
    fetch('/api/index').then((r) => r.json()).then(setData).catch(() => setData(null))
  }, [])

  if (!data) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Loading the library...</div>

  const searchable = new Set(data.entries.map((e) => e.id))
  const items = data.manifest.items.filter((i) => filter === 'all' || (filter === 'searchable' ? searchable.has(i.id) : !searchable.has(i.id)))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold">The demo library</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        One fictional persona ({data.persona.name}, {data.persona.homeCity}), {data.manifest.items.length} items from {new Date(data.manifest.items[0].ts.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })} to {new Date(data.manifest.items[data.manifest.items.length - 1].ts.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.
        {' '}{searchable.size} are searchable; {data.heldoutCount} are held out of the search index on purpose for honest calibration. Demo library: a fictional person&apos;s photos (AI-generated or stock). These are not your photos.
      </p>
      <div className="mt-3 flex gap-2">
        {(['all', 'searchable', 'heldout'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'}`}
          >
            {f === 'all' ? 'All items' : f === 'searchable' ? 'Searchable' : 'Held out of search'}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => {
          const isHeldOut = !searchable.has(item.id)
          const hints = data.entries.find((e) => e.id === item.id)?.hints ?? []
          return (
            <figure key={item.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="relative aspect-square bg-stone-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/photos-v2/${item.file}`}
                  alt={hints.join(', ') || item.id}
                  loading="lazy"
                  className={`h-full w-full object-cover ${item.deleted ? 'opacity-60 grayscale' : ''}`}
                />
                <span className="absolute left-1 top-1 flex flex-col gap-1">
                  {item.deleted && <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">deleted</span>}
                  {item.source === 'screenshot' && <span className="rounded bg-sky-600/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">screenshot</span>}
                  {item.generated && <span className="rounded bg-purple-600/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">AI-generated</span>}
                  {isHeldOut && <span className="rounded bg-amber-600/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">held out</span>}
                </span>
              </div>
              <figcaption className="p-1.5 text-[10px] leading-tight text-muted-foreground">
                {new Date(item.ts.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}{item.license.startsWith('Unsplash') ? 'Unsplash License' : item.license.split(':')[0]}
              </figcaption>
            </figure>
          )
        })}
      </div>

      <div className="mt-6 space-y-1 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        {data.manifest.notes.map((n, i) => <p key={i}>{n}</p>)}
      </div>
    </div>
  )
}
