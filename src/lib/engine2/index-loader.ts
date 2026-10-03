// Loads the static image index + persona profile. The index file carries the
// model id and a hash so the index and the query encoder cannot silently
// mismatch. Retrieval code reads NOTHING from eval/: a unit test enforces it.

import indexData from '../../../data/image-index.json'
import manifestData from '../../../data/library-manifest.json'
import { HELDOUT_IDS } from './heldout'
import type { ImageIndex, PersonaProfile } from './types'

export const INDEX = indexData as unknown as ImageIndex
export const PERSONA = manifestData.persona as PersonaProfile

// The held-out 15% are excluded from the search index entirely: they exist in
// the Library tab, but are never search results.
export const ENTRIES = INDEX.entries.filter((e) => !HELDOUT_IDS.has(e.id))
export const LIVING = ENTRIES.filter((e) => !e.deleted)
