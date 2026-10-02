import { NextResponse } from 'next/server'
import { retrieve } from '@/lib/engine/retrieve'
import type { RetrieveOptions } from '@/lib/engine/retrieve'
import { parseCueLLM, sanitizeFrame } from '@/lib/engine/parse-llm'
import type { CueParse } from '@/lib/engine/types'

// POST /api/retrieve: the retrieval workflow as a service endpoint.
// Stateless. Live cues are interpreted by the language-model parser first
// (parser: 'neural'); the deterministic parser is the fallback and the mode
// the benchmark replays with for reproducibility. A clarify follow-up may
// carry the original parse so both runs stay identical.

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cue?: string
      clarify?: RetrieveOptions['clarify']
      parse?: unknown
      parser?: 'auto' | 'deterministic'
    }
    const cue = typeof body.cue === 'string' ? body.cue : ''
    if (!cue.trim()) {
      return NextResponse.json({ error: 'Describe the memory first, even fragments are enough.' }, { status: 400 })
    }
    if (cue.length > 600) {
      return NextResponse.json({ error: 'That memory is longer than 600 characters. Trim it a little.' }, { status: 400 })
    }

    let parse: CueParse | undefined
    let parserUsed: 'neural' | 'deterministic' = 'deterministic'
    let parseMs: number | undefined

    const carried = body.parse && typeof body.parse === 'object'
      ? sanitizeFrame(body.parse as Record<string, unknown>, cue)
      : null
    if (carried) {
      // Clarify follow-up: reuse the original frame so both runs are identical.
      parse = carried
    } else if (body.parser !== 'deterministic') {
      const llm = await parseCueLLM(cue)
      if (llm) {
        parse = llm.parse
        parserUsed = 'neural'
        parseMs = llm.ms
      }
    }

    const result = retrieve(cue, {
      ...(body.clarify ? { clarify: body.clarify } : {}),
      ...(parse ? { parse } : {}),
    })
    return NextResponse.json({ ...result, parser: parserUsed, ...(parseMs !== undefined ? { parseMs } : {}) })
  } catch (err) {
    console.error('retrieve failed:', err)
    return NextResponse.json({ error: 'The retrieval workflow hit an unexpected error. Nothing was lost, try again.' }, { status: 500 })
  }
}
