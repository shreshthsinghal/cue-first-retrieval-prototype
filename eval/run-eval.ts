// Phase 6: the full evaluation. One command: bun eval/run-eval.ts [--llm]
//
// Runs on the TEST split only for reported numbers (fit was dev-only):
//   (A) classic keyword baseline on the CLIP-generated label view
//   (B) the v1 engine on the same label view
//   (C) v2 ablation stages S1..S5
// plus the calibration table, none-of-these detection quality, ghost
// scenarios, and latency. Writes eval/results.json + eval/results.md.

import { readFileSync, writeFileSync } from 'fs'
import { ENTRIES, PERSONA } from '../src/lib/engine2/index-loader'
import { INDEX } from '../src/lib/engine2/index-loader'
import { parseTime, matchEventAnchor } from '../src/lib/engine2/time-parse'
import { interpretCue } from '../src/lib/engine2/interpreter'
import { makeRetriever } from '../src/lib/engine2/retrieve2'
import { CALIBRATION } from '../src/lib/engine2/calibration'
import { scoreAll, bandOf } from '../src/lib/engine2/score'
import type { QueryText, TimeEstimate, EventAnchor, InterpretResult } from '../src/lib/engine2/types'
import { loadQueries, makeSplits, embedText, saveEmbedCache, wilson, mean, percentile, type EvalQuery } from './lib/common'

const USE_LLM = process.argv.includes('--llm')
const TEST_ONLY_REPORT = true

// ── Baseline library: v1 engine + classic keyword over the CLIP label view ──
interface PhotoV1 {
  id: string; src: string; date: string; album: string
  events: string[]; tags: string[]; colors: string[]; setting: string
  people: number; timeOfDay: string; origin: string; width: number; height: number
  deleted?: { on: string; note: string }
}
function buildV1Library(): PhotoV1[] {
  const manifest = JSON.parse(readFileSync('./data/library-manifest.json', 'utf8'))
  const labels = JSON.parse(readFileSync('./eval/labels.json', 'utf8'))
  const idx = INDEX
  const out: PhotoV1[] = []
  for (const item of manifest.items as Array<{ id: string; file: string; ts: string; source: string; deleted: boolean; deletedNote?: string; width: number; height: number }>) {
    if (!labels[item.id]) continue
    const heldout = !ENTRIES.some((e) => e.id === item.id)
    if (heldout) continue // the label view sees exactly the same candidates
    const entry = idx.entries.find((e) => e.id === item.id)!
    const date = item.ts.slice(0, 10)
    out.push({
      id: item.id,
      src: `/photos-v2/${item.file}`,
      date,
      album: `Cluster ${entry.cluster} (${date.slice(0, 7)})`,
      events: labels[item.id].events,
      tags: labels[item.id].tags,
      colors: labels[item.id].colors,
      setting: labels[item.id].setting,
      people: labels[item.id].people,
      timeOfDay: labels[item.id].timeOfDay,
      origin: item.source === 'screenshot' ? 'screenshot' : 'camera',
      width: item.width, height: item.height,
      ...(item.deleted ? { deleted: { on: '2026-01-01', note: item.deletedNote ?? 'Deleted from the library.' } } : {}),
    })
  }
  return out
}

// ── Metrics helpers ───────────────────────────────────────────────────────────
interface RankResult { recall: [number, number, number]; mrr: number; n: number }
function rankMetrics(ranks: number[], k: [number, number, number] = [1, 3, 5]): RankResult {
  const n = ranks.length
  const r = (kk: number) => ranks.filter((x) => x >= 1 && x <= kk).length
  const mrr = n ? mean(ranks.map((x) => (x > 0 ? 1 / x : 0))) : 0
  return { recall: [r(k[0]) / n, r(k[1]) / n, r(k[2]) / n], mrr, n }
}
function fmtCI(k: number, n: number): string {
  const [lo, hi] = wilson(k, n)
  return `${n ? ((k / n) * 100).toFixed(1) : '0.0'}% (Wilson 95% ${((lo) * 100).toFixed(1)} to ${((hi) * 100).toFixed(1)}, n=${n})`
}

// ── v2 runners ────────────────────────────────────────────────────────────────
const retrieve = makeRetriever(ENTRIES, { indexHash: INDEX.indexHash, modelId: INDEX.modelId })

function parserInterpretation(q: EvalQuery): InterpretResult {
  const time = parseTime(q.text, PERSONA)
  const anchor = matchEventAnchor(q.text, PERSONA)
  return {
    rewrites: [],
    time,
    eventAnchor: anchor ? { key: anchor.key, label: anchor.label, date: anchor.date } : null,
    scope: /\b(sent|forwarded|forward|whatsapp|meme|status)\b/.test(q.text.toLowerCase()) ? 'received' : null,
    peopleHint: /\b(we|us|friends|family|everyone|together)\b/.test(q.text.toLowerCase()) ? 'group' : 'alone',
    interpretedBy: 'basic-parser',
    reason: 'eval: parser path',
    llmMs: 0,
    note: [],
  }
}

async function v2Run(q: EvalQuery, stage: 1 | 2 | 3 | 4 | 5): Promise<{ ranks: number; nonePct: number; outcome: string; top1conf: number; interpretMs: number }> {
  const e0 = Date.now()
  const rawEmb = await embedText(q.text)
  embedMss.push(Date.now() - e0)
  let texts: QueryText[] = [{ role: 'raw', text: q.text, embedding: rawEmb }]
  let interpretation: InterpretResult
  let interpretMs = 0
  if (stage >= 3) {
    const t0 = Date.now()
    if (USE_LLM) await new Promise((r) => setTimeout(r, 1200)) // pacing for the shared endpoint
    interpretation = USE_LLM ? await interpretCue(q.text, PERSONA) : parserInterpretation(q)
    interpretMs = Date.now() - t0
    if (USE_LLM) { llmTried += 1; if (interpretation.interpretedBy === 'ai-model') llmUsed += 1 }
    interpretMssAll.push(interpretMs)
    for (const rw of interpretation.rewrites) {
      texts.push({ role: 'rewrite', text: rw, embedding: await embedText(rw) })
    }
  } else if (stage === 2) {
    interpretation = parserInterpretation(q)
  } else {
    interpretation = { ...parserInterpretation(q), time: { center: null, spreadDays: 0, confident: false, source: 'none', kind: 'none' }, eventAnchor: null }
  }
  const res = retrieve({ cue: q.text, interpretation, texts })
  let ranks = 0
  const livingTop = res.results
  const idx = livingTop.findIndex((r) => r.id === q.target)
  ranks = idx >= 0 ? idx + 1 : 0
  // stage 4: one clarifying question, simulated oracle answer
  if (stage >= 4 && res.outcome === 'clarify' && res.clarify) {
    const opts = res.clarify.options
    const targetOpt = opts.find((o) => o.id === q.target)
    const answer = targetOpt ? targetOpt.id : opts[0].id
    const res2 = retrieve({ cue: q.text, interpretation, texts, clarifyAnswer: answer, clarifyUsed: true })
    const idx2 = res2.results.findIndex((r) => r.id === q.target)
    ranks = idx2 >= 0 ? idx2 + 1 : ranks
    return { ranks, nonePct: res2.nonePct, outcome: res2.outcome, top1conf: res2.results[0]?.probability ?? 0, interpretMs }
  }
  return { ranks, nonePct: res.nonePct, outcome: res.outcome, top1conf: res.results[0]?.probability ?? 0, interpretMs }
}

// ── Baselines ─────────────────────────────────────────────────────────────────
async function classicRun(q: EvalQuery, lib: PhotoV1[]): Promise<{ ranks: number; count: number }> {
  const CLASSIC_STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'my', 'was', 'is', 'it', 'and', 'or', 'with', 'she', 'he', 'i', 'me', 'we', 'us', 'her', 'his', 'there', 'that', 'this', 'for', 'before', 'after', 'around', 'near', 'some', 'just', 'think', 'maybe', 'sometime', 'somewhere', 'photo', 'picture', 'one', 'no', 'wait', 'last', 'being', 'were', 'remember', 'really', 'can'])
  const tokens = q.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !CLASSIC_STOP.has(t))
  const hits: string[] = []
  for (const p of lib) {
    if (p.deleted) continue
    const hay = [p.id, p.album, p.date, p.setting, ...p.tags, ...p.colors, ...p.events].join(' ').toLowerCase()
    const matched = tokens.filter((t) => hay.includes(t))
    if (tokens.length > 0 && matched.length === tokens.length) hits.push(p.id)
  }
  const idx = hits.indexOf(q.target)
  return { ranks: idx >= 0 ? idx + 1 : 0, count: hits.length }
}

async function v1Run(q: EvalQuery, lib: PhotoV1[]): Promise<number> {
  const { retrieve: v1Retrieve, setLibrary } = await import('../src/lib/engine/retrieve')
  setLibrary(lib as never[])
  const res = v1Retrieve(q.text)
  const idx = (res.ranking ?? []).findIndex((r) => r.id === q.target)
  return idx >= 0 ? idx + 1 : 0
}

// ── Main ──────────────────────────────────────────────────────────────────────
const queries = loadQueries()
const splits = makeSplits(queries)
const test = queries.filter((q) => !TEST_ONLY_REPORT || splits.splitOf(q) === 'test')
const testPresent = test.filter((q) => q.present && q.expect !== 'ghost')
const testAbsent = test.filter((q) => !q.present)
const testGhost = test.filter((q) => q.expect === 'ghost')
console.log(`test split: ${testPresent.length} present, ${testAbsent.length} absent, ${testGhost.length} ghost scenarios`)

const v1lib = buildV1Library()
console.log(`baseline label-view library: ${v1lib.length} photos`)

const results: Record<string, unknown> = {}
let llmUsed = 0
let llmTried = 0
const top1cal: Array<{ conf: number; correct: boolean }> = []
const embedMss: number[] = []
const interpretMssAll: number[] = []
const embedT0 = Date.now()

// (A) classic keyword
const classicRanks: number[] = []
const classicCounts: number[] = []
for (const q of testPresent) {
  const r = await classicRun(q, v1lib)
  classicRanks.push(r.ranks)
  classicCounts.push(r.count)
}
const classicM = rankMetrics(classicRanks)
results.classic = { ...classicM, wilson: fmtCI(classicRanks.filter((x) => x === 1).length, classicM.n), avgHits: mean(classicCounts) }
console.log(`(A) classic keyword: R@1 ${classicM.recall[0].toFixed(3)} R@3 ${classicM.recall[1].toFixed(3)} R@5 ${classicM.recall[2].toFixed(3)} MRR ${classicM.mrr.toFixed(3)}`)

// (B) v1 engine
const v1Ranks: number[] = []
for (const q of testPresent) v1Ranks.push(await v1Run(q, v1lib))
const v1M = rankMetrics(v1Ranks)
results.v1 = { ...v1M, wilson: fmtCI(v1Ranks.filter((x) => x === 1).length, v1M.n) }
console.log(`(B) v1 engine: R@1 ${v1M.recall[0].toFixed(3)} R@3 ${v1M.recall[1].toFixed(3)} R@5 ${v1M.recall[2].toFixed(3)} MRR ${v1M.mrr.toFixed(3)}`)

// (C) v2 ablation stages
const stageNames: Record<number, string> = {
  1: 'S1 content (raw text only)',
  2: 'S2 + rule-based time prior (no LLM)',
  3: USE_LLM ? 'S3 + LLM interpretation' : 'S3 + LLM interpretation (LLM unavailable; parser path)',
  4: 'S4 + one clarifying question (simulated)',
  5: 'S5 full v2 (none-of-these active)',
}
const byStyle: Record<string, { ranks: number[] }> = {}
for (const stage of [1, 2, 3, 4, 5] as const) {
  const ranks: number[] = []
  let nonePcts: number[] = []
  const outcomes: Record<string, number> = {}
  const top1confs: number[] = []
  const interpretMss: number[] = []
  for (const q of testPresent) {
    const r = await v2Run(q, stage)
    ranks.push(r.ranks)
    nonePcts.push(r.nonePct)
    top1confs.push(r.top1conf)
    interpretMss.push(r.interpretMs)
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1
    if (stage === 5) {
      top1cal.push({ conf: r.top1conf, correct: r.ranks === 1 })
      byStyle[q.style] = byStyle[q.style] ?? { ranks: [] }
      byStyle[q.style].ranks.push(r.ranks)
    }
  }
  const m = rankMetrics(ranks)
  results[`v2_s${stage}`] = {
    name: stageNames[stage], ...m,
    wilsonR1: fmtCI(ranks.filter((x) => x === 1).length, m.n),
    outcomes, avgNonePct: mean(nonePcts), avgTop1conf: mean(top1confs), avgInterpretMs: mean(interpretMss),
  }
  console.log(`(C${stage}) ${stageNames[stage]}: R@1 ${m.recall[0].toFixed(3)} R@3 ${m.recall[1].toFixed(3)} R@5 ${m.recall[2].toFixed(3)} MRR ${m.mrr.toFixed(3)}`)
}

// Absent-target detection (stage 5)
const absentRes: Array<{ noneTop: boolean; nonePct: number }> = []
for (const q of testAbsent) {
  const r = await v2Run(q, 5)
  absentRes.push({ noneTop: r.outcome === 'none_of_these', nonePct: r.nonePct })
}
const noneDetected = absentRes.filter((r) => r.noneTop).length
results.absent = {
  n: absentRes.length,
  noneTopRate: fmtCI(noneDetected, absentRes.length),
  avgNonePct: mean(absentRes.map((r) => r.nonePct)),
  detail: absentRes,
}
console.log(`absent targets: none-of-these on top in ${noneDetected}/${absentRes.length}; avg nonePct ${(mean(absentRes.map((r) => r.nonePct)) * 100).toFixed(1)}%`)

// Ghost scenarios (stage 5)
const ghostRes: Array<{ ok: boolean; outcome: string; prob: number }> = []
for (const q of testGhost) {
  const r = await v2Run(q, 5)
  ghostRes.push({ ok: r.outcome === 'out_of_scope_deleted', outcome: r.outcome, prob: r.nonePct })
}
results.ghost = {
  n: ghostRes.length,
  existenceRate: fmtCI(ghostRes.filter((g) => g.ok).length, ghostRes.length),
  detail: ghostRes,
}
console.log(`ghost scenarios: existence statement in ${ghostRes.filter((g) => g.ok).length}/${ghostRes.length}`)

// By-style breakdown (stage 5)
const styleTable: Record<string, RankResult> = {}
for (const [style, { ranks }] of Object.entries(byStyle)) styleTable[style] = rankMetrics(ranks)
results.byStyle = styleTable

// Calibration table (stage 5 top-1 confidence vs observed accuracy)
const bins: Array<{ lo: number; hi: number; n: number; conf: number; acc: number }> = []
for (let b = 0; b < 10; b++) {
  const lo = b / 10
  const hi = (b + 1) / 10
  const at = top1cal.filter((t) => t.conf >= lo && t.conf < hi + (b === 9 ? 0.001 : 0))
  bins.push({ lo, hi, n: at.length, conf: mean(at.map((t) => t.conf)), acc: at.length ? at.filter((t) => t.correct).length / at.length : 0 })
}
let ece = 0
for (const b of bins) if (b.n) ece += (b.n / top1cal.length) * Math.abs(b.acc - b.conf)
results.calibration = { bins, ece, highCutoff: CALIBRATION.highCutoff, mediumCutoff: CALIBRATION.mediumCutoff }
console.log('ECE:', ece.toFixed(4))

results.latency = {
  note: 'Node-side eval: embedding cache warm; browser-side production latency reported separately',
  embedMsP50: percentile(embedMss, 0.5),
  embedMsP95: percentile(embedMss, 0.95),
  interpretMsAvg: mean(interpretMssAll),
}

results.meta = {
  queries: queries.length,
  testQueries: test.length,
  librarySize: INDEX.count,
  searchableSize: ENTRIES.length,
  heldout: INDEX.count - ENTRIES.length,
  useLlm: USE_LLM,
  llmUsed,
  llmTried,
  calibration: CALIBRATION,
}

saveEmbedCache()
writeFileSync('./eval/results.json', JSON.stringify(results, null, 2))
console.log('results written to eval/results.json')

// embedded tracking vars
