import { PHOTOS } from './library'
import { buildWindows, parseCue, widenWindows } from './parse'
import type {
  ClarifyPrompt,
  CueParse,
  Decision,
  Evidence,
  Hypothesis,
  PassTrace,
  Photo,
  RetrievalResult,
  ScoredPhoto,
} from './types'

// ── Moves 2 to 4: translate, run parallel hypotheses, escalate, explain ─────
//
// Design rules (all trace back to the problem definition):
// - Time windows are candidates, never hard filters: 2 of 3 participants held
//   wrong dates with confidence, so a literal window miss must not kill a run.
// - The system escalates before it asks: pass 2 widens windows and relaxes
//   attributes automatically (0 reformulations observed: users will not do
//   this work themselves).
// - One clarification maximum, with the evidence attached.
// - No outcome is silent: found, clarify, not-found and both out-of-scope
//   states all carry an explanation and a search trace.

const WEIGHTS = {
  event: 3.0,
  windowHit: 2.5,
  windowMiss: -0.8,
  windowMissRelaxed: -0.4,
  tag: 1.2,
  tagCap: 3,
  colorHit: 1.0,
  colorMissPrefer: -0.2,
  colorMissPreferRelaxed: 0,
  settingHit: 1.0,
  settingMiss: -0.3,
  genericOutdoor: 0.4,
  people: 0.4,
  timeOfDay: 0.3,
  clarifyAlbum: 2.0,
  clarifyBonus: 0.8,
} as const

const FOUND_T = 4.2
const STRONG_T = 6.5
const MARGIN_T = 0.8
const CLARIFY_T = 2.6

const TIME_OF_DAY_TAGS = new Set(['sunset', 'night', 'morning', 'day'])

const SETTING_LABELS: Record<string, string> = {
  water: 'lakeside or waterside', beach: 'beach', mountains: 'mountains',
  home: 'at home', city: 'in the city', campus: 'on campus',
  indoor: 'indoors', outdoor: 'outdoors',
}

const monthLabel = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

// ── Hypothesis construction (Move 2) ─────────────────────────────────────────

function eventAnchorWindows(parse: CueParse): Array<{ years: number[]; months: number[]; label: string }> {
  const clusters = new Set<string>()
  for (const p of LIB) {
    for (const e of p.events) if (parse.events.includes(e)) clusters.add(`${e}:${p.date.slice(0, 7)}`)
  }
  const windows: Array<{ years: number[]; months: number[]; label: string }> = []
  for (const c of clusters) {
    const [ev, ym] = c.split(':')
    windows.push({
      years: [Number(ym.slice(0, 4))],
      months: [Number(ym.slice(5, 7)) - 1],
      label: `${ev} · ${monthLabel(`${ym}-15`)}`,
    })
  }
  return windows
}

export function buildHypotheses(parse: CueParse): Hypothesis[] {
  const literalWindows = buildWindows(parse.timeHints)
  const contentTags = parse.tags.filter((t) => !TIME_OF_DAY_TAGS.has(t))
  const hyps: Hypothesis[] = []

  hyps.push({
    id: 'h1-literal',
    label: 'Take the memory literally',
    rationale: 'Run the time and content exactly as you said it. If your memory is precise, this is the fastest path.',
    windows: literalWindows,
    colorMode: parse.colors.length ? 'prefer' : 'ignore',
    eventFilter: parse.events,
    tags: contentTags,
    settings: parse.settings,
    peopleMin: parse.people.min,
  })

  const anchorWindows = eventAnchorWindows(parse)
  if (parse.events.length && anchorWindows.length) {
    hyps.push({
      id: 'h2-event-anchor',
      label: 'Trust the event, not the date',
      rationale: 'Autobiographical memory organizes around events and life periods, not dates. Run your event against the months it actually happened.',
      windows: anchorWindows,
      colorMode: parse.colors.length ? 'prefer' : 'ignore',
      eventFilter: parse.events,
      tags: contentTags,
      settings: parse.settings,
      peopleMin: parse.people.min,
    })
  }

  if (literalWindows.length && (parse.flags.includes('confident-date') || literalWindows.some((w) => w.months.length <= 3))) {
    hyps.push({
      id: 'h3-shifted',
      label: 'The date might be wrong',
      rationale: 'Dates held with confidence turned out wrong 2 of 3 times in our interviews. Widen the window by a year and the season by a month.',
      windows: widenWindows(literalWindows, false),
      colorMode: parse.colors.length ? 'prefer' : 'ignore',
      eventFilter: parse.events,
      tags: contentTags,
      settings: parse.settings,
      peopleMin: parse.people.min,
    })
  }

  const contentStrength = contentTags.length + parse.colors.length + parse.settings.filter((s) => s !== 'outdoor').length
  if (contentStrength >= 2 || (contentStrength >= 1 && parse.events.length === 0)) {
    hyps.push({
      id: 'h4-content',
      label: 'Ignore time completely',
      rationale: 'When time is vague or possibly wrong, rank the whole library on content alone and let the evidence decide.',
      windows: [],
      colorMode: parse.colors.length ? 'prefer' : 'ignore',
      eventFilter: [],
      tags: contentTags,
      settings: parse.settings,
      peopleMin: parse.people.min,
    })
  }

  return hyps
}

// ── Scoring ──────────────────────────────────────────────────────────────────

interface ScoreDetail { score: number; evidence: Evidence[]; via: string }

function windowContains(w: { years: number[]; months: number[] }, photo: Photo): boolean {
  const y = Number(photo.date.slice(0, 4))
  const m = Number(photo.date.slice(5, 7)) - 1
  return w.years.includes(y) && w.months.includes(m)
}

export function scorePhoto(photo: Photo, hyp: Hypothesis, parse: CueParse): ScoreDetail {
  const evidence: Evidence[] = []
  let score = 0

  if (hyp.eventFilter.length) {
    const hit = photo.events.filter((e) => hyp.eventFilter.includes(e))
    if (hit.length) {
      score += WEIGHTS.event
      evidence.push({ text: `your ${hit[0].replace('-', ' ')} moment`, hypothesisId: hyp.id, weight: WEIGHTS.event })
    }
  }

  if (hyp.windows.length) {
    const hitW = hyp.windows.find((w) => windowContains(w, photo))
    if (hitW) {
      score += WEIGHTS.windowHit
      evidence.push({ text: `${monthLabel(photo.date)} falls inside "${hitW.label}"`, hypothesisId: hyp.id, weight: WEIGHTS.windowHit })
    } else {
      score += hyp.relaxed ? WEIGHTS.windowMissRelaxed : WEIGHTS.windowMiss
    }
  }

  let tagHits = 0
  for (const t of hyp.tags) {
    if (photo.tags.includes(t) && tagHits < WEIGHTS.tagCap) {
      tagHits += 1
      score += WEIGHTS.tag
      evidence.push({ text: `${t.replace('-', ' ')} visible in the photo`, hypothesisId: hyp.id, weight: WEIGHTS.tag })
    }
  }
  for (const t of parse.tags) {
    if (TIME_OF_DAY_TAGS.has(t) && photo.timeOfDay === t) {
      score += WEIGHTS.timeOfDay
      evidence.push({ text: `matches "${t}" lighting`, hypothesisId: hyp.id, weight: WEIGHTS.timeOfDay })
    }
  }

  if (parse.colors.length) {
    const hit = photo.colors.some((c) => parse.colors.includes(c))
    if (hit) {
      score += WEIGHTS.colorHit
      const c = photo.colors.find((c) => parse.colors.includes(c))
      evidence.push({ text: `${c} clearly present`, hypothesisId: hyp.id, weight: WEIGHTS.colorHit })
    } else if (hyp.relaxed) {
      score += WEIGHTS.colorMissPreferRelaxed
    } else if (hyp.colorMode === 'prefer') {
      score += WEIGHTS.colorMissPrefer
    } else if (hyp.colorMode === 'require') {
      score += WEIGHTS.colorMissRequire
    }
  }

  if (parse.settings.length) {
    const genericOutdoor = parse.settings.length === 1 && parse.settings[0] === 'outdoor'
    if (genericOutdoor) {
      if (photo.setting !== 'indoor' && photo.setting !== 'home') {
        score += WEIGHTS.genericOutdoor
        evidence.push({ text: 'outdoors, as you remembered', hypothesisId: hyp.id, weight: WEIGHTS.genericOutdoor })
      }
    } else if (parse.settings.includes(photo.setting)) {
      score += WEIGHTS.settingHit
      evidence.push({ text: `${SETTING_LABELS[photo.setting] ?? photo.setting}, as you said`, hypothesisId: hyp.id, weight: WEIGHTS.settingHit })
    } else if (!hyp.relaxed) {
      score += WEIGHTS.settingMiss
    }
  }

  if (parse.people.min && photo.people >= parse.people.min) {
    score += WEIGHTS.people
    evidence.push({ text: `${photo.people} people, fits "with ${parse.people.group === 'any' ? 'people' : parse.people.group}"`, hypothesisId: hyp.id, weight: WEIGHTS.people })
  }

  return { score: Math.round(score * 100) / 100, evidence, via: hyp.id }
}

function runPass(
  parse: CueParse,
  hyps: Hypothesis[],
  pass: 1 | 2,
  note: string,
  relaxed: string[],
  clarifyAlbum: string | null,
): { trace: PassTrace; scored: Map<string, ScoredPhoto> } {
  const scored = new Map<string, ScoredPhoto>()
  const runs: PassTrace['runs'] = []

  for (const hyp of hyps) {
    const windowLabels = hyp.windows.map((w) => w.label)
    let hits = 0
    const tops: Array<{ id: string; s: number }> = []
    for (const photo of LIB) {
      const detail = scorePhoto(photo, hyp, parse)
      if (clarifyAlbum && photo.album === clarifyAlbum) {
        detail.score += WEIGHTS.clarifyAlbum + WEIGHTS.clarifyBonus
        detail.evidence.push({ text: 'matches where you said it was', hypothesisId: hyp.id, weight: WEIGHTS.clarifyAlbum })
      }
      const existing = scored.get(photo.id)
      if (!existing || detail.score > existing.score) {
        scored.set(photo.id, { photo, score: detail.score, via: hyp.id, evidence: detail.evidence })
      }
      if (detail.score >= CLARIFY_T) {
        hits += 1
        tops.push({ id: photo.id, s: detail.score })
      }
    }
    tops.sort((a, b) => b.s - a.s)
    runs.push({
      hypothesisId: hyp.id,
      label: hyp.label,
      windowsScanned: windowLabels,
      hits,
      topIds: tops.slice(0, 3).map((t) => t.id),
    })
  }

  return { trace: { pass, note, relaxed, runs }, scored }
}

// ── Decisions (Move 4: every outcome explained) ──────────────────────────────

function toScored(scored: Map<string, ScoredPhoto>): ScoredPhoto[] {
  return Array.from(scored.values()).sort((a, b) => b.score - a.score)
}

function dateRecovery(parse: CueParse, hyps: Hypothesis[], photo: Photo, via: string) {
  const literal = hyps.find((h) => h.id === 'h1-literal')
  if (!literal || !literal.windows.length || via === 'h1-literal') return undefined
  const missedLiteral = !literal.windows.some((w) => windowContains(w, photo))
  if (!missedLiteral) return undefined
  const guessed = parse.timeHints.find((h) => h.kind === 'absolute')?.raw
  if (!guessed) return undefined
  return { guessed, actual: monthLabel(photo.date) }
}

function pickClarify(scored: ScoredPhoto[]): ClarifyPrompt | null {
  const candidates = scored.filter((s) => !s.photo.deleted && s.score >= CLARIFY_T)
  if (candidates.length < 2) return null
  const albums: Array<{ album: string; top: ScoredPhoto; count: number }> = []
  for (const s of candidates) {
    const a = albums.find((x) => x.album === s.photo.album)
    if (a) { a.count += 1 } else { albums.push({ album: s.photo.album, top: s, count: 1 }) }
  }
  if (albums.length < 2) return null
  albums.sort((x, y) => y.top.score - x.top.score || y.count - x.count)
  const chosen = albums.slice(0, 3)
  return {
    question: 'Two or more moments fit your memory. Which is closest?',
    options: [
      ...chosen.map((a) => ({ id: `album:${a.album}`, label: `${a.album} (${monthLabel(a.top.photo.date)})`, cluster: a.album })),
      { id: 'neither', label: 'None of these', cluster: '' },
    ],
    evidenceNote: `Your cues split across ${chosen.map((a) => a.album).join(', ')}. Asking once, with candidates attached, beats making you reformulate: 0 reformulations were observed across 3 live tasks.`,
  }
}

const GROUNDING = {
  found: 'Answers the top re-ranked opportunity from the research: content plus approximate-time hybrid search, requested by 3 of 3 participants.',
  clarify: 'Reformulation is replaced by one guided question: people never reformulated on their own (0 in 3 live tasks), so the moment to help is before they give up.',
  not_found: 'Every failure is explained. In live tasks people could not see why search failed and switched apps or quit instead (3 of 3).',
  deleted: 'G1 hard boundary: nothing can find a deleted photo. Existence confidence messaging can, and it prevents minutes of hopeless scrolling.',
  chat: 'G1: "missing" photos often exist outside the searched scope. 2 of 3 participants keep older photos in chat apps.',
} as const

export interface RetrieveOptions {
  clarify?: { album: string | 'neither' }
  /** A pre-parsed frame (from parse-llm.ts, or carried back on clarify). When absent, the deterministic parser runs. */
  parse?: CueParse
}

type DecisionOrEscalate = Decision | { kind: '__escalate' }

const isEscalate = (d: DecisionOrEscalate): d is { kind: '__escalate' } =>
  (d as { kind: string }).kind === '__escalate'

// The library defaults to the v1 synthetic roll; the evaluation harness can
// inject the v2 label view so the SAME engine runs on the SAME candidates.
let LIB: Photo[] = PHOTOS
export function setLibrary(photos: Photo[]): void {
  LIB = photos
}

export function retrieve(cue: string, opts: RetrieveOptions = {}): RetrievalResult {
  const started = Date.now()
  const parse = opts.parse ?? parseCue(cue)
  const hypotheses = buildHypotheses(parse)
  const passes: PassTrace[] = []

  const clarified = Boolean(opts.clarify)
  const neither = opts.clarify?.album === 'neither'
  const clarifyAlbum = clarified && !neither ? (opts.clarify!.album as string) : null

  const pass1 = runPass(parse, hypotheses, 1, 'Initial run: literal time, event anchors, shifted date, content-only, all in parallel.', [], clarifyAlbum)
  passes.push(pass1.trace)
  let scoredMap = pass1.scored
  let decision = decide(parse, hypotheses, scoredMap, { passes: passes.length, clarified, neither })
  let passCount = 1

  // ── Pass 2: automatic escalation before ever bothering the user ──────────
  if (isEscalate(decision)) {
    const fullWidened = widenWindows(buildWindows(parse.timeHints), true)
    const hyps2: Hypothesis[] = hypotheses.map((h) => ({
      ...h,
      // The event-anchor windows are the library's real cluster dates; they
      // stay precise. Everything literal widens fully and relaxes.
      windows: h.id === 'h2-event-anchor' || h.windows.length === 0 ? h.windows : (fullWidened.length ? fullWidened : h.windows),
      colorMode: 'ignore',
      relaxed: true,
    }))
    const pass2 = runPass(
      parse,
      hyps2,
      2,
      'Escalation: widened time windows, relaxed color and setting penalties. The system does the reformulating the user would otherwise have to do.',
      ['time windows widened', 'color relaxed', 'setting relaxed'],
      clarifyAlbum,
    )
    passes.push(pass2.trace)
    scoredMap = mergeBest(scoredMap, pass2.scored)
    passCount = 2
    decision = decide(parse, hyps2, scoredMap, { passes: passes.length, clarified, neither })
  }

  const results = toScored(scoredMap)
  const living = results.filter((r) => !r.photo.deleted)

  if (decision.kind === 'clarify') {
    const prompt = pickClarify(results)
    decision = {
      kind: 'clarify',
      headline: 'One question before we commit',
      explanation:
        'The evidence points at more than one moment. Instead of making you retype queries (0 reformulations were observed; people just switch apps), we ask once, with the candidates attached.',
      results: living.slice(0, 4),
      clarify: prompt ?? undefined,
      groundedIn: GROUNDING.clarify,
    }
  }

  if (decision.kind === 'not_found') {
    const closest = living.slice(0, 3)
    decision = {
      ...decision,
      closest,
      explanation: closest.length
        ? 'Nothing in the library cleared the confidence bar, even after widening windows and relaxing attributes. These three came closest; the trace below shows every hypothesis and window that was tried. A failed search should never be silent.'
        : decision.explanation,
    }
  }

  return {
    parse,
    parseNotes: parseNotes(parse),
    hypotheses,
    passes,
    decision,
    ranking: toScored(scoredMap).filter((s) => !s.photo.deleted).map((s) => ({ id: s.photo.id, score: s.score })),
    metrics: {
      photosScanned: LIB.length * passCount * hypotheses.length,
      hypothesesRun: hypotheses.length * passCount,
      passes: passCount,
      clarificationsUsed: clarified ? 1 : 0,
      elapsedMs: Math.max(1, Date.now() - started),
    },
  }
}

function mergeBest(
  a: Map<string, ScoredPhoto>,
  b: Map<string, ScoredPhoto>,
): Map<string, ScoredPhoto> {
  const out = new Map(a)
  for (const [id, s] of b) {
    const prev = out.get(id)
    if (!prev || s.score > prev.score) out.set(id, s)
  }
  return out
}

function decide(
  parse: CueParse,
  hyps: Hypothesis[],
  scored: Map<string, ScoredPhoto>,
  ctx: { passes: number; clarified: boolean; neither: boolean },
): DecisionOrEscalate {
  const all = toScored(scored)
  const living = all.filter((s) => !s.photo.deleted)
  const ghosts = all.filter((s) => s.photo.deleted)
  const top = living[0]
  const ghostTop = ghosts[0]
  const secondDistinct = living.find((s) => s.photo.album !== top?.photo.album)

  // ── out of scope: deleted (the P1 hard boundary) ─────────────────────────
  if (ghostTop && ghostTop.score >= FOUND_T && (!top || ghostTop.score >= top.score)) {
    const sameAlbum = living.filter((s) => s.photo.album === ghostTop.photo.album).slice(0, 3)
    return {
      kind: 'out_of_scope_deleted',
      headline: 'This photo existed, but it is no longer in the library',
      explanation: `The strongest match is ${ghostTop.photo.id} (${monthLabel(ghostTop.photo.date)}). ${ghostTop.photo.deleted?.note ?? ''} Nothing can retrieve a deleted photo; saying so now prevents minutes of hopeless scrolling. Photos from the same day are shown below and are still in the library.`,
      results: [ghostTop, ...sameAlbum],
      groundedIn: GROUNDING.deleted,
    }
  }

  // ── out of scope: chat-origin content (G1) ───────────────────────────────
  if (top && parse.scopeHints.includes('chat') && top.photo.origin === 'screenshot' && top.score >= CLARIFY_T) {
    return {
      kind: 'out_of_scope_chat',
      headline: 'This is chat-app content and may never have lived in Photos',
      explanation: `The best match is ${top.photo.id}, a screenshot. Your description sounds like received or forwarded content, and 2 of 3 participants keep that content in WhatsApp or Snapchat, not the gallery. Checking scope before searching is the gate question the research says people skip.`,
      results: [top],
      groundedIn: GROUNDING.chat,
    }
  }

  // ── found ────────────────────────────────────────────────────────────────
  if (top && top.score >= FOUND_T) {
    const strong = top.score >= STRONG_T
    const margin = top.score - (secondDistinct?.score ?? 0)
    if (strong || margin >= MARGIN_T || ctx.clarified) {
      const considered = living.filter((s) => s.score < top.score).slice(0, 3)
      const recovered = dateRecovery(parse, hyps, top.photo, top.via)
      const topWithRecovery: ScoredPhoto = recovered ? { ...top, dateRecovered: recovered } : top
      const hypLabel = hyps.find((h) => h.id === top.via)?.label ?? ''
      return {
        kind: 'found',
        headline: 'Found it',
        explanation: [
          `Top match via the "${hypLabel}" hypothesis.`,
          recovered
            ? `Your guess (${recovered.guessed}) was off; the photo is from ${recovered.actual}. The date was treated as one hypothesis among several, which is how the research says confident dates behave (wrong 2 of 3 times).`
            : 'Every result carries the reasons it matched, so you can verify what the system understood.',
          considered.length ? 'Also considered, and why they lost: shown below.' : '',
        ].filter(Boolean).join(' '),
        results: [topWithRecovery, ...considered],
        groundedIn: GROUNDING.found,
      }
    }
  }

  // ── escalate once before asking the user anything ────────────────────────
  if (!ctx.clarified && ctx.passes < 2) return { kind: '__escalate' }

  // ── clarify ──────────────────────────────────────────────────────────────
  if (top && top.score >= CLARIFY_T && !ctx.clarified) return { kind: 'clarify' }

  // ── honest not-found ─────────────────────────────────────────────────────
  return {
    kind: 'not_found',
    headline: ctx.neither ? 'Not found: none of the candidates were right' : 'Not found in this library',
    explanation: ctx.neither
      ? 'You rejected every candidate, so the honest answer is that this memory does not match anything here. The trace shows what was searched before giving up.'
      : 'Nothing cleared the confidence bar, even after widening windows and relaxing attributes. The closest candidates and the full trace are shown so the failure is explainable, not silent.',
    results: [],
    groundedIn: GROUNDING.not_found,
  }
}

function parseNotes(parse: CueParse): string[] {
  const notes: string[] = []
  if (parse.flags.includes('confident-date'))
    notes.push('You gave a specific date with confidence. In our interviews, dates held with confidence turned out wrong 2 of 3 times, so the date becomes one hypothesis, not the rule.')
  if (parse.flags.includes('time-only'))
    notes.push('Time is carrying this search almost alone. Vague or relative time is the least supported clue type (3 of 3 participants struggled with it), so content evidence gets a strong voice.')
  if (parse.flags.includes('visual-not-verbalizable'))
    notes.push('You said this is hard to describe. 2 of 3 participants had visual memory they could not put into words. Fragments are enough; nothing here requires keywords.')
  if (parse.flags.includes('scope-maybe-outside'))
    notes.push('This sounds like received or forwarded content. 2 of 3 participants keep older photos in chat apps, so scope gets checked before we call anything a failure.')
  if (!notes.length)
    notes.push('Cues accepted as-is: relative time, visual fragments and event anchors all parse. No keywords or exact dates required.')
  return notes
}
