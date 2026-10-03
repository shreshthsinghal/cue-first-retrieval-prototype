// Phase 2: index the photo library offline.
// One command: bun scripts/index-library.ts
//
// - Embeds every image with CLIP (Xenova/clip-vit-base-patch32, q8 ONNX).
// - Derives features at index time, never by hand:
//     * event clusters, from capture timestamps (gap-based, deterministic)
//     * "looks like a chat screenshot" probability, from CLIP text probes
//     * short visual hints per image, from a CLIP prompt bank (explanation
//       chips only; never used for matching)
// - Writes data/image-index.json with the model id + index hash, so the index
//   and the query encoder cannot silently mismatch.
// Deterministic: same library + model -> same index file.

import { pipeline, env, CLIPTextModelWithProjection, AutoTokenizer } from '@huggingface/transformers'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { createHash } from 'crypto'
import path from 'path'

env.cacheDir = './cache-hf'

const MODEL_ID = 'Xenova/clip-vit-base-patch32'
const MANIFEST = './data/library-manifest.json'
const OUT = './data/image-index.json'

interface ManifestItem {
  id: string; file: string; ts: string; source: 'camera' | 'screenshot'
  deleted: boolean; generated: boolean; width: number; height: number
}
interface Manifest { persona: unknown; items: ManifestItem[] }

const manifest: Manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const items = [...manifest.items].sort((a, b) => a.id.localeCompare(b.id)) // deterministic order

const started = Date.now()
const imageEmbedder = await pipeline('image-feature-extraction', MODEL_ID, { dtype: 'q8' })
const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID)
const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' })

async function embedText(text: string): Promise<Float32Array> {
  const inputs = tokenizer([text], { padding: true, truncation: true })
  const outputs = await textModel(inputs)
  const emb = outputs.text_embeds.normalize(2, 1)
  return new Float32Array(emb.data as Float32Array)
}

function cos(a: Float32Array | number[], b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// ── 1. Image embeddings ──────────────────────────────────────────────────────
interface Entry {
  id: string; file: string; ts: string; source: string; deleted: boolean
  emb: number[]; screenshotProb: number; indoorProb: number; peopleProb: number; hints: string[]
  cluster: string; width: number; height: number
}
const entries: Entry[] = []
const tEmb0 = Date.now()
for (const item of items) {
  const rel = path.join('./public/photos-v2', item.file)
  const out = await imageEmbedder(rel)
  const cls = out.dims.length === 3 ? out.slice([0, 0, 0], [1, 1, out.dims[2]]).squeeze(1) : out
  const vec = new Float32Array(cls.data as Float32Array)
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  for (let i = 0; i < vec.length; i++) vec[i] /= norm
  entries.push({
    id: item.id, file: item.file, ts: item.ts, source: item.source, deleted: item.deleted,
    emb: Array.from(vec, (v) => Math.round(v * 100000) / 100000),
    screenshotProb: 0, indoorProb: 0, peopleProb: 0, hints: [], cluster: '',
    width: item.width, height: item.height,
  })
}
const embMs = Date.now() - tEmb0

// ── 2. Screenshot probability (CLIP text probes) ─────────────────────────────
const shotProbes = [
  'a screenshot of a chat conversation',
  'a phone screen showing chat bubbles',
  'a messaging app conversation screenshot',
]
const nonShotProbes = [
  'a photograph taken with a camera',
  'a landscape or a person photographed outdoors',
]
const shotPos = await Promise.all(shotProbes.map(embedText))
const shotNeg = await Promise.all(nonShotProbes.map(embedText))
// Indoor/outdoor + people probes (used for the clarifying question and hints).
const indoorPos = await Promise.all(['an indoor photo taken inside a room'].map(embedText))
const indoorNeg = await Promise.all(['an outdoor photo taken outside in the open air'].map(embedText))
const peoplePos = await Promise.all(['a photo with people in it'].map(embedText))
const peopleNeg = await Promise.all(['a photo with no people, empty scene'].map(embedText))
for (const e of entries) {
  const pos = Math.max(...shotPos.map((p) => cos(e.emb, p)))
  const neg = Math.max(...shotNeg.map((p) => cos(e.emb, p)))
  // Logistic squash: a photo beats the best photograph probe by ~0.07 typically.
  e.screenshotProb = Math.round(1 / (1 + Math.exp(-28 * (pos - neg - 0.04))) * 1000) / 1000
  const ipos = Math.max(...indoorPos.map((p) => cos(e.emb, p)))
  const ineg = Math.max(...indoorNeg.map((p) => cos(e.emb, p)))
  e.indoorProb = Math.round(1 / (1 + Math.exp(-30 * (ipos - ineg))) * 1000) / 1000
  const ppos = Math.max(...peoplePos.map((p) => cos(e.emb, p)))
  const pneg = Math.max(...peopleNeg.map((p) => cos(e.emb, p)))
  e.peopleProb = Math.round(1 / (1 + Math.exp(-30 * (ppos - pneg))) * 1000) / 1000
}

// ── 3. Visual hints from a prompt bank (explanation chips only) ──────────────
const HINT_BANK: Array<[string, string[]]> = [
  ['at a birthday celebration', ['a birthday cake with candles', 'colorful party balloons']],
  ['at a wedding ceremony', ['a wedding couple at a ceremony', 'wedding decorations and guests']],
  ['hands with henna', ['hands decorated with henna mehndi']],
  ['on a beach', ['people on a sandy beach by the sea', 'a beach with waves']],
  ['in the sea waves', ['the sea with crashing waves', 'people in the ocean water']],
  ['in snowy mountains', ['a snowy mountain summit', 'snowy peaks in winter']],
  ['on a forest trail', ['a forest trail with tall trees']],
  ['at a campsite at night', ['a tent at a campsite at night', 'a campfire at night']],
  ['on a lake', ['a boat on a calm lake', 'a calm lake at sunset']],
  ['at a concert', ['a concert crowd in front of a lit stage']],
  ['in the city at night', ['a city street at night with lights', 'a skyline lit up at night']],
  ['on a city street', ['a busy city street during the day']],
  ['on a train platform', ['a train at a railway platform']],
  ['with street food', ['a street food stall with snacks']],
  ['at a restaurant', ['a restaurant table with dishes']],
  ['with home food', ['home cooked food on a table']],
  ['with a dessert', ['a sweet dessert on a plate']],
  ['with a cup of chai or coffee', ['a cup of coffee or tea on a table']],
  ['in a cafe', ['the interior of a cozy cafe']],
  ['with a dog', ['a pet dog looking at the camera', 'a dog lying on the grass']],
  ['rain on the window', ['raindrops on a window glass']],
  ['with an umbrella in the rain', ['people walking in heavy rain with umbrellas']],
  ['with books', ['a shelf full of books', 'an open book']],
  ['studying or writing', ['someone writing notes at a desk', 'a desk with notebooks']],
  ['at a whiteboard', ['a whiteboard covered in writing']],
  ['at a family gathering', ['a large family posing together']],
  ['with friends', ['a group of friends laughing together']],
  ['in a foggy park', ['a foggy park in the morning']],
  ['among flowers', ['flowers blooming in a garden']],
  ['on a cycling road', ['a bicycle on a road']],
  ['graduating in cap and gown', ['graduates in caps and gowns', 'a graduation ceremony']],
  ['with festive lamps', ['diya lamps glowing at a shrine', 'lanterns glowing in the dark']],
  ['with sparklers', ['people holding sparklers at night']],
  ['confetti in the air', ['confetti falling at a celebration']],
  ['at a fireworks night', ['fireworks in the night sky']],
]
const hintVecs: Array<{ label: string; vecs: Float32Array[] }> = []
for (const [label, prompts] of HINT_BANK) {
  hintVecs.push({ label, vecs: await Promise.all(prompts.map(embedText)) })
}
for (const e of entries) {
  const scored = hintVecs
    .map((h) => ({ label: h.label, s: Math.max(...h.vecs.map((v) => cos(e.emb, v))) }))
    .sort((a, b) => b.s - a.s)
  e.hints = scored.slice(0, 2).map((h) => h.label)
}

// ── 4. Event clusters from timestamps (never typed by hand) ──────────────────
const GAP_MS = 1000 * 60 * 60 * 36 // a gap of 36h starts a new cluster
const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts))
let clusterIdx = 0
let prevTs = 0
for (const e of sorted) {
  const ts = new Date(e.ts + 'Z').getTime()
  if (!prevTs || ts - prevTs > GAP_MS) clusterIdx += 1
  e.cluster = `e${String(clusterIdx).padStart(2, '0')}`
  prevTs = ts
}

// ── 5. Hash + write ──────────────────────────────────────────────────────────
const hashSrc = entries.map((e) => `${e.id}:${e.ts}`).join('|') + `|${MODEL_ID}`
const indexHash = createHash('sha256').update(hashSrc).digest('hex').slice(0, 16)

const out = {
  version: 'v2',
  modelId: MODEL_ID,
  dtype: 'q8',
  indexHash,
  count: entries.length,
  entries,
}
writeFileSync(OUT, JSON.stringify(out))

console.log(`indexed ${entries.length} images in ${((Date.now() - started) / 1000) | 0}s (embedding: ${(embMs / 1000) | 0}s)`)
console.log('index hash:', indexHash)
console.log('clusters:', clusterIdx)
const shotCount = entries.filter((e) => e.screenshotProb > 0.5).length
console.log('flagged as chat screenshots (prob>0.5):', shotCount, 'expected: 8')
console.log('index size:', (statSync(OUT).size / 1024 / 1024).toFixed(2), 'MB')
