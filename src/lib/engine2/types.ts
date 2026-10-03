// v2 engine types. The v2 engine retrieves by what photos LOOK like
// (CLIP image-text embeddings). Authored text labels are never read.

export interface IndexEntry {
  id: string
  file: string
  ts: string // ISO capture timestamp
  source: 'camera' | 'screenshot'
  deleted: boolean
  emb: number[] // 512-d, L2-normalized
  screenshotProb: number
  indoorProb: number
  peopleProb: number
  hints: string[] // generated explanation chips; never used for matching
  cluster: string // event cluster id, derived from timestamps at index time
  width: number
  height: number
}

export interface ImageIndex {
  version: string
  modelId: string
  dtype: string
  indexHash: string
  count: number
  entries: IndexEntry[]
}

export interface PersonaProfile {
  name: string
  homeCity: string
  birthday: { month: number; day: number }
  referenceNow: string
  importantDates: Array<{ key: string; label: string; date: string }>
}

export interface TimeEstimate {
  center: string | null // YYYY-MM-DD
  spreadDays: number
  confident: boolean
  source: 'llm' | 'parser' | 'none'
  matched?: string // what the parser matched, for the UI
  kind?: 'relative' | 'season' | 'absolute' | 'event' | 'anchor' | 'none'
}

export interface EventAnchor {
  key: string
  label: string
  date: string // YYYY-MM-DD from the persona profile
}

export interface Interpretation {
  rewrites: string[] // 0 to 3 short visual caption rewrites
  time: TimeEstimate
  eventAnchor: EventAnchor | null
  scope: 'own' | 'received' | null
  peopleHint: 'alone' | 'group' | null
}

export type InterpretedBy = 'ai-model' | 'basic-parser'

export interface InterpretResult extends Interpretation {
  interpretedBy: InterpretedBy
  reason: string // why the fallback ran, or 'ok'
  llmMs: number
  note: string[] // user-facing notes (confident date, hard to describe...)
}

export interface QueryText {
  role: 'raw' | 'rewrite'
  text: string
  embedding: number[] // 512-d normalized
}

export interface ScoreComponents {
  contentZ: number
  contentCos: number
  timeBonus: number
  eventBonus: number
  clarifyBonus: number
}

export interface BandedResult {
  id: string
  file: string
  ts: string
  source: 'camera' | 'screenshot'
  deleted: boolean
  thumbnail: string
  probability: number
  band: 'High' | 'Medium' | 'Low'
  scoreComponents: ScoreComponents
  reason: string // one-line, plain English
  hints: string[]
  width: number
  height: number
}

export interface ClarifyQuestion {
  question: string
  attribute: 'year' | 'season' | 'indoor' | 'people' | 'daypart'
  options: Array<{ id: string; label: string; thumbnail: string }>
  note: string
}

export type OutcomeKind =
  | 'found'
  | 'clarify'
  | 'not_found'
  | 'out_of_scope_deleted'
  | 'out_of_scope_chat'
  | 'none_of_these'

export interface SearchTrace {
  indexHash: string
  modelId: string
  librarySize: number
  texts: Array<{ role: string; text: string }>
  timeEstimate: TimeEstimate
  eventAnchor: EventAnchor | null
  contentZMean: number
  contentZStd: number
  clarifyUsed: boolean
  stageMs: { interpret: number; score: number }
  params: Record<string, number>
}

export interface Retrieve2Response {
  outcome: OutcomeKind
  headline: string
  explanation: string
  results: BandedResult[] // always the 5 closest living photos, ordered
  nonePct: number
  interpretation: InterpretResult
  clarify?: ClarifyQuestion | null
  trace: SearchTrace
  existenceStatement?: { ghost: BandedResult; note: string; sameDay: BandedResult[] }
  scopeStatement?: { screenshot: BandedResult; note: string }
  provisional?: boolean
}
