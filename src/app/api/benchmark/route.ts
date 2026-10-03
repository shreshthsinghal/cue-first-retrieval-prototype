import { NextResponse } from 'next/server'
import results from '../../../../data/eval-results.json'

// GET /api/benchmark: the v2 evaluation numbers. Produced by eval/run-eval.ts
// (a re-runnable script); the tab renders them verbatim, nothing is typed in.

export async function GET() {
  return NextResponse.json(results)
}
