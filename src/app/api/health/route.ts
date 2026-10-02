import { NextResponse } from 'next/server'
import { PHOTO_COUNT, DELETED_PHOTOS } from '@/lib/engine/library'

// GET /api/health — liveness plus library shape, for the status chip.
export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: 'cue-first/1.0',
    library: { items: PHOTO_COUNT, deleted: DELETED_PHOTOS.length },
    time: new Date().toISOString(),
  })
}
