import { NextResponse } from 'next/server'
import { retrieve } from '@/lib/engine/retrieve'
import type { RetrieveOptions } from '@/lib/engine/retrieve'

// POST /api/retrieve — the retrieval workflow as a service endpoint.
// Stateless and deterministic: the same cue always yields the same run.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cue?: string; clarify?: RetrieveOptions['clarify'] }
    const cue = typeof body.cue === 'string' ? body.cue : ''
    if (!cue.trim()) {
      return NextResponse.json({ error: 'Describe the memory first — even fragments are enough.' }, { status: 400 })
    }
    if (cue.length > 600) {
      return NextResponse.json({ error: 'That memory is longer than 600 characters. Trim it a little.' }, { status: 400 })
    }
    const result = retrieve(cue, body.clarify ? { clarify: body.clarify } : undefined)
    return NextResponse.json(result)
  } catch (err) {
    console.error('retrieve failed:', err)
    return NextResponse.json({ error: 'The retrieval workflow hit an unexpected error. Nothing was lost, try again.' }, { status: 500 })
  }
}
