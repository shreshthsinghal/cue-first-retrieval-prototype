// v2 scoring: content similarity, soft time and event priors, fusion into
// calibrated probabilities with an explicit "none of these" class.
//
// Design rules from the research:
// - Time is a soft clue, never a filter: a wrong stated date lowers the prior
//   a little and can never remove a photo from consideration.
// - Scores are standardized within the query (z-score over the library) so
//   probabilities are comparable across queries.
// - Every query gets the 5 closest photos plus a "none of these" probability:
//   there is no empty result and no silent failure.

import { CALIBRATION, type Calibration } from './calibration'
import type {
  BandedResult, ClarifyQuestion, EventAnchor, IndexEntry, QueryText, ScoreComponents, TimeEstimate,
} from './types'

export function withinWindow(ts: string, center: string, spreadDays: number): boolean {
  const t = new Date(ts.slice(0, 10) + 'T00:00:00Z').getTime()
  const c = new Date(center.slice(0, 10) + 'T00:00:00Z').getTime()
  return Math.abs(t - c) <= spreadDays * 86400000
}

export interface ScoredEntry {
  entry: IndexEntry
  cos: number
  contentZ: number
  timeBonus: number
  eventBonus: number
  clarifyBonus: number
  score: number
  prob: number
  bestText: QueryText | null
}

export interface ScoreAllResult {
  scored: ScoredEntry[]
  nonePct: number
  zMean: number
  zStd: number
}

export interface ScoreOptions {
  texts: QueryText[]
  time: TimeEstimate
  eventAnchor: EventAnchor | null
  clarifyAnswer?: string | null
  cal?: Calibration
}

export function scoreAll(entries: IndexEntry[], opts: ScoreOptions): ScoreAllResult {
  const cal = opts.cal ?? CALIBRATION
  const { texts, time, eventAnchor } = opts

  // ── content: cosine for every text, standardized within the query ─────────
  const cosPerText = texts.map((t) => entries.map((e) => dot(t.embedding, e.emb)))
  const n = entries.length
  let mean = 0
  let std = 1
  if (cosPerText.length && n > 1) {
    const flat = cosPerText[0]
    let sum = 0
    let sumSq = 0
    for (let i = 0; i < n; i++) { sum += flat[i]; sumSq += flat[i] * flat[i] }
    mean = sum / n
    std = Math.sqrt(Math.max(1e-6, sumSq / n - mean * mean))
  }

  const scored: ScoredEntry[] = entries.map((e, i) => {
    let bestZ = -Infinity
    let bestCos = -Infinity
    let bestText: QueryText | null = null
    for (let t = 0; t < texts.length; t++) {
      const cos = cosPerText[t][i]
      const z = (cos - mean) / std
      if (z > bestZ) { bestZ = z; bestCos = cos; bestText = texts[t] }
    }
    const timeBonus = time.center && time.spreadDays >= 0
      ? Math.log(withinWindow(e.ts, time.center, Math.max(1, time.spreadDays)) ? cal.pi : 1 - cal.pi)
      : 0
    const eventBonus = eventAnchor
      ? Math.log(withinWindow(e.ts, eventAnchor.date, 3) ? cal.pi : 1 - cal.pi)
      : 0
    const clarifyBonus = opts.clarifyAnswer && opts.clarifyAnswer === e.id ? cal.clarifyBonus : 0
    const score = cal.a * bestZ + timeBonus + eventBonus + clarifyBonus
    return { entry: e, cos: bestCos, contentZ: bestZ, timeBonus, eventBonus, clarifyBonus, score, prob: 0, bestText }
  })

  // ── softmax with one extra "none of these" class ──────────────────────────
  const maxScore = Math.max(...scored.map((s) => s.score), cal.noneLogit)
  let denom = 0
  for (const s of scored) denom += Math.exp((s.score - maxScore) / cal.T)
  const noneExp = Math.exp((cal.noneLogit - maxScore) / cal.T)
  denom += noneExp
  for (const s of scored) s.prob = Math.exp((s.score - maxScore) / cal.T) / denom
  const nonePct = noneExp / denom

  return { scored, nonePct, zMean: mean, zStd: std }
}

function dot(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i]
  return s
}

// ── Bands (cutoffs derived from the dev split, stored in calibration) ────────
export function bandOf(prob: number, cal: Calibration = CALIBRATION): BandedResult['band'] {
  if (prob >= cal.highCutoff) return 'High'
  if (prob >= cal.mediumCutoff) return 'Medium'
  return 'Low'
}

const DAYPART = (ts: string) => {
  const h = Number(ts.slice(11, 13))
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}
const SEASON = (ts: string) => {
  const m = Number(ts.slice(5, 7))
  if (m >= 3 && m <= 5) return 'summer'
  if (m >= 6 && m <= 9) return 'monsoon'
  if (m === 10) return 'a long weekend in October'
  return 'winter'
}

export function reasonLine(s: ScoredEntry, time: TimeEstimate, anchor: EventAnchor | null): string {
  const parts: string[] = []
  if (s.entry.hints.length) parts.push(`looks like your description: ${s.entry.hints[0]}`)
  else parts.push('visually the closest scene to your description')
  if (time.center) {
    const fit = s.timeBonus > -0.05 ? 'the date fits your estimate' : `captured ${formatDate(s.entry.ts)}, off from your estimate`
    parts.push(fit)
  }
  if (anchor && s.eventBonus > -0.05) parts.push(`falls on ${anchor.label}`)
  if (s.clarifyBonus > 0) parts.push('picked by you in the clarifying question')
  return parts.join('; ') + '.'
}

function formatDate(ts: string): string {
  return new Date(ts.slice(0, 10) + 'T00:00:00Z').toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── The single clarifying question ───────────────────────────────────────────
export function buildClarifyQuestion(top: ScoredEntry[]): ClarifyQuestion | null {
  if (top.length < 2) return null
  const [c1, c2] = top
  const candidates: Array<{ attribute: ClarifyQuestion['attribute']; question: string; labels: [string, string]; score: number }> = []

  const y1 = c1.entry.ts.slice(0, 4)
  const y2 = c2.entry.ts.slice(0, 4)
  if (y1 !== y2) candidates.push({ attribute: 'year', question: 'Which year was it?', labels: [y1, y2], score: 1 })

  const s1 = SEASON(c1.entry.ts)
  const s2 = SEASON(c2.entry.ts)
  if (s1 !== s2) candidates.push({ attribute: 'season', question: 'Which time of year feels right?', labels: [s1, s2], score: 0.9 })

  const i1 = c1.entry.indoorProb
  const i2 = c2.entry.indoorProb
  if (Math.sign(i1 - 0.5) !== Math.sign(i2 - 0.5)) {
    candidates.push({ attribute: 'indoor', question: 'Was it indoors or outdoors?', labels: [i1 >= 0.5 ? 'indoors' : 'outdoors', i2 >= 0.5 ? 'indoors' : 'outdoors'], score: 0.8 })
  }

  const d1 = DAYPART(c1.entry.ts)
  const d2 = DAYPART(c2.entry.ts)
  if (d1 !== d2) candidates.push({ attribute: 'daypart', question: 'What time of day was it?', labels: [d1, d2], score: 0.7 })

  const p1 = c1.entry.peopleProb
  const p2 = c2.entry.peopleProb
  if (Math.sign(p1 - 0.5) !== Math.sign(p2 - 0.5)) {
    candidates.push({ attribute: 'people', question: 'Were you with people, or was it just the scene?', labels: [p1 >= 0.5 ? 'with people' : 'no people', p2 >= 0.5 ? 'with people' : 'no people'], score: 0.6 })
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  const c = candidates[0]
  return {
    question: c.question,
    attribute: c.attribute,
    options: [
      { id: c1.entry.id, label: c.labels[0], thumbnail: `/photos-v2/${c1.entry.file}` },
      { id: c2.entry.id, label: c.labels[1], thumbnail: `/photos-v2/${c2.entry.file}` },
    ],
    note: 'Asking once, with the two leading photos attached, replaces the reformulating nobody does (0 reformulations in the live research tasks).',
  }
}
