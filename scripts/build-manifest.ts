// Phase 1e: build the v2 library manifest + files.
// Sources: Unsplash CDN downloads (Unsplash License), Picsum (Unsplash License
// with author attribution), AI-generated images from v1 (labeled), burst crops
// derived from parent photos, and rendered chat screenshots.
// Output: public/photos-v2/*.{jpg,png}, data/library-manifest.json, data/persona.json

import { mkdirSync, existsSync, readFileSync, writeFileSync, copyFileSync, statSync, rmSync } from 'fs'
import sharp from 'sharp'
import path from 'path'

// ── Persona profile: structured dates, like a phone's important dates ───────
const PERSONA = {
  name: 'Meera',
  homeCity: 'Bengaluru',
  birthday: { month: 6, day: 14 }, // June 14
  referenceNow: '2026-10-01',
  importantDates: [
    { key: 'graduation', label: 'my graduation', date: '2023-05-16' },
    { key: 'diwali', label: 'Diwali at home', date: '2023-11-12' },
    { key: 'goa-trip', label: 'Goa trip', date: '2024-02-14' },
    { key: 'birthday-2024', label: 'my birthday 2024', date: '2024-05-10' },
    { key: 'anjali-wedding', label: "Anjali's wedding", date: '2024-12-14' },
    { key: 'monsoon-2024', label: 'monsoon 2024', date: '2024-07-20' },
    { key: 'mumbai-trip', label: 'Mumbai weekend', date: '2025-08-23' },
    { key: 'birthday-lake-2025', label: 'my birthday at the lake 2025', date: '2025-06-14' },
    { key: 'monsoon-2025', label: 'monsoon 2025', date: '2025-07-15' },
    { key: 'kedarkantha-trek', label: 'the Kedarkantha trek', date: '2025-10-18' },
    { key: 'gokarna-trip', label: 'Gokarna weekend', date: '2026-02-14' },
  ],
}

interface Item {
  id: string
  file: string
  ts: string
  source: 'camera' | 'screenshot'
  deleted: boolean
  deletedNote?: string
  license: string
  attribution: string
  generated: boolean
  derivedFrom?: string
  width: number
  height: number
  bytes: number
}

const OUT_DIR = './public/photos-v2'
const DATA_DIR = './data'
rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(DATA_DIR, { recursive: true })

const items: Item[] = []
let counter: Record<string, number> = {}

function stamp(base: string, y: number, mo: number, d: number, h: number, mi: number, seq = 0): string {
  const hh = String(h).padStart(2, '0')
  const mm = String(mi + seq).padStart(2, '0')
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${hh}:${mm}:00`
}

function nextId(prefix: string, y: number, mo: number, d: number, h: number, mi: number): string {
  counter[prefix] = (counter[prefix] ?? 0) + 1
  return `${prefix}_${y}${String(mo).padStart(2, '0')}${String(d).padStart(2, '0')}_${String(h).padStart(2, '0')}${String(mi).padStart(2, '0')}_${counter[prefix]}`
}

async function addReal(opts: {
  poolFile: string // absolute-ish path in library-raw
  prefix: string
  ts: string
  attribution: string
  license: string
  source?: 'camera' | 'screenshot'
  deleted?: boolean
  deletedNote?: string
  generated?: boolean
  derivedFrom?: string
}) {
  const src = opts.poolFile
  if (!existsSync(src)) throw new Error(`missing source file: ${src}`)
  const ext = path.extname(src).toLowerCase() === '.png' ? 'png' : 'jpg'
  const [date, time] = opts.ts.split('T')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const id = nextId(opts.prefix, y, mo, d, h, mi)
  const file = `${id}.${ext}`
  const dest = path.join(OUT_DIR, file)
  copyFileSync(src, dest)
  const meta = await sharp(dest).metadata()
  items.push({
    id, file, ts: opts.ts,
    source: opts.source ?? 'camera',
    deleted: opts.deleted ?? false,
    ...(opts.deletedNote ? { deletedNote: opts.deletedNote } : {}),
    license: opts.license, attribution: opts.attribution,
    generated: opts.generated ?? false,
    ...(opts.derivedFrom ? { derivedFrom: opts.derivedFrom } : {}),
    width: meta.width ?? 0, height: meta.height ?? 0, bytes: statSync(dest).size,
  })
  return id
}

async function addBurst(parentId: string, opts: { ts: string; mode: 'center' | 'left'; deleted?: boolean; deletedNote?: string }) {
  const parent = items.find((i) => i.id === parentId)
  if (!parent) throw new Error(`unknown parent ${parentId}`)
  const src = path.join(OUT_DIR, parent.file)
  const [date, time] = opts.ts.split('T')
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const id = nextId(parent.id.slice(0, 3).toUpperCase() + 'B', y, mo, d, h, mi)
  const file = `${id}.jpg`
  const dest = path.join(OUT_DIR, file)
  const img = sharp(src)
  const meta = await img.metadata()
  const w = meta.width ?? 800
  const hgt = meta.height ?? 600
  const cropW = Math.floor(w * (opts.mode === 'center' ? 0.88 : 0.8))
  const cropH = Math.floor(hgt * (opts.mode === 'center' ? 0.88 : 0.9))
  const left = opts.mode === 'center' ? Math.floor((w - cropW) / 2) : Math.floor((w - cropW) * 0.12)
  const top = Math.floor((hgt - cropH) / 2)
  await img.extract({ left, top, width: cropW, height: cropH }).jpeg({ quality: 80 }).toFile(dest)
  const meta2 = await sharp(dest).metadata()
  items.push({
    id, file, ts: opts.ts, source: 'camera', deleted: opts.deleted ?? false,
    ...(opts.deletedNote ? { deletedNote: opts.deletedNote } : {}),
    license: parent.license, attribution: `${parent.attribution} (burst crop)`,
    generated: parent.generated, derivedFrom: parent.id,
    width: meta2.width ?? 0, height: meta2.height ?? 0, bytes: statSync(dest).size,
  })
}

const U = (id: string) => `./library-raw/${id}.jpg`
const P = (id: string) => `./library-raw/picsum/${id}.jpg`
const V = (name: string) => `../app/public/photos/${name}` // v1 generated photos
const uAttr = (id: string) => `Unsplash contributor (photo-${id}, via images.unsplash.com)`
const U_LIC = 'Unsplash License'
const GEN_LIC = 'Synthetic: AI-generated for this prototype'
const SS_LIC = 'Synthetic: rendered for this prototype'

// ── 1. Graduation · May 2023 ─────────────────────────────────────────────────
{
  const [y, mo, d] = [2023, 5, 16]
  await addReal({ poolFile: U('1627556704290-2b1f5853ff78'), prefix: 'IMG', ts: stamp('g', y, mo, d, 10, 32), attribution: uAttr('1627556704290'), license: U_LIC })
  await addReal({ poolFile: U('1541339907198-e08756dedf3f'), prefix: 'IMG', ts: stamp('g', y, mo, d, 11, 58), attribution: uAttr('1541339907198'), license: U_LIC })
  await addReal({ poolFile: V('gr1.jpg'), prefix: 'IMG', ts: stamp('g', y, mo, d, 10, 45), attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('gr2.jpg'), prefix: 'IMG', ts: stamp('g', y, mo, d, 11, 32), attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('gr3.jpg'), prefix: 'IMG', ts: stamp('g', y, mo, d, 12, 19), attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
}

// ── 2. Everyday home · spread 2023-2026 ─────────────────────────────────────
{
  await addReal({ poolFile: U('1543466835-00a7907e9de1'), prefix: 'IMG', ts: '2023-09-02T17:20:00', attribution: uAttr('1543466835'), license: U_LIC })
  await addReal({ poolFile: U('1481627834876-b7833e8f5570'), prefix: 'IMG', ts: '2023-12-27T21:37:00', attribution: uAttr('1481627834876'), license: U_LIC })
  await addReal({ poolFile: U('1504674900247-0877df9cc836'), prefix: 'IMG', ts: '2024-01-20T13:15:00', attribution: uAttr('1504674900247'), license: U_LIC })
  await addReal({ poolFile: U('1552053831-71594a27632d'), prefix: 'IMG', ts: '2024-03-16T09:10:00', attribution: uAttr('1552053831'), license: U_LIC })
  await addReal({ poolFile: V('h2.jpg'), prefix: 'IMG', ts: '2024-02-10T08:44:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('h3.jpg'), prefix: 'IMG', ts: '2024-11-09T17:02:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1495474472287-4d71bcdd2085'), prefix: 'IMG', ts: '2024-05-03T16:08:00', attribution: uAttr('1495474472287'), license: U_LIC })
  await addReal({ poolFile: P('29'), prefix: 'IMG', ts: '2024-06-22T18:40:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
  await addReal({ poolFile: U('1524995997946-a1c2e315a42f'), prefix: 'IMG', ts: '2025-01-05T20:05:00', attribution: uAttr('1524995997946'), license: U_LIC })
  await addReal({ poolFile: V('m4.jpg'), prefix: 'IMG', ts: '2023-12-27T21:40:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('m3.jpg'), prefix: 'IMG', ts: '2024-09-15T06:58:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('s3.jpg'), prefix: 'IMG', ts: '2025-09-08T14:25:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: P('106'), prefix: 'IMG', ts: '2025-03-09T07:30:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
  await addReal({ poolFile: P('58'), prefix: 'IMG', ts: '2025-11-23T16:50:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
}

// ── 3. Diwali at home · Nov 2023 ─────────────────────────────────────────────
{
  await addReal({ poolFile: V('h1.jpg'), prefix: 'IMG', ts: '2023-11-12T20:55:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('g2.jpg'), prefix: 'IMG', ts: '2024-08-15T18:30:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true, deleted: true, deletedNote: 'Deleted on 6 Jan 2025 during a gallery cleanup; the WhatsApp copy is the only one left.' })
  await addReal({ poolFile: U('1515169067868-5387ec356754'), prefix: 'IMG', ts: '2023-11-12T21:40:00', attribution: uAttr('1515169067868'), license: U_LIC })
  await addReal({ poolFile: U('1467810563316-b5476525c0f9'), prefix: 'IMG', ts: '2023-11-12T22:05:00', attribution: uAttr('1467810563316'), license: U_LIC })
}

// ── 4. Goa trip (beach 1) · Feb 2024 ─────────────────────────────────────────
{
  await addReal({ poolFile: U('1507525428034-b723cf961d3e'), prefix: 'IMG', ts: '2024-02-14T09:46:00', attribution: uAttr('1507525428034'), license: U_LIC })
  await addReal({ poolFile: U('1519046904884-53103b34b206'), prefix: 'IMG', ts: '2024-02-14T11:20:00', attribution: uAttr('1519046904884'), license: U_LIC })
  await addReal({ poolFile: U('1502680390469-be75c86b636f'), prefix: 'IMG', ts: '2024-02-14T15:10:00', attribution: uAttr('1502680390469'), license: U_LIC })
  const parent = await addReal({ poolFile: U('1493558103817-58b2924bce98'), prefix: 'IMG', ts: '2024-02-14T16:35:00', attribution: uAttr('1493558103817'), license: U_LIC })
  await addBurst(parent, { ts: '2024-02-14T16:35:08', mode: 'center' })
  await addBurst(parent, { ts: '2024-02-14T16:35:15', mode: 'left', deleted: true, deletedNote: 'Removed as a near-duplicate on 2 Mar 2024.' })
  await addReal({ poolFile: U('1473116763249-2faaef81ccda'), prefix: 'IMG', ts: '2024-02-15T10:05:00', attribution: uAttr('1473116763249'), license: U_LIC })
  await addReal({ poolFile: U('1476673160081-cf065607f449'), prefix: 'IMG', ts: '2024-02-15T18:27:00', attribution: uAttr('1476673160081'), license: U_LIC })
}

// ── 5. Birthday at home · May 2024 ───────────────────────────────────────────
{
  await addReal({ poolFile: U('1602631985686-1bb0e6a8696e'), prefix: 'IMG', ts: '2024-05-10T19:30:00', attribution: uAttr('1602631985686'), license: U_LIC })
  await addReal({ poolFile: U('1530103862676-de8c9debad1d'), prefix: 'IMG', ts: '2024-05-10T19:50:00', attribution: uAttr('1530103862676'), license: U_LIC })
  await addReal({ poolFile: U('1558636508-e0db3814bd1d'), prefix: 'IMG', ts: '2024-05-10T20:15:00', attribution: uAttr('1558636508'), license: U_LIC })
  const parent = await addReal({ poolFile: U('1578985545062-69928b1d9587'), prefix: 'IMG', ts: '2024-05-10T20:40:00', attribution: uAttr('1578985545062'), license: U_LIC })
  await addBurst(parent, { ts: '2024-05-10T20:40:06', mode: 'center' })
  await addReal({ poolFile: U('1542826438-bd32f43d626f'), prefix: 'IMG', ts: '2024-05-10T21:02:00', attribution: uAttr('1542826438'), license: U_LIC })
  await addReal({ poolFile: U('1513151233558-d860c5398176'), prefix: 'IMG', ts: '2024-05-10T21:30:00', attribution: uAttr('1513151233558'), license: U_LIC })
}

// ── 6. Monsoon · Jul 2024 + Aug 2025 ─────────────────────────────────────────
{
  await addReal({ poolFile: U('1515694346937-94d85e41e6f0'), prefix: 'IMG', ts: '2024-07-20T16:45:00', attribution: uAttr('1515694346937'), license: U_LIC })
  await addReal({ poolFile: V('h4.jpg'), prefix: 'IMG', ts: '2025-07-12T16:57:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1428592953211-077101b2021b'), prefix: 'IMG', ts: '2024-08-03T09:15:00', attribution: uAttr('1428592953211'), license: U_LIC })
  await addReal({ poolFile: V('m1.jpg'), prefix: 'IMG', ts: '2025-08-09T07:52:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1501691223387-dd0500403074'), prefix: 'IMG', ts: '2025-08-30T18:20:00', attribution: uAttr('1501691223387'), license: U_LIC })
}

// ── 7. Anjali's wedding · Goa · Dec 2024 ─────────────────────────────────────
{
  await addReal({ poolFile: V('w3.jpg'), prefix: 'IMG', ts: '2024-12-14T14:15:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1587271636175-90d58cdad458'), prefix: 'IMG', ts: '2024-12-14T11:02:00', attribution: uAttr('1587271636175'), license: U_LIC })
  await addReal({ poolFile: U('1591604466107-ec97de577aff'), prefix: 'IMG', ts: '2024-12-14T12:30:00', attribution: uAttr('1591604466107'), license: U_LIC })
  await addReal({ poolFile: U('1522673607200-164d1b6ce486'), prefix: 'IMG', ts: '2024-12-15T10:20:00', attribution: uAttr('1522673607200'), license: U_LIC })
  await addReal({ poolFile: U('1520854221256-17451cc331bf'), prefix: 'IMG', ts: '2024-12-15T17:54:00', attribution: uAttr('1520854221256'), license: U_LIC })
  await addReal({ poolFile: U('1529636798458-92182e662485'), prefix: 'IMG', ts: '2024-12-15T18:30:00', attribution: uAttr('1529636798458'), license: U_LIC })
  await addReal({ poolFile: U('1469371670807-013ccf25f16a'), prefix: 'IMG', ts: '2024-12-15T19:05:00', attribution: uAttr('1469371670807'), license: U_LIC })
  const parent = await addReal({ poolFile: U('1583939003579-730e3918a45a'), prefix: 'IMG', ts: '2024-12-15T20:10:00', attribution: uAttr('1583939003579'), license: U_LIC })
  await addBurst(parent, { ts: '2024-12-15T20:10:07', mode: 'center' })
  await addReal({ poolFile: V('w1.jpg'), prefix: 'IMG', ts: '2024-12-15T11:15:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('w2.jpg'), prefix: 'IMG', ts: '2024-12-15T17:55:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('w5.jpg'), prefix: 'IMG', ts: '2024-12-15T22:40:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
}

// ── 8. Mumbai weekend + concert · Aug 2025 ───────────────────────────────────
{
  await addReal({ poolFile: U('1514565131-fce0801e5785'), prefix: 'IMG', ts: '2025-08-23T19:45:00', attribution: uAttr('1514565131'), license: U_LIC })
  await addReal({ poolFile: U('1470229722913-7c0e2dbbafd3'), prefix: 'IMG', ts: '2025-08-23T21:04:00', attribution: uAttr('1470229722913'), license: U_LIC })
  const parent = await addReal({ poolFile: U('1501281668745-f7f57925c3b4'), prefix: 'IMG', ts: '2025-08-23T21:30:00', attribution: uAttr('1501281668745'), license: U_LIC })
  await addBurst(parent, { ts: '2025-08-23T21:30:09', mode: 'center' })
  await addReal({ poolFile: U('1524368535928-5b5e00ddc76b'), prefix: 'IMG', ts: '2025-08-23T22:10:00', attribution: uAttr('1524368535928'), license: U_LIC })
  await addReal({ poolFile: V('c1.jpg'), prefix: 'IMG', ts: '2025-08-23T21:05:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('c2.jpg'), prefix: 'IMG', ts: '2025-08-23T19:44:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('c3.jpg'), prefix: 'IMG', ts: '2025-08-24T12:48:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1474487548417-781cb71495f3'), prefix: 'IMG', ts: '2025-08-24T09:34:00', attribution: uAttr('1474487548417'), license: U_LIC })
}

// ── 9. Birthday at the lake · Jun 2025 ───────────────────────────────────────
{
  await addReal({ poolFile: V('b3.jpg'), prefix: 'IMG', ts: '2025-06-14T16:45:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('b1.jpg'), prefix: 'IMG', ts: '2025-06-14T18:43:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1476514525535-07fb3b4ae5f1'), prefix: 'IMG', ts: '2025-06-14T17:20:00', attribution: uAttr('1476514525535'), license: U_LIC })
  await addReal({ poolFile: U('1501785888041-af3ef285b470'), prefix: 'IMG', ts: '2025-06-14T19:02:00', attribution: uAttr('1501785888041'), license: U_LIC })
  await addReal({ poolFile: V('b4.jpg'), prefix: 'IMG', ts: '2025-06-14T19:15:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('b5.jpg'), prefix: 'IMG', ts: '2025-06-14T19:32:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('g1.jpg'), prefix: 'IMG', ts: '2025-06-14T19:30:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true, deleted: true, deletedNote: 'Removed during a free-up-storage cleanup on 14 Mar 2026.' })
  await addReal({ poolFile: U('1464349153735-7db50ed83c84'), prefix: 'IMG', ts: '2025-06-14T20:30:00', attribution: uAttr('1464349153735'), license: U_LIC })
  await addReal({ poolFile: V('b2.jpg'), prefix: 'IMG', ts: '2025-06-14T20:30:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('b6.jpg'), prefix: 'IMG', ts: '2025-06-15T10:17:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
}

// ── 10. Kedarkantha trek · Oct 2025 ──────────────────────────────────────────
{
  await addReal({ poolFile: V('t1.jpg'), prefix: 'IMG', ts: '2025-10-19T09:34:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1491555103944-7c647fd857e6'), prefix: 'IMG', ts: '2025-10-19T14:36:00', attribution: uAttr('1491555103944'), license: U_LIC })
  await addReal({ poolFile: U('1458668383970-8ddd3927deed'), prefix: 'IMG', ts: '2025-10-20T10:10:00', attribution: uAttr('1458668383970'), license: U_LIC })
  await addReal({ poolFile: V('t4.jpg'), prefix: 'IMG', ts: '2025-10-19T14:36:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1523987355523-c7b5b0dd90a7'), prefix: 'IMG', ts: '2025-10-20T20:48:00', attribution: uAttr('1523987355523'), license: U_LIC })
  await addReal({ poolFile: V('t3.jpg'), prefix: 'IMG', ts: '2025-10-20T21:00:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('t2.jpg'), prefix: 'IMG', ts: '2025-10-21T12:30:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  const parent = await addReal({ poolFile: U('1517299321609-52687d1bc55a'), prefix: 'IMG', ts: '2025-10-21T12:45:00', attribution: uAttr('1517299321609'), license: U_LIC })
  await addBurst(parent, { ts: '2025-10-21T12:45:05', mode: 'left' })
}

// ── 11. Gokarna weekend (beach 2) · Feb 2026 ─────────────────────────────────
{
  await addReal({ poolFile: U('1468413253725-0d5181091126'), prefix: 'IMG', ts: '2026-02-14T10:46:00', attribution: uAttr('1468413253725'), license: U_LIC })
  await addReal({ poolFile: V('be1.jpg'), prefix: 'IMG', ts: '2026-02-14T11:30:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1471922694854-ff1b63b20054'), prefix: 'IMG', ts: '2026-02-14T12:15:00', attribution: uAttr('1471922694854'), license: U_LIC })
  await addReal({ poolFile: U('1520942702018-0862200e6873'), prefix: 'IMG', ts: '2026-02-14T15:40:00', attribution: uAttr('1520942702018'), license: U_LIC })
  await addReal({ poolFile: V('be2.jpg'), prefix: 'IMG', ts: '2026-02-14T18:07:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1505118380757-91f5f5632de0'), prefix: 'IMG', ts: '2026-02-15T09:52:00', attribution: uAttr('1505118380757'), license: U_LIC })
  await addReal({ poolFile: V('be3.jpg'), prefix: 'IMG', ts: '2026-02-15T10:10:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: V('be4.jpg'), prefix: 'IMG', ts: '2026-02-14T20:59:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
}

// ── 12. Cafe + work + streets · spread 2024-2026 ─────────────────────────────
{
  await addReal({ poolFile: U('1501339847302-ac426a4a7cbb'), prefix: 'IMG', ts: '2024-04-06T11:25:00', attribution: uAttr('1501339847302'), license: U_LIC })
  await addReal({ poolFile: U('1442512595331-e89e73853f31'), prefix: 'IMG', ts: '2024-10-12T10:05:00', attribution: uAttr('1442512595331'), license: U_LIC, deleted: true, deletedNote: 'Deleted on 30 Nov 2025 while clearing duplicates after a phone migration.' })
  await addReal({ poolFile: V('m2.jpg'), prefix: 'IMG', ts: '2024-05-03T16:10:00', attribution: 'AI-generated (v1 library)', license: GEN_LIC, generated: true })
  await addReal({ poolFile: U('1521017432531-fbd92d768814'), prefix: 'IMG', ts: '2025-04-19T17:05:00', attribution: uAttr('1521017432531'), license: U_LIC })
  await addReal({ poolFile: P('42'), prefix: 'IMG', ts: '2025-06-07T15:40:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
  await addReal({ poolFile: U('1522202176988-66273c2fd55f'), prefix: 'IMG', ts: '2025-09-13T14:20:00', attribution: uAttr('1522202176988'), license: U_LIC })
  await addReal({ poolFile: U('1552664730-d307ca884978'), prefix: 'IMG', ts: '2025-09-13T15:00:00', attribution: uAttr('1552664730'), license: U_LIC })
  await addReal({ poolFile: P('48'), prefix: 'IMG', ts: '2025-11-02T11:30:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
  await addReal({ poolFile: U('1533900298318-6b8da08a523e'), prefix: 'IMG', ts: '2024-06-09T18:25:00', attribution: uAttr('1533900298318'), license: U_LIC })
  await addReal({ poolFile: P('45'), prefix: 'IMG', ts: '2025-12-20T17:45:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
  await addReal({ poolFile: P('90'), prefix: 'IMG', ts: '2026-01-24T08:20:00', attribution: 'Picsum/Unsplash contributor', license: 'Unsplash License (via Picsum)' })
  await addReal({ poolFile: U('1519178614-68673b201f36'), prefix: 'IMG', ts: '2026-03-08T19:10:00', attribution: uAttr('1519178614'), license: U_LIC })
  await addReal({ poolFile: U('1414235077428-338989a2e8c0'), prefix: 'IMG', ts: '2026-04-11T20:35:00', attribution: uAttr('1414235077428'), license: U_LIC })
  await addReal({ poolFile: U('1540189549336-e6e99c3679fe'), prefix: 'IMG', ts: '2026-05-16T13:20:00', attribution: uAttr('1540189549336'), license: U_LIC })
}

console.log('camera items so far:', items.length)
const cam = items.filter((i) => i.source === 'camera')
console.log('deleted ghosts:', items.filter((i) => i.deleted).length)
console.log('generated:', cam.filter((i) => i.generated).length, 'real:', cam.filter((i) => !i.generated).length)

writeFileSync('./data/partial-manifest.json', JSON.stringify(items, null, 2))
console.log('partial manifest written; screenshots next (render-screenshots.ts)')
