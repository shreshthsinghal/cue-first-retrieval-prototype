// Evaluation shared utilities: seeded splits, Wilson intervals, query loading,
// cached text embeddings. Dev/test are split BY PHOTO, never by query.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { AutoTokenizer, CLIPTextModelWithProjection, env } from '@huggingface/transformers'

env.cacheDir = './cache-hf'
const MODEL_ID = 'Xenova/clip-vit-base-patch32'

export interface EvalQuery {
  id: string
  target: string
  present: boolean
  style: string
  lang: string
  text: string
  expect?: string
}

export function loadQueries(): EvalQuery[] {
  const raw = readFileSync('./eval/queries.jsonl', 'utf8')
  return raw.trim().split('\n').map((l) => JSON.parse(l) as EvalQuery)
}

export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Splits {
  devTargets: Set<string>
  testTargets: Set<string>
  splitOf: (q: EvalQuery) => 'dev' | 'test'
}

export function makeSplits(queries: EvalQuery[]): Splits {
  const rand = mulberry32(20261001)
  const presentTargets = [...new Set(queries.filter((q) => q.present && q.expect !== 'ghost').map((q) => q.target))]
  const absentTargets = [...new Set(queries.filter((q) => !q.present).map((q) => q.target))]
  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }
  const p = shuffle(presentTargets)
  const a = shuffle(absentTargets)
  const devTargets = new Set([...p.slice(0, Math.ceil(p.length * 0.6)), ...a.slice(0, Math.ceil(a.length * 0.6))])
  const testTargets = new Set([...p.slice(Math.ceil(p.length * 0.6)), ...a.slice(Math.ceil(a.length * 0.6))])
  const splitOf = (q: EvalQuery): 'dev' | 'test' => {
    if (q.expect === 'ghost') return 'test' // behavioral scenarios, never fitted
    return devTargets.has(q.target) ? 'dev' : 'test'
  }
  return { devTargets, testTargets, splitOf }
}

// ── Wilson 95% interval for a binomial proportion ─────────────────────────────
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0]
  const z = 1.959963985
  const p = k / n
  const denom = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denom
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
  return [Math.max(0, center - half), Math.min(1, center + half)]
}

// ── Cached Node-side text embeddings (same text tower the browser uses) ──────
let tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null
let textModel: Awaited<ReturnType<typeof CLIPTextModelWithProjection.from_pretrained>> | null = null
const CACHE_PATH = './eval/embed-cache.json'
let cache: Record<string, number[]> = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {}

export async function embedText(text: string): Promise<number[]> {
  const key = text.slice(0, 200)
  if (cache[key]) return cache[key]
  if (!tokenizer) {
    tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID)
    textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' })
  }
  const inputs = tokenizer([text], { padding: true, truncation: true })
  const outputs = await textModel!(inputs)
  const arr = Array.from(outputs.text_embeds.normalize(2, 1).data as Float32Array, (v) => Math.round(v * 1000000) / 1000000)
  cache[key] = arr
  return arr
}

export function saveEmbedCache(): void {
  writeFileSync(CACHE_PATH, JSON.stringify(cache))
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}

export function percentile(xs: number[], p: number): number {
  if (!xs.length) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}
