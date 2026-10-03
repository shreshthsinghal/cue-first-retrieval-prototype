// Compare fit loss with hits ON vs OFF at fixed params.
import { readFileSync } from 'fs'
import { ENTRIES, PERSONA } from '../src/lib/engine2/index-loader'
import { parseTime, matchEventAnchor } from '../src/lib/engine2/time-parse'
import { loadQueries, makeSplits, embedText, type EvalQuery } from '../eval/lib/common'

const queries: EvalQuery[] = loadQueries()
const splits = makeSplits(queries)
const dev = queries.filter((q) => splits.splitOf(q) === 'dev')
const entries = ENTRIES
const N = entries.length
const L = Math.log

const prepared: Array<{ q: EvalQuery; z: number[]; timeHits: boolean[]; eventHits: boolean[]; absent: boolean }> = []
for (const q of dev) {
  const emb = await embedText(q.text)
  const cos = entries.map((e) => e.emb.reduce((s, x, i) => s + x * emb[i], 0))
  const mean = cos.reduce((s, x) => s + x, 0) / N
  const std = Math.sqrt(cos.reduce((s, x) => s + x * x, 0) / N - mean * mean) || 1e-6
  const z = cos.map((x) => (x - mean) / std)
  const est = parseTime(q.text, PERSONA)
  const anchor = matchEventAnchor(q.text, PERSONA)
  const inWin = (ts: string, center: string, spread: number) =>
    Math.abs(new Date(ts.slice(0, 10) + 'T00:00:00Z').getTime() - new Date(center.slice(0, 10) + 'T00:00:00Z').getTime()) <= spread * 86400000
  const timeHits = entries.map((e) => (est.center ? inWin(e.ts, est.center, Math.max(1, est.spreadDays)) : false))
  const eventHits = entries.map((e) => (anchor ? inWin(e.ts, anchor.date, 3) : false))
  prepared.push({ q, z, timeHits, eventHits, absent: !q.present })
}

function loss(a: number, pi: number, T: number, noneLogit: number, useHits: boolean) {
  const L1 = L(pi)
  const L0 = L(1 - pi)
  let total = 0
  for (const p of prepared) {
    const th = useHits ? p.timeHits : p.timeHits.map(() => false)
    const eh = useHits ? p.eventHits : p.eventHits.map(() => false)
    const scores = p.z.map((zv, i) => a * zv + (th[i] ? L1 : L0) + (eh[i] ? L1 : L0))
    const m = Math.max(...scores, noneLogit)
    let denom = Math.exp((noneLogit - m) / T)
    for (const s of scores) denom += Math.exp((s - m) / T)
    if (p.absent) total -= Math.log(Math.exp((noneLogit - m) / T) / denom)
    else {
      const idx = entries.findIndex((e) => e.id === p.q.target)
      total -= Math.log(Math.exp((scores[idx] - m) / T) / denom)
    }
  }
  return total
}

console.log('hits OFF (3, 0.8, 1.3, 6):', loss(3, 0.8, 1.3, 6, false).toFixed(10))
console.log('hits ON  (3, 0.8, 1.3, 6):', loss(3, 0.8, 1.3, 6, true).toFixed(10))
console.log('hits ON  (3, 0.8, 1.3, 9):', loss(3, 0.8, 1.3, 9, true).toFixed(10))
console.log('hits ON  (3, 0.8, 1.0, 9):', loss(3, 0.8, 1.0, 9, true).toFixed(10))
console.log('hits ON  (4, 0.8, 1.0, 9):', loss(4, 0.8, 1.0, 9, true).toFixed(10))
