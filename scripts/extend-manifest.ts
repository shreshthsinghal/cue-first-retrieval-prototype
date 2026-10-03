// Phase 1f: extend the manifest with everyday real photos + finalize.
import { existsSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'fs'
import sharp from 'sharp'
import path from 'path'
import type { Item } from './manifest-types'

const OUT_DIR = './public/photos-v2'
const items: Item[] = JSON.parse(readFileSync('./data/partial-manifest.json', 'utf8'))

let counter = 1000
async function addReal(opts: {
  poolFile: string; ts: string; attribution: string; license: string
  deleted?: boolean; deletedNote?: string
}) {
  const src = opts.poolFile
  if (!existsSync(src)) throw new Error(`missing: ${src}`)
  counter += 1
  const [date, time] = opts.ts.split('T')
  const id = `IMG_${date.replace(/-/g, '')}_${time.replace(':', '')}_${counter}`
  const file = `${id}.jpg`
  const dest = path.join(OUT_DIR, file)
  copyFileSync(src, dest)
  const meta = await sharp(dest).metadata()
  items.push({
    id, file, ts: opts.ts, source: 'camera', deleted: opts.deleted ?? false,
    ...(opts.deletedNote ? { deletedNote: opts.deletedNote } : {}),
    license: opts.license, attribution: opts.attribution, generated: false,
    width: meta.width ?? 0, height: meta.height ?? 0, bytes: statSync(dest).size,
  })
}

const U = (id: string) => `./library-raw/${id}.jpg`
const P = (id: string) => `./library-raw/picsum/${id}.jpg`
const uAttr = (id: string) => `Unsplash contributor (photo-${id}, via images.unsplash.com)`
const pAttr = (id: string) => `Picsum/Unsplash contributor (picsum id ${id})`
const PLIC = 'Unsplash License (via Picsum)'
const ULIC = 'Unsplash License'

// Sunday cycles · Jun 2024
await addReal({ poolFile: P('203'), ts: '2024-06-23T06:40:00', attribution: pAttr('203'), license: PLIC })
await addReal({ poolFile: P('165'), ts: '2024-06-23T07:10:00', attribution: pAttr('165'), license: PLIC })
// Morning + evening walks · spread
await addReal({ poolFile: P('70'), ts: '2025-01-05T07:05:00', attribution: pAttr('70'), license: PLIC })
await addReal({ poolFile: P('140'), ts: '2026-01-04T07:20:00', attribution: pAttr('140'), license: PLIC })
await addReal({ poolFile: P('168'), ts: '2025-12-14T16:40:00', attribution: pAttr('168'), license: PLIC })
await addReal({ poolFile: P('173'), ts: '2025-11-02T17:35:00', attribution: pAttr('173'), license: PLIC })
await addReal({ poolFile: P('110'), ts: '2024-10-20T18:05:00', attribution: pAttr('110'), license: PLIC })
// Chai + coffee + study
await addReal({ poolFile: P('30'), ts: '2025-02-08T10:15:00', attribution: pAttr('30'), license: PLIC })
await addReal({ poolFile: P('63'), ts: '2025-09-21T16:45:00', attribution: pAttr('63'), license: PLIC })
await addReal({ poolFile: P('20'), ts: '2025-09-21T16:52:00', attribution: pAttr('20'), license: PLIC })
await addReal({ poolFile: P('24'), ts: '2024-12-29T21:15:00', attribution: pAttr('24'), license: PLIC })
await addReal({ poolFile: P('4'), ts: '2026-06-20T11:05:00', attribution: pAttr('4'), license: PLIC })
await addReal({ poolFile: U('1434030216411-0b793f4b4173'), ts: '2026-02-08T21:30:00', attribution: uAttr('1434030216411'), license: ULIC })
await addReal({ poolFile: U('1456513080510-7bf3a84b82f8'), ts: '2025-11-30T20:40:00', attribution: uAttr('1456513080510'), license: ULIC })
// Dog
await addReal({ poolFile: P('169'), ts: '2025-04-13T09:20:00', attribution: pAttr('169'), license: PLIC })
await addReal({ poolFile: U('1544568100-847a948585b9'), ts: '2024-10-06T08:05:00', attribution: uAttr('1544568100'), license: ULIC })
await addReal({ poolFile: U('1601758228041-f3b2795255f1'), ts: '2026-03-07T20:15:00', attribution: uAttr('1601758228041'), license: ULIC })
// Coasts: fill Goa 2024 + Gokarna 2026
await addReal({ poolFile: U('1510414842594-a61c69b5ae57'), ts: '2026-02-15T09:30:00', attribution: uAttr('1510414842594'), license: ULIC })
await addReal({ poolFile: P('179'), ts: '2026-02-15T10:05:00', attribution: pAttr('179'), license: PLIC })
await addReal({ poolFile: P('135'), ts: '2026-02-15T11:05:00', attribution: pAttr('135'), license: PLIC })
await addReal({ poolFile: P('37'), ts: '2026-02-15T16:20:00', attribution: pAttr('37'), license: PLIC })
await addReal({ poolFile: P('147'), ts: '2024-02-15T17:35:00', attribution: pAttr('147'), license: PLIC })
await addReal({ poolFile: P('16'), ts: '2024-02-15T16:05:00', attribution: pAttr('16'), license: PLIC })
// Bengaluru streets + city
await addReal({ poolFile: P('57'), ts: '2025-11-15T18:05:00', attribution: pAttr('57'), license: PLIC })
await addReal({ poolFile: P('22'), ts: '2026-03-21T08:35:00', attribution: pAttr('22'), license: PLIC })
await addReal({ poolFile: P('88'), ts: '2025-11-15T18:40:00', attribution: pAttr('88'), license: PLIC })
await addReal({ poolFile: P('183'), ts: '2024-01-26T12:10:00', attribution: pAttr('183'), license: PLIC })
await addReal({ poolFile: P('146'), ts: '2024-01-26T12:12:00', attribution: pAttr('146'), license: PLIC })
// Flowers + park + forest
await addReal({ poolFile: P('82'), ts: '2025-03-15T17:20:00', attribution: pAttr('82'), license: PLIC })
await addReal({ poolFile: P('118'), ts: '2024-08-17T16:55:00', attribution: pAttr('118'), license: PLIC })
await addReal({ poolFile: P('152'), ts: '2024-08-17T17:00:00', attribution: pAttr('152'), license: PLIC })
await addReal({ poolFile: P('18'), ts: '2025-10-02T10:10:00', attribution: pAttr('18'), license: PLIC })
await addReal({ poolFile: U('1473448912268-2022ce9509d8'), ts: '2025-10-19T08:20:00', attribution: uAttr('1473448912268'), license: ULIC })
await addReal({ poolFile: U('1441974231531-c6227db76b6e'), ts: '2025-10-19T08:45:00', attribution: uAttr('1441974231531'), license: ULIC })
// Lake extras
await addReal({ poolFile: U('1439066615861-d1af74d74000'), ts: '2025-06-14T15:10:00', attribution: uAttr('1439066615861'), license: ULIC })
await addReal({ poolFile: U('1499678329028-101435549a4e'), ts: '2025-06-15T09:40:00', attribution: uAttr('1499678329028'), license: ULIC })
// Food + portrait + skyline
await addReal({ poolFile: P('102'), ts: '2026-05-03T15:45:00', attribution: pAttr('102'), license: PLIC })
await addReal({ poolFile: U('1565958011703-44f9829ba187'), ts: '2026-05-03T15:48:00', attribution: uAttr('1565958011703'), license: ULIC })
await addReal({ poolFile: U('1482049016688-2d3e1b311543'), ts: '2025-08-10T09:12:00', attribution: uAttr('1482049016688'), license: ULIC })
await addReal({ poolFile: P('65'), ts: '2026-01-11T18:12:00', attribution: pAttr('65'), license: PLIC })
await addReal({ poolFile: P('91'), ts: '2025-02-16T15:30:00', attribution: pAttr('91'), license: PLIC })
await addReal({ poolFile: P('129'), ts: '2026-05-24T18:55:00', attribution: pAttr('129'), license: PLIC })
await addReal({ poolFile: P('74'), ts: '2026-04-05T17:45:00', attribution: pAttr('74'), license: PLIC })
await addReal({ poolFile: P('214'), ts: '2026-04-05T17:50:00', attribution: pAttr('214'), license: PLIC })
// 5th ghost: harbor pier, deleted in a storage cleanup
await addReal({ poolFile: P('52'), ts: '2026-04-05T17:47:00', attribution: pAttr('52'), license: PLIC, deleted: true, deletedNote: 'Deleted on 21 May 2026 to free up storage; still on the old laptop backup.' })

console.log('camera total:', items.length)
console.log('ghosts:', items.filter((i) => i.deleted).length)
console.log('real (non-generated):', items.filter((i) => !i.generated).length)
console.log('generated:', items.filter((i) => i.generated).length)

writeFileSync('./data/partial-manifest-2.json', JSON.stringify(items, null, 2))
