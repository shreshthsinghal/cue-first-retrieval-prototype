// Baseline label view: for the classic-keyword baseline (A) and the v1 engine
// baseline (B) ONLY. v2 never reads this file (a unit test enforces it).
//
// How it is made (no human labels): each photo is auto-tagged with v1's own
// vocabulary using CLIP zero-shot. A tag from v1's tag list is assigned when
// its text embedding clears a fixed similarity threshold against the image.
// Limits, stated plainly: no person identity, no event names ("Anjali's
// wedding"), no place names, and CLIP's known biases on fine categories.
//
// One command: bun scripts/build-label-view.ts

import { pipeline, env, CLIPTextModelWithProjection, AutoTokenizer } from '@huggingface/transformers'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

env.cacheDir = './cache-hf'
const MODEL_ID = 'Xenova/clip-vit-base-patch32'

interface ManifestItem { id: string; file: string; ts: string; source: string; deleted: boolean; width: number; height: number }
const manifest = JSON.parse(readFileSync('./data/library-manifest.json', 'utf8'))
const items: ManifestItem[] = manifest.items

// v1's vocabulary (from src/lib/engine/parse.ts + library), verbatim.
const V1_TAGS = ['blowing', 'candles', 'cake', 'balloons', 'fairy-lights', 'selfie', 'sunset', 'night', 'morning', 'day', 'crowd', 'concert', 'fireworks', 'mehndi', 'mandap', 'dinner', 'food', 'dog', 'chai', 'rain', 'kitchen', 'coffee', 'cycling', 'books', 'whiteboard', 'study', 'exam', 'meme', 'ticket', 'snow', 'trail', 'tents', 'summit', 'waves', 'volleyball', 'water', 'portrait', 'boating', 'skyline', 'street-food', 'park', 'fog', 'cap', 'gown', 'forwarded', 'family', 'group', 'festival', 'house', 'lake', 'beach', 'wedding', 'graduation', 'hiking', 'forest', 'stars', 'campsite', 'river', 'stones', 'decorations', 'table', 'monsoon', 'window', 'walk', 'metro']
const V1_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black', 'white', 'grey', 'brown']
const V1_SETTINGS: Array<[string, string]> = [
  ['water', 'a lakeside or river waterside scene'], ['beach', 'a beach by the sea'],
  ['mountains', 'a mountain landscape'], ['home', 'inside a home'], ['city', 'a city scene'],
  ['campus', 'a university campus'], ['indoor', 'an indoor photo'], ['outdoor', 'an outdoor photo'],
]
const V1_EVENTS: Array<[string, string]> = [
  ['birthday', 'a birthday celebration'], ['wedding', 'a wedding ceremony'],
  ['graduation', 'a graduation ceremony'], ['trek', 'a trekking trip in the mountains'],
  ['beach-trip', 'a beach trip'], ['city-trip', 'a city trip'], ['everyday', 'an everyday moment at home'],
]

const TAG_PROMPTS: Record<string, string> = {
  blowing: 'someone blowing out birthday candles', candles: 'lit candles on a cake', cake: 'a celebration cake',
  balloons: 'colorful party balloons', 'fairy-lights': 'strings of tiny fairy lights', selfie: 'a selfie photo',
  sunset: 'a sunset with orange sky', night: 'a scene at night in the dark', morning: 'a fresh morning scene',
  day: 'a bright daytime scene', crowd: 'a dense crowd of people', concert: 'a live music concert with a stage',
  fireworks: 'fireworks exploding in the sky', mehndi: 'henna patterns on hands', mandap: 'a wedding mandap stage',
  dinner: 'people at a dinner table', food: 'plates of food', dog: 'a pet dog', chai: 'a cup of tea or chai',
  rain: 'rain falling', kitchen: 'a kitchen with cooking', coffee: 'a cup of coffee', cycling: 'riding a bicycle',
  books: 'a shelf or stack of books', whiteboard: 'a whiteboard with writing', study: 'studying with notes',
  exam: 'exam preparation with notes', meme: 'a funny meme image', ticket: 'a booking ticket or confirmation',
  snow: 'snow on the ground', trail: 'a hiking trail', tents: 'a camping tent', summit: 'a mountain summit view',
  waves: 'sea waves', volleyball: 'playing volleyball', water: 'a body of water', portrait: 'a close portrait of a person',
  boating: 'a boat ride on water', skyline: 'a city skyline', 'street-food': 'a street food stall', park: 'a green park',
  fog: 'thick fog or mist', cap: 'a graduation cap', gown: 'a graduation gown', forwarded: 'a forwarded message image',
  family: 'a family together', group: 'a group of people together', festival: 'a festival celebration',
  house: 'a house or home building', lake: 'a calm lake', beach: 'a sandy beach by the sea', wedding: 'a wedding ceremony',
  graduation: 'a graduation ceremony', hiking: 'hiking on a trail', forest: 'a forest with tall trees',
  stars: 'a starry night sky', campsite: 'a campsite', river: 'a flowing river', stones: 'rocks and stones',
  decorations: 'party decorations', table: 'a table with things on it', monsoon: 'monsoon rain weather',
  window: 'a window view', walk: 'people walking', metro: 'a metro train station',
}

const imageEmbedder = await pipeline('image-feature-extraction', MODEL_ID, { dtype: 'q8' })
const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID)
const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' })

async function embedText(text: string): Promise<Float32Array> {
  const inputs = tokenizer([text], { padding: true, truncation: true })
  const outputs = await textModel(inputs)
  return new Float32Array(outputs.text_embeds.normalize(2, 1).data as Float32Array)
}

const tagVecs = new Map<string, Float32Array>()
for (const t of V1_TAGS) tagVecs.set(t, await embedText(TAG_PROMPTS[t] ?? `a photo of ${t}`))
const colorVecs = new Map<string, Float32Array>()
for (const c of V1_COLORS) colorVecs.set(c, await embedText(`a photo where the color ${c} is clearly visible`))
const settingVecs = V1_SETTINGS.map(([s, p]) => embedText(p).then((v) => [s, v] as const))
const eventVecs = V1_EVENTS.map(([e, p]) => embedText(p).then((v) => [e, v] as const))
const settingsArr = await Promise.all(settingVecs)
const eventsArr = await Promise.all(eventVecs)

const THRESH_TAG = 0.24
const THRESH_COLOR = 0.22
const THRESH_EVENT = 0.235
const THRESH_SETTING = 0.235

const labels: Record<string, { tags: string[]; colors: string[]; setting: string; events: string[]; people: number; timeOfDay: string; sims: Record<string, number> }> = {}

for (const item of items) {
  const rel = path.join('./public/photos-v2', item.file)
  const out = await imageEmbedder(rel)
  const cls = out.dims.length === 3 ? out.slice([0, 0, 0], [1, 1, out.dims[2]]).squeeze(1) : out
  const vec = new Float32Array(cls.data as Float32Array)
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0))
  for (let i = 0; i < vec.length; i++) vec[i] /= norm
  const cos = (v: Float32Array) => vec.reduce((s, x, i) => s + x * v[i], 0)

  const sims: Record<string, number> = {}
  const tags = V1_TAGS.filter((t) => { const s = cos(tagVecs.get(t)!); sims[`tag:${t}`] = Math.round(s * 1000) / 1000; return s >= THRESH_TAG })
  const colors = V1_COLORS.filter((c) => { const s = cos(colorVecs.get(c)!); sims[`color:${c}`] = Math.round(s * 1000) / 1000; return s >= THRESH_COLOR })
  const setting = settingsArr.map(([s, v]) => ({ s, v: cos(v) })).sort((a, b) => b.v - a.v)[0]
  const events = eventsArr.filter(([, v]) => cos(v) >= THRESH_EVENT).map(([e]) => e)
  const h = Number(item.ts.slice(11, 13))
  const timeOfDay = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'sunset' : 'night'
  // people: the index-derived peopleProb is a CLIP probe, not an authored label.
  const idx = JSON.parse(readFileSync('./data/image-index.json', 'utf8'))
  const entry = idx.entries.find((e: { id: string }) => e.id === item.id)
  const people = entry && entry.peopleProb > 0.5 ? 2 : 0
  labels[item.id] = { tags, colors, setting: setting.s, events: events.length ? events : ['everyday'], people, timeOfDay, sims }
}

writeFileSync('./eval/labels.json', JSON.stringify(labels, null, 1))
const tagCount = Object.values(labels).reduce((s, l) => s + l.tags.length, 0)
console.log(`label view written for ${items.length} photos, ${tagCount} tags total (avg ${(tagCount / items.length).toFixed(1)}/photo)`)
const empty = Object.entries(labels).filter(([, l]) => l.tags.length === 0)
console.log('photos with zero tags:', empty.map(([id]) => id).join(', ') || 'none')
