// Engine verification: replay every benchmark case and assert the expected
// outcome kinds. Run: bun tests/engine-check.ts
import { BENCHMARK_CASES, runCase, classicSearch } from '../src/lib/engine/benchmark'
import { PHOTOS, DELETED_PHOTOS } from '../src/lib/engine/library'

let failures = 0

console.log(`Library: ${PHOTOS.length} items (${DELETED_PHOTOS.length} deleted ghosts)\n`)

for (const c of BENCHMARK_CASES) {
  const out = runCase(c)
  const ok = out.ok
  if (!ok) failures += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${c.id.padEnd(12)} expect=${c.expect.padEnd(20)} got=${out.final.decision.kind.padEnd(20)} top=${out.final.decision.results[0]?.photo.id ?? '-'} classic=${out.classic.count} hit(s)`,
  )
  if (!ok) {
    console.log('      decision explanation:', out.final.decision.explanation.slice(0, 220))
    console.log('      passes:', JSON.stringify(out.final.passes.map((p) => ({ pass: p.pass, runs: p.runs.map((r) => `${r.hypothesisId}:${r.hits}`) }))))
  }
}

// Stability check: same input, same output (determinism).
const a = runCase(BENCHMARK_CASES[3])
const b = runCase(BENCHMARK_CASES[3])
const stable =
  a.final.decision.kind === b.final.decision.kind &&
  a.final.decision.results[0]?.photo.id === b.final.decision.results[0]?.photo.id
console.log(`\n${stable ? 'PASS' : 'FAIL'}  determinism (same cue twice → same outcome)`)
if (!stable) failures += 1

// The known-item case must be a fast path: one pass, no clarification.
const known = runCase(BENCHMARK_CASES.find((c) => c.id === 'known-item')!)
const fast = known.final.metrics.passes === 1 && known.final.metrics.clarificationsUsed === 0
console.log(`${fast ? 'PASS' : 'FAIL'}  fast path (known-item: 1 pass, 0 clarifications)`)
if (!fast) failures += 1

// Clarification budget: no case may ask more than once.
const clarifyBudget = BENCHMARK_CASES.every((c) => runCase(c).final.metrics.clarificationsUsed <= 1)
console.log(`${clarifyBudget ? 'PASS' : 'FAIL'}  clarification budget (max 1 per case)`)
if (!clarifyBudget) failures += 1

// Classic search sanity: unicorn finds nothing, short literal query works.
const uni = classicSearch('Me riding a unicorn on the beach.')
const grad = classicSearch("Graduation. Cap and gown. That's it.")
const classicOk = uni.count === 0 && grad.count > 0
console.log(`${classicOk ? 'PASS' : 'FAIL'}  classic simulator sanity (unicorn 0 hits, graduation >0)`)
if (!classicOk) failures += 1

console.log(failures === 0 ? '\nALL ENGINE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
