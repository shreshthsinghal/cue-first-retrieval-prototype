// Inspect the fit loss landscape over noneLogit for the dev split.
import { ENTRIES, PERSONA } from '../src/lib/engine2/index-loader'
import { parseTime, matchEventAnchor } from '../src/lib/engine2/time-parse'
import { loadQueries, makeSplits, embedText, type EvalQuery } from '../eval/lib/common'

const queries: EvalQuery[] = loadQueries()
const splits = makeSplits(queries)
const dev = queries.filter((q) => splits.splitOf(q) === 'dev')
const entries = ENTRIES
const N = entries.length

const prepared: Array<{ text: string; absent: boolean; target: string }> = []
for (const q of dev) prepared.push({ text: q.text, absent: !q.present, target: q.target })

async function lossFor(a: number, pi: number, T: number, noneLogit: number) {
  const L = Math.log
  let lossPresent = 0, lossAbsent = 0, noneWinsAbsent = 0
  for (const p of prepared) {
    const emb = await embedText(p.text)
    const cos = entries.map((e) => e.emb.reduce((s, x, i) => s + x * emb[i], 0))
    const mean = cos.reduce((s, x) => s + x, 0) / N
    const std = Math.sqrt(cos.reduce((s, x) => s + x * x, 0) / N - mean * mean) || 1e-6
    const z = cos.map((x) => (x - mean) / std)
    const est = parseTime(p.text, PERSONA)
    const anchor = matchEventAnchor(p.text, PERSONA)
    const inWin = (ts: string, c: string, sp: number) => Math.abs(new Date(ts.slice(0, 10) + 'T00:00:00Z').getTime() - new Date(c + 'T00:00:00Z').getTime()) <= sp * 86400000
    const scores = z.map((zv, i) => {
      const tb = est.center && est.spreadDays > 0 ? (inWin(entries[i].ts, est.center, Math.max(1, est.spreadDays)) ? L(pi) : L(1 - pi)) : 0
      const eb = anchor ? (inWin(entries[i].ts, anchor.date, 3) ? L(pi) : L(1 - pi)) : 0
      return a * zv + tb + eb
    })
    const m = Math.max(...scores, noneLogit)
    let denom = Math.exp((noneLogit - m) / T)
    for (const s of scores) denom += Math.exp((s - m) / T)
    const pNone = Math.exp((noneLogit - m) / T) / denom
    if (p.absent) {
      lossAbsent -= Math.log(pNone)
      if (pNone > Math.max(...scores.map((s) => Math.exp((s - m) / T) / denom))) noneWinsAbsent++
    } else {
      const idx = entries.findIndex((e) => e.id === p.target)
      lossPresent -= Math.log(Math.exp((scores[idx] - m) / T) / denom)
    }
  }
  return { lossPresent: lossPresent / (prepared.length - dev.filter((q) => !q.present).length), lossAbsent: lossAbsent / dev.filter((q) => !q.present).length, noneWinsAbsent, total: lossPresent + lossAbsent }
}

for (const noneLogit of [-3, 0, 3, 6, 9, 12, 15, 18]) {
  const r = await lossFor(3, 0.8, 1.3, noneLogit)
  console.log(`noneLogit=${String(noneLogit).padStart(3)} | present ${r.lossPresent.toFixed(3)} | absent ${r.lossAbsent.toFixed(3)} | total ${r.total.toFixed(2)} | noneWinsAbsent ${r.noneWinsAbsent}/8`)
}
