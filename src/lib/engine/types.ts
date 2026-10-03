// ── Cue-first retrieval prototype: shared types ──────────────────────────────
// Every type here maps to a stage of the four-move workflow described in the
// problem definition (docs/part3/problem-definition.md):
//   Move 1 accept memory's format      → CueParse
//   Move 2 translate + run hypotheses  → Hypothesis / PassTrace
//   Move 3 escalate, clarify once      → Decision 'clarify'
//   Move 4 explain every outcome       → Decision + reasons[] on every result

export type Setting =
  | 'water'
  | 'beach'
  | 'mountains'
  | 'home'
  | 'city'
  | 'campus'
  | 'indoor'
  | 'outdoor'

export type Origin = 'camera' | 'screenshot'

export interface Photo {
  /** Camera-roll style filename, e.g. IMG_20250611_1843. */
  id: string
  /** Public path under /photos. */
  src: string
  /** ISO date the photo was taken. */
  date: string
  /** Album label shown in the library grid. */
  album: string
  /** Life-event cluster used by the event-anchor hypothesis. */
  events: string[]
  /** Content tags matched by the content layer. */
  tags: string[]
  /** Dominant memory-visible colors (clothing, objects, scenery). */
  colors: string[]
  setting: Setting
  people: number
  timeOfDay: 'day' | 'sunset' | 'night'
  origin: Origin
  width: number
  height: number
  /** Present only for deleted ghosts: the library remembers they existed. */
  deleted?: { on: string; note: string }
}

// ── Move 1: the parse of a memory dump ───────────────────────────────────────

export type TimeHint =
  | { kind: 'absolute'; months: number[]; years: number[]; raw: string }
  | { kind: 'season'; months: number[]; years: number[]; raw: string }
  | { kind: 'anchor'; anchor: string; raw: string }
  | { kind: 'vague'; raw: string }

export interface CueParse {
  raw: string
  timeHints: TimeHint[]
  events: string[]
  tags: string[]
  colors: string[]
  settings: Setting[]
  people: { min?: number; group: 'friends' | 'family' | 'any' }
  scopeHints: Array<'chat' | 'forwarded'>
  /** Research-grounded confidence flags raised during parsing. */
  flags: Array<'confident-date' | 'time-only' | 'visual-not-verbalizable' | 'scope-maybe-outside'>
}

// ── Move 2: parallel hypotheses ──────────────────────────────────────────────

export interface Hypothesis {
  id: string
  label: string
  rationale: string
  /** Candidate [year, month] windows. Empty = ignore time, content only. */
  windows: Array<{ years: number[]; months: number[]; label: string }>
  /** Whether color evidence is required, preferred, or ignored. */
  colorMode: 'require' | 'prefer' | 'ignore'
  eventFilter: string[]
  tags: string[]
  settings: Setting[]
  peopleMin?: number
  /** Escalation pass: penalties for color/setting/window misses are halved. */
  relaxed?: boolean
}

export interface PassTrace {
  pass: 1 | 2
  note: string
  relaxed: string[]
  runs: Array<{
    hypothesisId: string
    label: string
    windowsScanned: string[]
    hits: number
    topIds: string[]
  }>
}

// ── Move 4: explained outcomes ───────────────────────────────────────────────

export interface Evidence {
  /** Short human-readable reason, shown under a result photo. */
  text: string
  hypothesisId: string
  weight: number
}

export interface ScoredPhoto {
  photo: Photo
  score: number
  /** Best hypothesis that produced this score. */
  via: string
  evidence: Evidence[]
  /** True when the date the user guessed differs from the photo date. */
  dateRecovered?: { guessed: string; actual: string }
}

export type DecisionKind =
  | 'found'
  | 'clarify'
  | 'not_found'
  | 'out_of_scope_deleted'
  | 'out_of_scope_chat'

export interface ClarifyPrompt {
  question: string
  options: Array<{ id: string; label: string; cluster: string }>
  evidenceNote: string
}

export interface Decision {
  kind: DecisionKind
  headline: string
  /** The explanation paragraph. Always present: no outcome is silent. */
  explanation: string
  results: ScoredPhoto[]
  closest?: ScoredPhoto[]
  clarify?: ClarifyPrompt
  /** Research grounding shown alongside the outcome. */
  groundedIn?: string
}

export interface RetrievalMetrics {
  photosScanned: number
  hypothesesRun: number
  passes: number
  clarificationsUsed: 0 | 1
  elapsedMs: number
}

export interface RetrievalResult {
  parse: CueParse
  parseNotes: string[]
  hypotheses: Hypothesis[]
  passes: PassTrace[]
  decision: Decision
  /** Full living-photo ranking, for evaluation harnesses. Unused by the UI. */
  ranking?: Array<{ id: string; score: number }>
  metrics: RetrievalMetrics
  /** Which stage parsed the cue: the language-model parser or its deterministic fallback. Set by the API layer. */
  parser?: 'neural' | 'deterministic'
  /** Time the first-stage parse took, in milliseconds. Present only for the neural path. */
  parseMs?: number
}

export interface ClarifyRequest {
  cue: string
  optionId: string
  /** The parse captured from the original retrieve call keeps runs stable. */
  parse: CueParse
}
