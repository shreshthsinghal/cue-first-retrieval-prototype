// Debug the three eval anomalies.
import { readFileSync } from 'fs'
import { ENTRIES, PERSONA } from '../src/lib/engine2/index-loader'
import { parseTime, matchEventAnchor } from '../src/lib/engine2/time-parse'
import { loadQueries, makeSplits, embedText } from '../eval/lib/common'
import { scoreAll } from '../src/lib/engine2/score'
import { CALIBRATION } from '../src/lib/engine2/calibration'

const queries = loadQueries()
const splits = makeSplits(queries)
const testAbsent = queries.filter((q) => !q.present && splits.splitOf(q) === 'test')
const testPresent = queries.filter((q) => q.present && splits.splitOf(q) === 'test' && q.expect !== 'ghost')

// 1. S2 time parsing on test present queries
console.log('── time parsing on test present queries ──')
for (const q of testPresent.slice(0, 10)) {
  const est = parseTime(q.text, PERSONA)
  const anchor = matchEventAnchor(q.text, PERSONA)
  console.log(`${q.id} time=${est.center ?? 'null'}(${est.kind}) anchor=${anchor?.key ?? 'null'} :: ${q.text.slice(0, 60)}`)
}

// 2. z-scores: present vs absent
console.log('\n── top z: present vs absent ──')
async function topZ(text: string): Promise<number> {
  const emb = await embedText(text)
  const cos = ENTRIES.map((e) => e.emb.reduce((s, x, i) => s + x * emb[i], 0))
  const mean = cos.reduce((s, x) => s + x, 0) / ENTRIES.length
  const std = Math.sqrt(cos.reduce((s, x) => s + x * x, 0) / ENTRIES.length - mean * mean) || 1e-6
  return Math.max(...cos.map((x) => (x - mean) / std))
}
const presZ: number[] = []
for (const q of testPresent) presZ.push(await topZ(q.text))
const absZ: number[] = []
for (const q of testAbsent) absZ.push(await topZ(q.text))
console.log('present top-z:', presZ.map((z) => z.toFixed(2)).join(' '))
console.log('absent  top-z:', absZ.map((z) => z.toFixed(2)).join(' '))

// 3. nonePct mechanics for one absent query
console.log('\n── absent queries detail ──')
for (const q of testAbsent) {
  const emb = await embedText(q.text)
  const { nonePct, scored } = scoreAll(ENTRIES, { texts: [{ role: 'raw', text: q.text, embedding: emb }], time: { center: null, spreadDays: 0, confident: false, source: 'none', kind: 'none' }, eventAnchor: null, clarifyAnswer: null })
  const top = [...scored].sort((a, b) => b.prob - a.prob)[0]
  console.log(`${q.id} nonePct=${(nonePct * 100).toFixed(1)}% top=${top.entry.id} prob=${(top.prob * 100).toFixed(1)}% z=${top.contentZ.toFixed(2)} :: ${q.text.slice(0, 55)}`)
}
