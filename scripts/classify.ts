// Phase 1c: CLIP zero-shot classification of all candidate photos into
// persona scene buckets. Produces library-raw/classified.json with, for each
// image: file, source (unsplash|picsum), top-3 predicted classes with scores,
// plus the raw 512-d embedding for reuse during curation review.

import { pipeline, env, CLIPTextModelWithProjection, AutoTokenizer } from '@huggingface/transformers'
import { readdirSync, writeFileSync, existsSync, readFileSync } from 'fs'
import path from 'path'

env.cacheDir = './.cache/hf'

const CLASSES: Array<[string, string[]]> = [
  ['mountains-snow', ['a snowy mountain summit', 'snowy peaks in winter']],
  ['mountains-trek', ['hikers walking on a mountain trail', 'a trekking path in the mountains']],
  ['forest-trail', ['a forest trail with tall trees', 'a path through a green forest']],
  ['camping-tent', ['a tent at a campsite', 'a tent glowing at night']],
  ['campfire', ['a campfire at night', 'people around a bonfire']],
  ['lake-boat', ['a boat on a calm lake', 'a canoe on the water']],
  ['lake-view', ['a calm lake surrounded by hills', 'a still lake at sunset']],
  ['waterfall-river', ['a waterfall in the mountains', 'a river with rocks']],
  ['beach-day', ['people on a sandy beach by the sea', 'a beach with waves and sand']],
  ['beach-sunset', ['a beach at sunset with orange sky', 'the sun setting over the ocean']],
  ['ocean-waves', ['large ocean waves', 'the sea with crashing waves']],
  ['concert', ['a concert crowd in front of a lit stage', 'people at a live music show with stage lights']],
  ['night-city', ['a city street at night with neon lights', 'a skyline lit up at night']],
  ['city-day', ['a busy city street during the day', 'buildings in a city']],
  ['skyline-view', ['a panoramic city skyline', 'skyscrapers viewed from afar']],
  ['train-metro', ['a train at a railway platform', 'a metro station']],
  ['street-food', ['a street food stall with snacks', 'fried street food being cooked']],
  ['restaurant', ['a restaurant table with dishes', 'people dining at a restaurant']],
  ['birthday-cake', ['a birthday cake with candles', 'someone blowing out candles on a cake']],
  ['balloons-party', ['colorful balloons at a party', 'party decorations with balloons']],
  ['party-lights', ['a party with string lights at night', 'fairy lights glowing in the dark']],
  ['wedding-couple', ['a bride and groom at a wedding', 'a wedding couple holding hands']],
  ['wedding-ceremony', ['a wedding ceremony with decorations', 'wedding guests at a venue']],
  ['mehndi-henna', ['hands decorated with henna mehndi', 'applying henna paste on hands']],
  ['indian-wedding', ['an indian wedding with traditional outfits', 'a colorful indian ceremony']],
  ['graduation', ['graduates in caps and gowns', 'a graduation ceremony with degree certificates']],
  ['food-home', ['home cooked food on a table', 'a plate of cooked meal at home']],
  ['dessert-sweet', ['a sweet dessert on a plate', 'cake slices and pastries']],
  ['coffee-chai', ['a cup of coffee or tea on a table', 'a hot cup of chai']],
  ['cafe', ['the interior of a cozy cafe', 'people sitting in a coffee shop']],
  ['cooking-kitchen', ['cooking in a kitchen', 'a kitchen counter with utensils']],
  ['dog', ['a dog looking at the camera', 'a pet dog']],
  ['dog-sofa', ['a dog lying on a sofa at home', 'a pet resting on a couch']],
  ['rain-window', ['raindrops on a window', 'rain running down glass']],
  ['rain-street', ['a rainy street with umbrellas', 'people walking in heavy rain']],
  ['books-shelf', ['a shelf full of books', 'a stack of books in a room']],
  ['study-notes', ['a desk with notebooks and studying', 'someone writing notes']],
  ['whiteboard', ['a whiteboard covered in writing', 'formulas written on a whiteboard']],
  ['family-group', ['a large family posing together', 'a group of relatives at home']],
  ['friends-group', ['a group of friends laughing together', 'friends posing for a photo']],
  ['couple-portrait', ['a portrait of a couple', 'two people posing together']],
  ['portrait-woman', ['a portrait of a woman', 'a close up of a woman smiling']],
  ['portrait-man', ['a portrait of a man', 'a close up of a man']],
  ['selfie-group', ['a group selfie', 'friends taking a selfie together']],
  ['park-fog', ['a foggy park in the morning', 'mist over trees in a park']],
  ['flowers-garden', ['flowers blooming in a garden', 'a field of flowers']],
  ['cycle-road', ['a bicycle on a road', 'cycling on a path']],
  ['window-view', ['a view from a window', 'looking out of a window at the rain']],
  ['laptop-desk', ['a desk with a laptop and work', 'someone working at a desk']],
  ['market-street', ['a busy market street', 'stalls at a bazaar']],
  ['temple-ritual', ['a temple with lamps and ritual', 'diya lamps glowing at a shrine']],
  ['fireworks', ['fireworks in the night sky', 'firecrackers lighting up the sky']],
  ['drone-aerial', ['an aerial drone view of landscape', 'a landscape seen from above']],
  ['abstract-other', ['an abstract pattern', 'a minimal texture close up']],
]

const DIRS = [
  { dir: './library-raw', source: 'unsplash' as const, skip: new Set(['manifest-candidates.json', 'picsum', 'classified.json']) },
  { dir: './library-raw/picsum', source: 'picsum' as const, skip: new Set<string>() },
]

const imageEmbedder = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32', { dtype: 'q8' })
const tokenizer = await AutoTokenizer.from_pretrained('Xenova/clip-vit-base-patch32')
const textModel = await CLIPTextModelWithProjection.from_pretrained('Xenova/clip-vit-base-patch32', { dtype: 'q8' })

async function embedText(text: string): Promise<Float32Array> {
  const inputs = tokenizer([text], { padding: true, truncation: true })
  const outputs = await textModel(inputs)
  const emb = outputs.text_embeds.normalize(2, 1)
  return new Float32Array(emb.data as Float32Array)
}

// Build the class centroid: mean of its prompt embeddings, normalized.
const classVecs: Array<{ name: string; vec: Float32Array }> = []
for (const [name, prompts] of CLASSES) {
  const vs: Float32Array[] = []
  for (const p of prompts) {
    vs.push(await embedText(p))
  }
  const acc = new Float32Array(vs[0].length)
  for (const v of vs) for (let i = 0; i < v.length; i++) acc[i] += v[i] / vs.length
  const norm = Math.sqrt(acc.reduce((s, x) => s + x * x, 0))
  for (let i = 0; i < acc.length; i++) acc[i] /= norm
  classVecs.push({ name, vec: acc })
}

const prev: Array<Record<string, unknown>> = existsSync('./library-raw/classified.json')
  ? JSON.parse(readFileSync('./library-raw/classified.json', 'utf8'))
  : []
const done = new Set(prev.map((r) => r.file))

const files: Array<{ file: string; rel: string; source: 'unsplash' | 'picsum' }> = []
for (const { dir, source, skip } of DIRS) {
  for (const f of readdirSync(dir)) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue
    if (skip.has(f)) continue
    const rel = path.join(dir, f)
    if (done.has(rel)) continue
    files.push({ file: f, rel, source })
  }
}
console.log('to classify:', files.length, '(already done:', done.size, ')')

const records = [...prev]
let n = 0
for (const { rel, source } of files) {
  const out = await imageEmbedder(rel)
  const cls = out.dims.length === 3 ? out.slice([0, 0, 0], [1, 1, out.dims[2]]).squeeze(1) : out
  const vec = new Float32Array(cls.data as Float32Array)
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  for (let i = 0; i < vec.length; i++) vec[i] /= norm
  const scored = classVecs.map((c) => ({
    name: c.name,
    cos: vec.reduce((s, x, i) => s + x * c.vec[i], 0),
  })).sort((a, b) => b.cos - a.cos)
  records.push({
    file: rel,
    name: source === 'unsplash' ? path.basename(rel) : `p${path.basename(rel)}`,
    source,
    top: scored.slice(0, 3).map((s) => ({ c: s.name, cos: Math.round(s.cos * 1000) / 1000 })),
    emb: Array.from(vec, (v) => Math.round(v * 10000) / 10000),
  })
  n++
  if (n % 40 === 0) console.log('classified', n, 'of', files.length)
}

writeFileSync('./library-raw/classified.json', JSON.stringify(records))
console.log('total classified:', records.length)

// Print a compact class histogram for review.
const hist: Record<string, number> = {}
for (const r of records) {
  const top = (r as { top: Array<{ c: string }> }).top[0].c
  hist[top] = (hist[top] ?? 0) + 1
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(hist).sort((a, b) => b[1] - a[1])), null, 1))
