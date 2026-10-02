import { retrieve } from './retrieve'
import type { CueParse, DecisionKind, RetrievalResult } from './types'

// ── Benchmark: replay research-grounded cue cases through the engine ────────
// Cases 1 to 3 mirror the three live think-aloud tasks (P1, P2, P3) from the
// interview study; case 4 embodies insight 2c (confident wrong dates); case 5
// embodies 2d (visual cues that cannot become words); case 6 embodies G1
// (photos living in chat apps); case 7 shows the honest baseline (classic
// search works for known-item lookups); case 8 is the honest-failure case.
//
// The classic column is a simulated exact-match keyword search over the same
// synthetic library: literal token matching against tags, albums and dates,
// which is how the classic Photos search box behaves on content it cannot see.

export interface BenchmarkCase {
  id: string
  title: string
  cue: string
  groundedIn: string
  /** Expected engine outcome after at most one clarification. */
  expect: DecisionKind
  /** Scripted clarification answer (album name), when the engine asks. */
  clarifyAlbum?: string
  classicNote: string
}

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'p1-deleted',
    title: 'P1: confident month, target deleted',
    cue: "It was around April I think... no wait, I'm sure it was April. She was blowing out candles with the water behind her.",
    groundedIn: 'Live task P1: time held with confidence, first query "year", 0 reformulations, outcome: photo deleted.',
    expect: 'out_of_scope_deleted',
    classicNote: 'Keyword search on month and content words: photos carry no searchable words for candles or water, so the box returns nothing and the person never learns the truth.',
  },
  {
    id: 'p2-vague',
    title: 'P2: cannot describe it at all',
    cue: "It was outdoors, some kind of trip I think, maybe a year or two ago, there were mountains too? I can't really describe it, just remember being with friends.",
    groundedIn: 'Live task P2: no cues recorded, first query "date", confused at 120 seconds, 0 reformulations.',
    expect: 'found',
    clarifyAlbum: 'Kedarkantha trek',
    classicNote: 'Typing "date" or "2024" returns hundreds of undifferentiated results at real library scale. P2 switched to album sorting after the search box failed.',
  },
  {
    id: 'p3-water',
    title: 'P3: time-only, near-water',
    cue: 'Last year sometime, daytime, I think there was water somewhere in it.',
    groundedIn: 'Live task P3: time was the only cue, first query "time", gave up rather than reformulate.',
    expect: 'found',
    clarifyAlbum: 'Birthday at the lake',
    classicNote: '"Time" is not a keyword. P3 stated the cause himself: photos do not have exact keywords related to the actual picture.',
  },
  {
    id: 'wrong-date',
    title: 'Confident date, six months off',
    cue: 'June 2024, for sure. It was a beach wedding.',
    groundedIn: 'Insight 2c: dates held with confidence still broke for 2 of 3 participants ("date for sure" was wrong).',
    expect: 'found',
    classicNote: 'Literal date filters miss by exactly the margin memory is wrong about. The classic box has no event anchor to fall back on.',
  },
  {
    id: 'visual-red',
    title: 'Visual cues that were never words',
    cue: 'Around my birthday last summer. She was wearing red. Near the water.',
    groundedIn: 'Insight 2d: visual memory cannot be put into search-box words (2 of 3), while 3 of 3 requested content cues.',
    expect: 'found',
    classicNote: 'The words red, water and birthday never co-occur in any caption or album name. The top result is the red dress by the lake; the red kurta at an indoor dinner loses on setting.',
  },
  {
    id: 'chat-scope',
    title: 'G1: content that lives in chats',
    cue: 'That exam meme Rahul sent me before my birthday.',
    groundedIn: 'G1: "missing" photos exist outside the searched scope; 2 of 3 keep older photos in Snapchat or WhatsApp.',
    expect: 'out_of_scope_chat',
    classicNote: 'The classic box searches the library, fails silently, and the person concludes the photo is "gone". Scope is never questioned.',
  },
  {
    id: 'known-item',
    title: 'Known-item search (the honest baseline)',
    cue: "Graduation. Cap and gown. That's it.",
    groundedIn: 'Honesty check: when memory compresses into literal words, classic search already works. The research never claimed it is useless, only that it fails exactly when memory is vague.',
    expect: 'found',
    classicNote: 'Works fine: the album and tags carry the literal words. The prototype must not be slower for this case either.',
  },
  {
    id: 'unicorn',
    title: 'Honest failure, fully explained',
    cue: 'Me riding a unicorn on the beach.',
    groundedIn: 'Design target: a failed attempt must offer a recovery path. Resigned sentiment appears in 16 corpus items after silent failures.',
    expect: 'not_found',
    classicNote: 'Zero results, no explanation, no next step. This is the state people described as "I gave up".',
  },
]

// ── Classic keyword search simulation ────────────────────────────────────────

const CLASSIC_STOP = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'at', 'my', 'was', 'is', 'it', 'and', 'or', 'with', 'she', 'he', 'i', 'me', 'we', 'us', 'her', 'his', 'there', 'that', 'this', 'for', 'before', 'after', 'around', 'near', 'some', 'just', 'think', 'maybe', 'sometime', 'somewhere', 'photo', 'picture', 'one', 'no', 'wait', 'last', 'being', 'were', 'remember', 'really', 'can'])

export interface ClassicResult {
  query: string
  tokens: string[]
  count: number
  samples: Array<{ id: string; date: string }>
}

// Classic baseline: a literal keyword box. It requires every content word of
// the query to appear in the photo's searchable text (id, album, date,
// setting, tags, colors, events), which is how AND-style keyword matching
// behaves on a natural-language memory dump. It searches living photos only:
// deleted items are invisible to it, which is exactly why P1 never learned
// the truth. Short literal queries still work, and the benchmark keeps one
// such case on purpose.
export function classicSearch(cue: string): ClassicResult {
  const tokens = cue
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !CLASSIC_STOP.has(t))
  const hits: Array<{ id: string; date: string; score: number }> = []
  for (const p of LIBRARY_FOR_CLASSIC) {
    if (p.deleted) continue
    const haystack = [p.id, p.album, p.date, p.setting, ...p.tags, ...p.colors, ...p.events].join(' ').toLowerCase()
    const matched = tokens.filter((t) => haystack.includes(t))
    if (tokens.length > 0 && matched.length === tokens.length) {
      hits.push({ id: p.id, date: p.date, score: matched.length })
    }
  }
  hits.sort((a, b) => a.score - b.score)
  return {
    query: cue,
    tokens,
    count: hits.length,
    samples: hits.slice(0, 3).map((h) => ({ id: h.id, date: h.date })),
  }
}

// Avoid importing the whole library type graph twice; a thin view is enough.
import { PHOTOS as LIBRARY_FOR_CLASSIC } from './library'

// ── Runner ───────────────────────────────────────────────────────────────────

export interface CaseOutcome {
  case: BenchmarkCase
  firstRun: RetrievalResult
  parse: CueParse
  final: RetrievalResult
  classic: ClassicResult
  ok: boolean
}

export function runCase(c: BenchmarkCase): CaseOutcome {
  const firstRun = retrieve(c.cue)
  let final = firstRun
  if (firstRun.decision.kind === 'clarify') {
    const option = firstRun.decision.clarify?.options.find(
      (o) => o.id !== 'neither' && (c.clarifyAlbum ? o.cluster === c.clarifyAlbum : true),
    )
    final = retrieve(c.cue, { clarify: { album: option?.cluster ?? 'neither' } })
  }
  const classic = classicSearch(c.cue)
  return { case: c, firstRun, parse: firstRun.parse, final, classic, ok: final.decision.kind === c.expect }
}

export function runAll(): { outcomes: CaseOutcome[]; allOk: boolean } {
  const outcomes = BENCHMARK_CASES.map(runCase)
  return { outcomes, allOk: outcomes.every((o) => o.ok) }
}
