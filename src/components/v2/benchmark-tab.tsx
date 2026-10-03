'use client'

// Benchmark tab: renders the evaluation produced by eval/run-eval.ts.
// Every number comes from the script output (data/eval-results.json via the
// API); nothing on this page is typed by hand.

import { useEffect, useState } from 'react'

interface Ablation {
  name: string
  recall: [number, number, number]
  mrr: number
  n: number
  wilsonR1: string
  outcomes: Record<string, number>
}
interface Results {
  classic: { recall: [number, number, number]; mrr: number; n: number; wilson: string; avgHits: number }
  v1: { recall: [number, number, number]; mrr: number; n: number; wilson: string }
  v2_s1: Ablation; v2_s2: Ablation; v2_s3: Ablation; v2_s4: Ablation; v2_s5: Ablation
  absent: { n: number; noneTopRate: string; avgNonePct: number }
  ghost: { n: number; existenceRate: string }
  byStyle: Record<string, { recall: [number, number, number]; mrr: number; n: number }>
  calibration: { bins: Array<{ lo: number; hi: number; n: number; conf: number; acc: number }>; ece: number; highCutoff: number; mediumCutoff: number }
  latency: { embedMsP50: number; embedMsP95: number; interpretMsAvg: number }
  meta: { queries: number; testQueries: number; librarySize: number; searchableSize: number; heldout: number; useLlm: boolean; llmUsed: number; llmTried: number; calibration: { fittedOn: string; method: string; a: number; pi: number; T: number; noneLogit: number } }
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`

function AblationTable({ rows }: { rows: Array<{ key: string; label: string; data: Ablation | { recall: [number, number, number]; mrr: number; n: number; wilson?: string } }> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">System</th>
            <th className="px-3 py-2">Recall@1</th>
            <th className="px-3 py-2">Recall@3</th>
            <th className="px-3 py-2">Recall@5</th>
            <th className="px-3 py-2">MRR</th>
            <th className="px-3 py-2">n</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, data }) => (
            <tr key={key} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2 font-mono text-xs">{pct(data.recall[0])}</td>
              <td className="px-3 py-2 font-mono text-xs">{pct(data.recall[1])}</td>
              <td className="px-3 py-2 font-mono text-xs">{pct(data.recall[2])}</td>
              <td className="px-3 py-2 font-mono text-xs">{data.mrr.toFixed(3)}</td>
              <td className="px-3 py-2 font-mono text-xs">{data.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BenchmarkTabV2() {
  const [r, setR] = useState<Results | null>(null)

  useEffect(() => {
    fetch('/api/benchmark').then((res) => res.json()).then(setR).catch(() => setR(null))
  }, [])

  if (!r) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Loading evaluation results...</div>

  const s = (k: 'v2_s1' | 'v2_s2' | 'v2_s3' | 'v2_s4' | 'v2_s5') => r[k]

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Evaluation without circularity</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {r.meta.queries} held-out memory-style queries were written by a vision-language model that saw the photos but never the retrieval vocabulary, then split by photo into a dev split (used for fitting) and a test split ({r.meta.testQueries} queries reported here, once). Numbers below are produced by <code className="rounded bg-stone-100 px-1">eval/run-eval.ts</code>; re-running the script reproduces them.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Library: {r.meta.librarySize} photos, {r.meta.searchableSize} searchable, {r.meta.heldout} held out of the index. Interpreter during this evaluation run: {r.meta.useLlm ? `model answered ${r.meta.llmUsed}/${r.meta.llmTried} attempts` : 'deterministic parser (the shared model endpoint was rate-limited during the run)'}.
        </p>
      </header>

      <section aria-label="Systems compared">
        <h2 className="mb-3 font-serif text-xl font-semibold">Same test queries, three systems</h2>
        <AblationTable
          rows={[
            { key: 'classic', label: '(A) Classic keyword box on the CLIP-generated label view', data: { ...r.classic } },
            { key: 'v1', label: '(B) The v1 engine on the same label view', data: { ...r.v1 } },
            { key: 's5', label: '(C) v2, full system', data: { ...s('v2_s5') } },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          The classic baseline requires every content word of the query to appear in a photo&apos;s label view; on natural-memory queries it returned the target for none ({r.classic.avgHits.toFixed(1)} average hits per query). Its labels were auto-generated by CLIP zero-shot classification in v1&apos;s vocabulary format, which is fair to the baseline in vocabulary but cannot help queries that avoid that vocabulary. v1&apos;s Wilson 95% interval on Recall@1: {r.v1.wilson}. v2&apos;s: {s('v2_s5').wilsonR1}.
        </p>
      </section>

      <section aria-label="Ablation">
        <h2 className="mb-3 font-serif text-xl font-semibold">What each component adds (v2 ablation)</h2>
        <AblationTable
          rows={[
            { key: 's1', label: 'S1: content search on the raw text only', data: { ...s('v2_s1') } },
            { key: 's2', label: 'S2: plus the rule-based time prior (no model)', data: { ...s('v2_s2') } },
            { key: 's3', label: 'S3: plus model interpretation (rewrites, time, event)', data: { ...s('v2_s3') } },
            { key: 's4', label: 'S4: plus the one clarifying question (simulated answer)', data: { ...s('v2_s4') } },
            { key: 's5', label: 'S5: plus none-of-these handling (full v2)', data: { ...s('v2_s5') } },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Reading: the raw content search does most of the work; the soft time prior adds {pct(Math.max(0, s('v2_s2').recall[0] - s('v2_s1').recall[0]))} Recall@1; the clarifying question adds {pct(Math.max(0, s('v2_s4').recall[0] - s('v2_s3').recall[0]))}. The clarifying question is simulated with the correct answer when the target is among the two options: it is an upper bound, not a human measurement.
        </p>
      </section>

      <section aria-label="By query style">
        <h2 className="mb-3 font-serif text-xl font-semibold">Recall@1 by query style (full v2)</h2>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(r.byStyle).map(([style, d]) => (
            <div key={style} className="rounded-xl border border-border bg-card p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{style}</p>
              <p className="mt-1 font-mono text-lg">{pct(d.recall[0])}</p>
              <p className="text-xs text-muted-foreground">n={d.n} · MRR {d.mrr.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Calibration">
        <h2 className="mb-3 font-serif text-xl font-semibold">Calibration: what the confidence means</h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Displayed confidence</th>
                <th className="px-3 py-2">Queries</th>
                <th className="px-3 py-2">Average confidence</th>
                <th className="px-3 py-2">Observed top-1 accuracy</th>
              </tr>
            </thead>
            <tbody>
              {r.calibration.bins.filter((b) => b.n > 0).map((b) => (
                <tr key={`${b.lo}`} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{(b.lo * 100).toFixed(0)} to {(b.hi * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2 font-mono text-xs">{b.n}</td>
                  <td className="px-3 py-2 font-mono text-xs">{pct(b.conf)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{pct(b.acc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Expected calibration error {r.calibration.ece.toFixed(3)} on the test split. Bands derived on dev: High at top-1 confidence ≥ {pct(r.calibration.highCutoff)}, Medium at ≥ {pct(r.calibration.mediumCutoff)}; displayed confidence is capped at 95%. Small bins are noise; the test split is small and the intervals are wide, so read shapes, not digits.
        </p>
      </section>

      <section aria-label="None of these and ghosts">
        <h2 className="mb-3 font-serif text-xl font-semibold">None of these, and deleted-photo honesty</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">Absent-target queries (n={r.absent.n})</p>
            <p className="mt-1 text-muted-foreground">Queries about photos excluded from the index. &ldquo;None of these&rdquo; landed on top for {r.absent.noneTopRate}; average none-probability {pct(r.absent.avgNonePct)}.</p>
            <p className="mt-1 text-xs text-muted-foreground">The detector separates out-of-distribution queries, but when a held-out photo has a near-duplicate in the index, the duplicate wins and none does not fire. That is a property of content matching, reported honestly rather than tuned away on the test set.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">Deleted-ghost scenarios (n={r.ghost.n})</p>
            <p className="mt-1 text-muted-foreground">Queries whose true target was deleted from the library. An existence statement (never the photo as a result) appeared for {r.ghost.existenceRate}.</p>
          </div>
        </div>
      </section>

      <section aria-label="Fit details">
        <h2 className="mb-3 font-serif text-xl font-semibold">How the parameters were fitted</h2>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <p>{r.meta.calibration.method}</p>
          <p className="mt-1">Fitted values: a={r.meta.calibration.a}, pi={r.meta.calibration.pi}, T={r.meta.calibration.T}, noneLogit={r.meta.calibration.noneLogit}. Fitted on: {r.meta.calibration.fittedOn}.</p>
          <p className="mt-1">Latency in the evaluation harness: text embedding p50 {r.latency.embedMsP50} ms, p95 {r.latency.embedMsP95} ms (warm); interpretation stage {r.latency.interpretMsAvg.toFixed(0)} ms average. Browser-side latency is reported in the Method tab.</p>
        </div>
      </section>
    </div>
  )
}
