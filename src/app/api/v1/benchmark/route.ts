import { NextResponse } from 'next/server'
import { BENCHMARK_CASES, runCase } from '@/lib/engine/benchmark'
import type { CaseOutcome } from '@/lib/engine/benchmark'

// GET /api/benchmark: replay every research-grounded cue case through the
// engine and return outcomes plus the classic-search baseline. Deterministic:
// the run is pure and instant, parsed by the deterministic stage so replays
// are reproducible.
export async function GET() {
  try {
    const outcomes: CaseOutcome[] = BENCHMARK_CASES.map(runCase)
    const summary = {
      cases: outcomes.length,
      resolved: outcomes.filter((o) => o.final.decision.kind !== 'not_found').length,
      found: outcomes.filter((o) => o.final.decision.kind === 'found').length,
      outOfScopeExplained: outcomes.filter((o) => o.final.decision.kind.startsWith('out_of_scope')).length,
      honestNotFound: outcomes.filter((o) => o.final.decision.kind === 'not_found').length,
      clarificationsUsed: outcomes.reduce((acc, o) => acc + o.final.metrics.clarificationsUsed, 0),
      classicFound: outcomes.filter((o) => o.classic.count > 0).length,
      classicSilent: outcomes.filter((o) => o.classic.count === 0).length,
    }
    return NextResponse.json({ outcomes, summary })
  } catch (err) {
    console.error('benchmark failed:', err)
    return NextResponse.json({ error: 'Benchmark replay failed unexpectedly.' }, { status: 500 })
  }
}

export async function POST() {
  return GET()
}
