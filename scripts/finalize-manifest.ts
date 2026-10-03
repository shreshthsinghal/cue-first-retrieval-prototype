// Phase 1h: finalize the v2 library manifest (camera items + chat screenshots).
import { readFileSync, writeFileSync, statSync } from 'fs'

interface Item {
  id: string; file: string; ts: string; source: 'camera' | 'screenshot'
  deleted: boolean; deletedNote?: string; license: string; attribution: string
  generated: boolean; derivedFrom?: string; width: number; height: number; bytes: number
}

const camera: Item[] = JSON.parse(readFileSync('./data/partial-manifest-2.json', 'utf8'))

const SS_LIC = 'Synthetic: rendered for this prototype'
const ss = (id: string, file: string, ts: string): Item => {
  const p = `./public/photos-v2/${file}`
  return { id, file, ts, source: 'screenshot', deleted: false, license: SS_LIC, attribution: 'Rendered for this prototype (not a real person\'s chat)', generated: true, width: 640, height: 1280, bytes: statSync(p).size }
}

const screenshots: Item[] = [
  ss('SS_20250620_2214_1', 'SS_20250620_2214_1.png', '2025-06-20T22:14:00'),
  ss('SS_20260117_0912_2', 'SS_20260117_0912_2.png', '2026-01-17T09:12:00'),
  ss('SS_20241128_1830_3', 'SS_20241128_1830_3.png', '2024-11-28T18:30:00'),
  ss('SS_20250908_1426_4', 'SS_20250908_1426_4.png', '2025-09-08T14:26:00'),
  ss('SS_20260307_2001_5', 'SS_20260307_2001_5.png', '2026-03-07T20:01:00'),
  ss('SS_20250823_1200_6', 'SS_20250823_1200_6.png', '2025-08-23T12:00:00'),
  ss('SS_20260219_2010_7', 'SS_20260219_2010_7.png', '2026-02-19T20:10:00'),
  ss('SS_20251016_2130_8', 'SS_20251016_2130_8.png', '2025-10-16T21:30:00'),
]

const all = [...camera, ...screenshots].sort((a, b) => a.ts.localeCompare(b.ts))

const manifest = {
  version: 'v2.0',
  builtAt: new Date().toISOString().slice(0, 10),
  persona: {
    name: 'Meera',
    homeCity: 'Bengaluru',
    birthday: { month: 6, day: 14 },
    referenceNow: '2026-10-01',
    importantDates: [
      { key: 'graduation', label: 'my graduation', date: '2023-05-16' },
      { key: 'diwali', label: 'Diwali at home', date: '2023-11-12' },
      { key: 'goa-trip', label: 'the Goa trip', date: '2024-02-14' },
      { key: 'birthday-2024', label: 'my birthday 2024', date: '2024-05-10' },
      { key: 'monsoon-2024', label: 'monsoon 2024', date: '2024-07-20' },
      { key: 'anjali-wedding', label: "Anjali's wedding", date: '2024-12-14' },
      { key: 'mumbai-trip', label: 'the Mumbai weekend', date: '2025-08-23' },
      { key: 'birthday-lake-2025', label: 'my birthday at the lake 2025', date: '2025-06-14' },
      { key: 'monsoon-2025', label: 'monsoon 2025', date: '2025-07-15' },
      { key: 'kedarkantha-trek', label: 'the Kedarkantha trek', date: '2025-10-18' },
      { key: 'gokarna-trip', label: 'the Gokarna weekend', date: '2026-02-14' },
    ],
  },
  notes: [
    'Synthetic demonstration library for one fictional persona. No real person\'s photos.',
    'Real photographs come from Unsplash contributors (Unsplash License) via images.unsplash.com and Picsum (which mirrors Unsplash photos and lists each author).',
    'Images marked generated were AI-generated or rendered for this prototype.',
    'No authored text labels are used for retrieval. Events are derived by clustering capture timestamps; named events resolve through the structured persona profile.',
  ],
  items: all,
}

writeFileSync('./data/library-manifest.json', JSON.stringify(manifest, null, 2))
const totalBytes = all.reduce((s, i) => s + i.bytes, 0)
console.log('items:', all.length)
console.log('camera:', all.filter((i) => i.source === 'camera').length, '| screenshots:', screenshots.length)
console.log('ghosts (deleted):', all.filter((i) => i.deleted).length)
console.log('real photos:', all.filter((i) => !i.generated && i.source === 'camera').length)
console.log('generated/rendered:', all.filter((i) => i.generated).length)
console.log(`payload: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)
const span = [all[0].ts, all[all.length - 1].ts]
console.log('time span:', span[0], '->', span[1])
