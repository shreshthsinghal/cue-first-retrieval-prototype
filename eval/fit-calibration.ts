// Phase 6 fit: a, pi, T, noneLogit by grid search on the DEV split only,
// minimizing log loss. Also derives the High and Medium band cutoffs on dev.
// One command: bun eval/fit-calibration.ts
// Writes src/lib/engine2/calibration.ts (the engine reads exactly these).

import { readFileSync, writeFileSync } from 'fs'
import { ENTRIES } from '../src/lib/engine2/index-loader'
import { parseTime, matchEventAnchor } from '../src/lib/engine2/time-parse'
import { PERSONA } from '../src/lib/engine2/index-loader'
import { loadQueries, makeSplits, embedText, saveEmbedCache, type EvalQuery } from './lib/common'

interface Manifest { persona: { importantDates: Array<{ key: string; label: string; date: string }> } }
void (JSON.parse(readFileSync('./data/library-manifest.json', 'utf8')) as Manifest)

const queries = loadQueries()
const splits = makeSplits(queries)
const dev = queries.filter((q) => splits.splitOf(q) === 'dev')
console.log(`dev queries: ${dev.length} (${dev.filter((q) => q.present).length} present, ${dev.filter((q) => !q.present).length} absent)`)

const entries = ENTRIES
const N = entries.length

// ── Precompute per-query content z-scores and time/event hit patterns ───────
interface Prepared {
  q: EvalQuery
  z: number[] // per-entry content z (raw text only; the fit uses the parser path)
  timeHits: boolean[]
  eventHits: boolean[]
  absent: boolean
}
const prepared: Prepared[] = []
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
  if (est.center) console.log('  ', q.id, 'center', est.center, 'timeHits', timeHits.filter(Boolean).length, 'anchor', anchor?.key ?? 'null', 'eventHits', eventHits.filter(Boolean).length)
}
saveEmbedCache()

const L = (p: number) => Math.log(p)

// ── Grid search ───────────────────────────────────────────────────────────────
const A_GRID = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8]
const PI_GRID = [0.5, 0.6, 0.7, 0.8, 0.9]
const T_GRID = [0.12, 0.15, 0.2, 0.25, 0.3, 0.35, 0.45, 0.6, 0.8, 1.0, 1.3, 1.6, 2.0, 2.5, 3.0]
const NONE_GRID = [-8, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 6, 8, 10, 12]

// Joint grid search on ALL dev queries (present + absent), minimizing total
// log loss, per the design spec. The trade-off this implies for the
// none-of-these detector is reported in docs/v2-evaluation.md.
function scoreOf(p: Prepared, a: number, L1: number, L0: number): number[] {
  return p.z.map((zv, i) => a * zv + (p.timeHits[i] ? L1 : L0) + (p.eventHits[i] ? L1 : L0))
}

let best: { a: number; pi: number; T: number; noneLogit: number; loss: number } | null = null
let bestAbsentWins = 0
for (const a of A_GRID) {
  for (const pi of PI_GRID) {
    const L1 = L(pi)
    const L0 = L(1 - pi)
    for (const T of T_GRID) {
      for (const noneLogit of NONE_GRID) {
        let loss = 0
        let absentWins = 0
        for (const p of prepared) {
          const scores = scoreOf(p, a, L1, L0)
          const m = Math.max(...scores, noneLogit)
          let denom = Math.exp((noneLogit - m) / T)
          for (const s of scores) denom += Math.exp((s - m) / T)
          if (p.absent) {
            const pNone = Math.exp((noneLogit - m) / T) / denom
            loss -= Math.log(pNone)
            const topProb = Math.max(...scores.map((s) => Math.exp((s - m) / T) / denom))
            if (pNone > topProb) absentWins += 1
          } else {
            const idx = entries.findIndex((e) => e.id === p.q.target)
            if (idx >= 0) loss -= Math.log(Math.exp((scores[idx] - m) / T) / denom)
          }
        }
        if (!best || loss < best.loss) { best = { a, pi, T, noneLogit, loss }; bestAbsentWins = absentWins }
      }
    }
  }
}
if (!best) throw new Error('grid search failed')
console.log('best joint fit:', JSON.stringify(best), 'avg log loss:', (best.loss / prepared.length).toFixed(4))
console.log('dev absent none-wins at the joint optimum:', bestAbsentWins, '/', prepared.filter((x) => x.absent).length)

// ── Band cutoffs from dev (present queries, fitted params) ───────────────────
const { a, pi, T, noneLogit } = best
const L1 = L(pi)
const L0 = L(1 - pi)
const top1s: Array<{ conf: number; correct: boolean }> = []
for (const p of prepared.filter((x) => !x.absent)) {
  const scores = p.z.map((zv, i) => a * zv + (p.timeHits[i] ? L1 : L0) + (p.eventHits[i] ? L1 : L0))
  const m = Math.max(...scores, noneLogit)
  let denom = Math.exp((noneLogit - m) / T)
  for (const s of scores) denom += Math.exp((s - m) / T)
  const probs = scores.map((s) => Math.exp((s - m) / T) / denom)
  const order = probs.map((pr, i) => ({ pr, i })).sort((x, y) => y.pr - x.pr)
  const top = order[0]
  const conf = Math.min(0.95, top.pr)
  const targetIdx = entries.findIndex((e) => e.id === p.q.target)
  top1s.push({ conf, correct: top.i === targetIdx })
}
function cutoffFor(precisionTarget: number): number {
  const cs: number[] = []
  for (let c = 0.05; c <= 0.951; c += 0.01) {
    const at = top1s.filter((t) => t.conf >= c)
    if (at.length < 3) continue
    const prec = at.filter((t) => t.correct).length / at.length
    if (prec >= precisionTarget) cs.push(Math.round(c * 100) / 100)
  }
  return cs.length ? cs[0] : 0.95
}
const highCutoff = cutoffFor(0.8)
const mediumCutoff = cutoffFor(0.5)
console.log('derived cutoffs on dev: High >=', highCutoff, '| Medium >=', mediumCutoff)

// ── Write calibration ─────────────────────────────────────────────────────────
const file = `// Fitted engine parameters. GENERATED by eval/fit-calibration.ts
// (grid search minimizing log loss on the dev split, seed 20261001).
// Fit details: see docs/v2-evaluation.md. Do not edit by hand.

export interface Calibration {
  version: string
  fittedOn: string
  method: string
  a: number
  pi: number
  T: number
  noneLogit: number
  clarifyBonus: number
  highCutoff: number
  mediumCutoff: number
  clarifyGap: number
}

export const CALIBRATION: Calibration = {
  version: 'fit-1',
  fittedOn: 'dev split of eval/queries.jsonl (${prepared.length} queries; present + absent targets)',
  method: 'grid search: a in ${JSON.stringify(A_GRID)}, pi in ${JSON.stringify(PI_GRID)}, T in ${JSON.stringify(T_GRID)}, noneLogit in ${JSON.stringify(NONE_GRID)}; objective: mean log loss; cutoffs derived on dev at top-1 precision >= 0.8 / >= 0.5 (min 3 queries)',
  a: ${a},
  pi: ${pi},
  T: ${T},
  noneLogit: ${noneLogit},
  clarifyBonus: 1.7,
  highCutoff: ${highCutoff},
  mediumCutoff: ${mediumCutoff},
  clarifyGap: 0.12,
}
`
writeFileSync('./src/lib/engine2/calibration.ts', file)
console.log('calibration written to src/lib/engine2/calibration.ts')
