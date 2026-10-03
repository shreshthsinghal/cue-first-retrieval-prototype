import { NextResponse } from 'next/server'
import { INDEX, PERSONA } from '@/lib/engine2/index-loader'
import manifestData from '../../../../data/library-manifest.json'
import { HELDOUT_IDS } from '@/lib/engine2/heldout'

// GET /api/index: the searchable index (held-out photos excluded), the persona
// profile and the full manifest for the Library tab. Read-only, stateless.
// The browser uses this for provisional content-only ranking and for browsing.

export async function GET() {
  return NextResponse.json({
    modelId: INDEX.modelId,
    indexHash: INDEX.indexHash,
    dtype: INDEX.dtype,
    entries: INDEX.entries.filter((e) => !HELDOUT_IDS.has(e.id)),
    persona: PERSONA,
    manifest: manifestData,
    heldoutCount: HELDOUT_IDS.size,
  })
}
