import { NextResponse } from 'next/server'
import { ENTRIES, INDEX, PERSONA } from '@/lib/engine2/index-loader'
import { llmStatus } from '@/lib/engine2/interpreter'
import { CALIBRATION } from '@/lib/engine2/calibration'

// GET /api/health: what the engine is, what it loaded, which interpreter is
// configured. No personal data, no state.

export async function GET() {
  const status = llmStatus()
  return NextResponse.json({
    engine: 'cue-first-v2/2.0',
    index: {
      hash: INDEX.indexHash,
      modelId: INDEX.modelId,
      dtype: INDEX.dtype,
      librarySize: INDEX.count,
      living: INDEX.count - ENTRIES.filter((e) => e.deleted).length,
      deletedGhosts: ENTRIES.filter((e) => e.deleted).length,
      screenshots: ENTRIES.filter((e) => e.source === 'screenshot').length,
    },
    persona: { name: PERSONA.name, referenceNow: PERSONA.referenceNow },
    interpreter: {
      configured: status.configured || status.provider === 'z-ai-sdk',
      provider: status.provider,
      timeoutMs: 4000,
    },
    calibration: {
      version: CALIBRATION.version,
      fittedOn: CALIBRATION.fittedOn,
      params: {
        a: CALIBRATION.a, pi: CALIBRATION.pi, T: CALIBRATION.T,
        noneLogit: CALIBRATION.noneLogit, clarifyBonus: CALIBRATION.clarifyBonus,
        highCutoff: CALIBRATION.highCutoff, mediumCutoff: CALIBRATION.mediumCutoff,
        clarifyGap: CALIBRATION.clarifyGap,
      },
    },
  })
}
