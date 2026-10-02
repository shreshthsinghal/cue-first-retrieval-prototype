import { retrieve } from './retrieve'
import type { CueParse, DecisionKind, RetrievalResult } from './types'

// ── Benchmark: replay research-grounded cue cases through the engine ────────
// Cases 1 to 3 mirror the three live think-aloud tasks (P1, P2, P3) from the
// interview study. The rest embody the individual findings: 2c (confident
// wrong dates and places), 2d (visual cues that cannot become words), G1
// (photos living in chat apps), deleted targets, resigned memories,
// event-anchored sequencing, and the honest baseline: classic search works
// for known-item lookups, and honest failures stay explained.
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
  {
    id: 'resigned-deleted',
    title: 'Resigned memory, target deleted',
    cue: "The family group photo at the old house during the festival, we were all in red. It's gone now anyway, I deleted it.",
    groundedIn: 'Resigned sentiment follows silent failure (16 corpus items). Second deleted ghost: the engine must state existence, not sell a search.',
    expect: 'out_of_scope_deleted',
    classicNote: 'Deleted items are invisible to the classic box, so it returns zero and confirms the person\u2019s wrong belief that the photo is gone for good.',
  },
  {
    id: 'trek-wrong-month',
    title: 'Event remembered, month wrong by seasons',
    cue: 'The trek. I think it was March, maybe April. It was freezing and there was snow on the summit.',
    groundedIn: 'Companion to insight 2c: the event holds, the month drifts. The event anchor runs the trek against its real cluster date and the shift is shown.',
    expect: 'found',
    classicNote: 'March and April filters exclude October, where the only snow summit lives. Literal date boxes cannot recover from seasonal drift.',
  },
  {
    id: 'chat-ticket',
    title: 'G1: forwarded booking, not a camera photo',
    cue: 'The train booking confirmation Ma forwarded me in January.',
    groundedIn: 'G1: tickets, bookings and forwarded documents often live only in chats. Scope is checked before failure is declared.',
    expect: 'out_of_scope_chat',
    classicNote: 'A keyword box has no scope concept: it searches the gallery, finds nothing, and the ticket is written off as lost.',
  },
  {
    id: 'string-lights-dinner',
    title: 'Two moments fit, one question resolves',
    cue: 'That dinner at night with all the little lights, near the beach I think.',
    groundedIn: 'Move 3: when evidence splits across two albums, one question with the candidates attached replaces silent guessing.',
    expect: 'found',
    clarifyAlbum: 'Gokarna weekend',
    classicNote: 'Both the wedding dinner and the beach shack carry lights and dinner. A ranked list alone cannot say which one she means.',
  },
  {
    id: 'monsoon-chai',
    title: 'Season plus activity, first try',
    cue: 'That cup of chai watching the rain, monsoon time.',
    groundedIn: 'Seasonal time plus an everyday activity: the small-moment re-finding the corpus asks for and classic search cannot serve.',
    expect: 'found',
    classicNote: 'Rain and chai are pixels, not captions. The words never sit in an album name, so the box has nothing to match.',
  },
  {
    id: 'manali-snow',
    title: 'Confidently wrong place, honest failure',
    cue: "That snow trail near Manali, I'm sure it was Manali.",
    groundedIn: 'Place names break the way dates do (2c). The failure is explained and the closest candidates are shown: the summit photos exist, and one look corrects the place name.',
    expect: 'not_found',
    classicNote: 'Zero results for Manali, silently. The person concludes the photo does not exist instead of doubting the place name.',
  },
  {
    id: 'concert-crowd',
    title: 'Crowd memory, relative time',
    cue: 'The concert last year, we were somewhere in the crowd, purple lights everywhere.',
    groundedIn: 'Event-scale visual memory (crowd, lights, color) with only relative time: the pattern behind the 12 AI-substitution corpus items.',
    expect: 'found',
    classicNote: 'Crowd and purple never co-occur as searchable words and "last year" is not a filterable value. The box returns nothing.',
  },
  {
    id: 'mehndi-before-wedding',
    title: 'Sequenced event, no date at all',
    cue: 'The mehndi the day before the wedding, her hands full of henna.',
    groundedIn: 'Event-anchored sequencing ("the day before") with no absolute time, matched against the library\u2019s real cluster dates.',
    expect: 'found',
    classicNote: '"Before" is not a keyword and no year or month is given, so the classic box has nothing to filter on.',
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
