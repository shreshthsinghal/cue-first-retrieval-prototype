// Phase 1b: Picsum fillers. Picsum serves Unsplash-licensed photographs and
// its list API exposes the original author for attribution. Download a set,
// classify later with CLIP, keep only images that fit persona buckets.

import { mkdirSync, existsSync, statSync, writeFileSync, readFileSync } from 'fs'

const RAW_DIR = './library-raw/picsum'
const META_PATH = './library-raw/picsum-meta.json'
mkdirSync(RAW_DIR, { recursive: true })

interface Pic { id: string; author: string; width: number; height: number; unsplash: string }

// Fetch the catalog (ids 0..1000+).
const cats: Pic[] = []
for (let p = 1; p <= 9; p++) {
  const res = await fetch(`https://picsum.photos/v2/list?page=${p}&limit=100`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) break
  const arr = (await res.json()) as Array<{ id: string; author: string; width: number; height: number; url: string }>
  cats.push(...arr.map((a) => ({ id: a.id, author: a.author, width: a.width, height: a.height, unsplash: a.url })))
  if (arr.length < 100) break
}
console.log('catalog size:', cats.length)

const prev: Array<{ id: string; ok: boolean; bytes: number; author: string; unsplash: string }> =
  existsSync(META_PATH) ? JSON.parse(readFileSync(META_PATH, 'utf8')) : []
const prevOk = new Set(prev.filter((r) => r.ok).map((r) => r.id))

// Take the first 210 that we do not already have.
const targets = cats.slice(0, 260).filter((c) => !prevOk.has(c.id)).slice(0, 210)

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]) }
  }))
  return out
}

const results = await pool(targets, 8, async (c) => {
  const file = `${RAW_DIR}/${c.id}.jpg`
  try {
    if (!(existsSync(file) && statSync(file).size > 10000)) {
      const res = await fetch(`https://picsum.photos/id/${c.id}/800/640.jpg`, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) return { id: c.id, ok: false, bytes: 0, author: c.author, unsplash: c.unsplash }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 10000 || buf[0] !== 0xff) return { id: c.id, ok: false, bytes: 0, author: c.author, unsplash: c.unsplash }
      writeFileSync(file, buf)
    }
    return { id: c.id, ok: true, bytes: statSync(file).size, author: c.author, unsplash: c.unsplash }
  } catch {
    return { id: c.id, ok: false, bytes: 0, author: c.author, unsplash: c.unsplash }
  }
})

const all = [...prev.filter((r) => r.ok), ...results]
writeFileSync(META_PATH, JSON.stringify(all, null, 2))
console.log(`picsum ok total: ${all.filter((r) => r.ok).length} (this run: ${results.filter((r) => r.ok).length}/${targets.length})`)
