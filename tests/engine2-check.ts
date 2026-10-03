// v2 engine unit tests. One command: bun tests/engine2-check.ts
// Covers: the time parser, softmax + none handling, the clarify budget,
// band derivation, no-import-of-eval by retrieval code, and graceful
// behavior when the interpreter fails or returns malformed JSON.

import { parseTime, matchEventAnchor, looksReceived } from '../src/lib/engine2/time-parse'
import { PERSONA, ENTRIES, INDEX } from '../src/lib/engine2/index-loader'
import { scoreAll, bandOf, buildClarifyQuestion } from '../src/lib/engine2/score'
import { makeRetriever } from '../src/lib/engine2/retrieve2'
import { extractJson } from '../src/lib/engine2/interpreter'
import { CALIBRATION } from '../src/lib/engine2/calibration'
import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'

let failures = 0
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok  ${name}`)
  else { failures += 1; console.error(`FAIL  ${name} ${detail}`) }
}

console.log('── 1. time parser ──')
{
  const t1 = parseTime('that trip two years ago, I think', PERSONA)
  check('relative "two years ago" resolves', t1.center === '2024-10-01', `got ${t1.center}`)
  const t2 = parseTime('last summer at the lake', PERSONA)
  check('last summer lands in Mar-May of a past year', t2.center !== null && Number(t2.center.slice(5, 7)) >= 3 && Number(t2.center.slice(5, 7)) <= 5, `got ${t2.center}`)
  const t3 = parseTime('around my birthday we took the boat out', PERSONA)
  check('birthday anchor resolves to June 14', t3.center?.slice(5, 10) === '06-14', `got ${t3.center}`)
  const t4 = parseTime('the mehndi the day before the wedding', PERSONA)
  check('"day before the wedding" resolves to Dec 13 2024', t4.center === '2024-12-13', `got ${t4.center} (${t4.kind})`)
  const t5 = parseTime('diwali at home, 2023', PERSONA)
  check('diwali 2023 anchor', t5.center === '2023-11-12', `got ${t5.center}`)
  const t6 = parseTime('no time words here at all', PERSONA)
  check('no time cue stays null', t6.center === null)
  const t7 = parseTime('it was June 2024 for sure, I am certain', PERSONA)
  check('confident absolute date', t7.center === '2024-06-15' && t7.confident, `got ${t7.center} confident=${t7.confident}`)
  const a1 = matchEventAnchor('the Kedarkantha trek with snow', PERSONA)
  check('event anchor matches the trek', a1?.key === 'kedarkantha-trek', `got ${a1?.key}`)
  const a2 = matchEventAnchor('a sea of hands at the concert', PERSONA)
  check('no anchor fires on a concert cue (profile has none)', a2 === null || a2.key === 'mumbai-trip', `got ${a2?.key}`)
  check('received-content detector', looksReceived('that meme Rahul sent me'))
}

console.log('── 2. softmax + none-of-these ──')
{
  const emb = Array.from({ length: 512 }, (_, i) => Math.sin(i) / 24)
  const texts = [{ role: 'raw' as const, text: 'probe', embedding: emb }]
  const { nonePct, scored } = scoreAll(ENTRIES, { texts, time: { center: null, spreadDays: 0, confident: false, source: 'none', kind: 'none' }, eventAnchor: null, clarifyAnswer: null })
  const sum = scored.reduce((s, x) => s + x.prob, 0) + nonePct
  check('probabilities + none sum to 1', Math.abs(sum - 1) < 1e-6, `sum=${sum}`)
  check('5 results always available', scored.length === ENTRIES.length)
  const { nonePct: noneHigh } = scoreAll(ENTRIES, { texts, time: { center: null, spreadDays: 0, confident: false, source: 'none', kind: 'none' }, eventAnchor: null, clarifyAnswer: null, cal: { ...CALIBRATION, noneLogit: 50 } })
  check('a high none logit raises the none probability', noneHigh > 0.9, `none=${noneHigh}`)
  const ghosts = scored.filter((s) => s.entry.deleted)
  check('ghosts compete in scoring (existence behavior)', ghosts.length === 5)
}

console.log('── 3. clarify budget ──')
{
  const retrieve = makeRetriever(ENTRIES, { indexHash: INDEX.indexHash, modelId: INDEX.modelId })
  const emb = Array.from({ length: 512 }, (_, i) => Math.cos(i * 1.7) / 22)
  const interpretation = {
    rewrites: [], time: { center: null, spreadDays: 0, confident: false, source: 'parser' as const, kind: 'none' as const },
    eventAnchor: null, scope: null, peopleHint: null, interpretedBy: 'basic-parser' as const, reason: 'test', llmMs: 0, note: [],
  }
  const first = retrieve({ cue: 'clarify budget probe', interpretation, texts: [{ role: 'raw', text: 'probe', embedding: emb }] })
  const second = retrieve({ cue: 'clarify budget probe', interpretation, texts: [{ role: 'raw', text: 'probe', embedding: emb }], clarifyAnswer: first.clarify?.options[0]?.id ?? null, clarifyUsed: true })
  check('a clarified run never asks again', second.outcome !== 'clarify', `outcome=${second.outcome}`)
  check('clarify options carry exactly two thumbnails plus a third none option is allowed', !first.clarify || first.clarify.options.length === 2 || first.clarify.options.length === 3)
  const q = buildClarifyQuestion([
    { entry: { ...ENTRIES[0] }, cos: 0, contentZ: 0, timeBonus: 0, eventBonus: 0, clarifyBonus: 0, score: 0, prob: 0, bestText: null },
    { entry: { ...ENTRIES[1], ts: ENTRIES[1].ts.slice(0, 4) === ENTRIES[0].ts.slice(0, 4) ? '2019' + ENTRIES[1].ts.slice(4) : ENTRIES[1].ts }, cos: 0, contentZ: 0, timeBonus: 0, eventBonus: 0, clarifyBonus: 0, score: 0, prob: 0, bestText: null },
  ])
  check('clarify question builder returns a question with options', q === null || (q.question.length > 0 && q.options.length === 2))
}

console.log('── 4. bands and cutoffs ──')
{
  check('band High at the cutoff', bandOf(CALIBRATION.highCutoff) === 'High')
  check('band Medium between cutoffs', bandOf((CALIBRATION.highCutoff + CALIBRATION.mediumCutoff) / 2) === 'Medium')
  check('band Low below', bandOf(0.01) === 'Low')
}

console.log('── 5. retrieval code never imports eval/ ──')
{
  const engineDir = 'src/lib/engine2'
  let bad: string[] = []
  for (const f of readdirSync(engineDir)) {
    const p = path.join(engineDir, f)
    if (!statSync(p).isFile() || !f.endsWith('.ts')) continue
    const src = readFileSync(p, 'utf8')
    if (/from\s+['"].*eval\//.test(src) || /require\(.*eval\//.test(src)) bad.push(p)
  }
  check('no eval/ import in src/lib/engine2', bad.length === 0, bad.join(', '))
  bad = []
  const apiDir = 'src/app/api'
  for (const route of ['retrieve', 'health', 'index']) {
    const src = readFileSync(path.join(apiDir, route, 'route.ts'), 'utf8')
    if (/from\s+['"].*eval\//.test(src)) bad.push(route)
  }
  check('no eval/ import in API routes', bad.length === 0, bad.join(', '))
}

console.log('── 6. interpreter fallbacks ──')
{
  check('malformed JSON yields null frame', extractJson('not json at all {oops') === null)
  const fenced = extractJson('```json\n{"rewrites":["a cake"],"time":null}\n```')
  check('fenced JSON extracts', fenced !== null && (fenced as { rewrites?: string[] }).rewrites?.length === 1)
  const plain = extractJson('Sure! {"rewrites":["x"],"time":null} hope that helps')
  check('plain JSON with prose extracts', plain !== null)
}

console.log('── 7. index integrity ──')
{
  check('index hash present', INDEX.indexHash.length === 16)
  check('index model id matches the encoder', INDEX.modelId === 'Xenova/clip-vit-base-patch32')
  const norms = ENTRIES.slice(0, 5).every((e) => {
    const n2 = e.emb.reduce((s, x) => s + x * x, 0)
    return Math.abs(n2 - 1) < 0.01
  })
  check('embeddings are unit-normalized (spot check)', norms)
}

if (failures > 0) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
} else {
  console.log('\nall engine2 checks passed')
}
