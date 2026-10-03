import { NextResponse } from 'next/server'
import { ENTRIES, INDEX, PERSONA } from '@/lib/engine2/index-loader'
import { makeRetriever } from '@/lib/engine2/retrieve2'
import { interpretCue, llmStatus } from '@/lib/engine2/interpreter'
import { CALIBRATION } from '@/lib/engine2/calibration'
import type { QueryText } from '@/lib/engine2/types'

// POST /api/retrieve (v2). Two stateless phases:
//   phase 1 {cue}: runs the interpreter (LLM with a 4 s hard timeout, or the
//     deterministic parser when the model is unavailable) and returns the
//     interpretation. The client runs its text embedding in parallel.
//   phase 2 {cue, texts, interpretation}: scores the library on the supplied
//     embeddings and returns the full calibrated response.
// The API never embeds text itself; the query encoder lives in the browser
// (Web Worker) so no model weight ships inside the serverless function.

const retrieve = makeRetriever(ENTRIES, { indexHash: INDEX.indexHash, modelId: INDEX.modelId })

function validEmbedding(v: unknown): v is number[] {
  if (!Array.isArray(v) || v.length !== 512) return false
  let norm = 0
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return false
    norm += x * x
  }
  return norm > 0.5 && norm < 1.6
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cue?: string
      texts?: unknown
      interpretation?: unknown
      clarifyAnswer?: string | null
      clarifyUsed?: boolean
    }
    const cue = typeof body.cue === 'string' ? body.cue.trim() : ''
    if (!cue) return NextResponse.json({ error: 'Describe the memory first, even fragments are enough.' }, { status: 400 })
    if (cue.length > 600) return NextResponse.json({ error: 'That memory is longer than 600 characters. Trim it a little.' }, { status: 400 })

    // ── phase 1: interpretation ─────────────────────────────────────────────
    if (!Array.isArray(body.texts)) {
      const interpretation = await interpretCue(cue, PERSONA)
      return NextResponse.json({
        phase: 'interpretation',
        interpretation,
        engine: { modelId: INDEX.modelId, indexHash: INDEX.indexHash, librarySize: INDEX.count, calibrationVersion: CALIBRATION.version },
        interpreterConfigured: llmStatus(),
      })
    }

    // ── phase 2: scoring ────────────────────────────────────────────────────
    const rawTexts = body.texts as Array<{ role?: unknown; text?: unknown; embedding?: unknown }>
    const texts: QueryText[] = []
    for (const t of rawTexts) {
      if (typeof t?.text !== 'string' || !validEmbedding(t?.embedding)) continue
      const emb = (t.embedding as number[]).map((x) => Math.round(x * 1000000) / 1000000)
      texts.push({ role: t.role === 'rewrite' ? 'rewrite' : 'raw', text: t.text.slice(0, 300), embedding: emb })
    }
    if (!texts.length) {
      return NextResponse.json({ error: 'No usable query embedding arrived. Reload the page so the search model can load.' }, { status: 400 })
    }
    if (texts.length > 4) return NextResponse.json({ error: 'Too many text variants.' }, { status: 400 })

    const interpretation = (body.interpretation && typeof body.interpretation === 'object')
      ? (body.interpretation as Awaited<ReturnType<typeof interpretCue>>)
      : await interpretCue(cue, PERSONA)

    const started = Date.now()
    const result = retrieve({
      cue,
      interpretation,
      texts,
      clarifyAnswer: typeof body.clarifyAnswer === 'string' ? body.clarifyAnswer : null,
      clarifyUsed: body.clarifyUsed === true,
      interpretMs: typeof interpretation.llmMs === 'number' ? interpretation.llmMs : 0,
      scoreMs: Date.now() - started,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('retrieve v2 failed:', err)
    return NextResponse.json({ error: 'The retrieval workflow hit an unexpected error. Nothing was lost, try again.' }, { status: 500 })
  }
}
