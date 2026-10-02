import type { CueParse, Setting, TimeHint } from './types'

// ── Stage 1: the language-model parser ──────────────────────────────────────
// Reads the memory dump exactly as spoken and returns the same structured
// CueParse the deterministic parser (parse.ts) emits, so the rest of the
// engine never changes. The deterministic parser stays behind it as the
// validator of last resort: any failure here (network, timeout, malformed
// frame) resolves to null and the caller falls back, which is also what the
// benchmark uses so every replay stays reproducible.

const TAGS = new Set([
  'blowing', 'candles', 'cake', 'balloons', 'fairy-lights', 'selfie', 'sunset',
  'night', 'morning', 'day', 'crowd', 'concert', 'fireworks', 'mehndi',
  'mandap', 'dinner', 'food', 'dog', 'chai', 'rain', 'kitchen', 'coffee',
  'cycling', 'books', 'whiteboard', 'study', 'exam', 'meme', 'ticket', 'snow',
  'trail', 'tents', 'summit', 'waves', 'volleyball', 'water', 'portrait',
  'boating', 'skyline', 'street-food', 'park', 'fog', 'cap', 'gown',
  'forwarded', 'family', 'group', 'festival', 'house', 'lake', 'beach',
  'wedding', 'graduation', 'hiking', 'forest', 'stars', 'campsite', 'river',
  'stones', 'decorations', 'table', 'monsoon', 'window', 'walk', 'metro',
])

const COLORS = new Set([
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'black',
  'white', 'grey', 'brown',
])

const COLOR_ALIASES: Record<string, string> = {
  golden: 'orange', gold: 'orange', gray: 'grey', silver: 'grey',
}

const SETTINGS = new Set<Setting>([
  'water', 'beach', 'mountains', 'home', 'city', 'campus', 'indoor', 'outdoor',
])

const EVENTS = new Set([
  'birthday', 'wedding', 'graduation', 'trek', 'beach-trip', 'city-trip',
  'everyday',
])

const FLAGS = new Set([
  'confident-date', 'time-only', 'visual-not-verbalizable', 'scope-maybe-outside',
])

const SYSTEM_PROMPT = `You parse raw photo-memory cues for a retrieval engine. People describe a photo the way memory keeps it: relative time, event anchors, visual fragments, sometimes confidently wrong. Your job is to extract a structured frame. Respond with ONLY a JSON object, no prose, in exactly this shape:

{
  "timeHints": [
    { "kind": "absolute", "months": [0-11], "years": [2024], "raw": "june 2024" },
    { "kind": "season", "months": [0-11], "years": [2025], "raw": "last summer" },
    { "kind": "anchor", "anchor": "birthday", "raw": "before my birthday" },
    { "kind": "vague", "raw": "a year or two ago" }
  ],
  "events": ["birthday" | "wedding" | "graduation" | "trek" | "beach-trip" | "city-trip"],
  "tags": ["from the vocabulary below"],
  "colors": ["red" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "black" | "white" | "grey" | "brown"],
  "settings": ["water" | "beach" | "mountains" | "home" | "city" | "campus" | "indoor" | "outdoor"],
  "people": { "min": 2, "group": "friends" | "family" | "any" },
  "scopeHints": ["chat" | "forwarded"],
  "flags": ["confident-date" | "time-only" | "visual-not-verbalizable" | "scope-maybe-outside"]
}

Rules:
- months are 0-indexed (january is 0, december is 11). Omit "months"/"years" keys when unknown.
- "anchor" is only for birthday references. Other event-anchored time ("the day before the wedding") goes in "raw" as a vague hint plus the event.
- tags vocabulary: blowing, candles, cake, balloons, fairy-lights, selfie, sunset, night, morning, day, crowd, concert, fireworks, mehndi, mandap, dinner, food, dog, chai, rain, kitchen, coffee, cycling, books, whiteboard, study, exam, meme, ticket, snow, trail, tents, summit, waves, volleyball, water, portrait, boating, skyline, street-food, park, fog, cap, gown, forwarded, family, group, festival, house, lake, beach, wedding, graduation, hiking, forest, stars, campsite, river, stones, decorations, table, monsoon, window, walk, metro
- "confident-date" only when the person asserts the date with confidence ("for sure", "I'm sure it was April").
- "time-only" when time is the main cue and content is thin.
- "visual-not-verbalizable" when the person says they cannot describe it.
- "scope-maybe-outside" when the content sounds received or forwarded (memes, screenshots, tickets, "sent me").
- people.min is 2 or more only when the cue clearly implies other people (we, friends, family, everyone, group); omit "min" otherwise.
- Omit empty arrays and absent keys rather than inventing values. Never invent months, years, or words that are not in the cue.`

export interface ParseOutcome {
  parse: CueParse
  ms: number
}

/**
 * Interpret a raw memory dump with the language model. Returns null on any
 * failure so the caller can fall back to the deterministic parser: the API
 * must never hard-fail because the first stage did.
 */
export async function parseCueLLM(raw: string, timeoutMs = 9000): Promise<ParseOutcome | null> {
  const started = Date.now()
  try {
    const frame = await Promise.race([requestFrame(raw), sleep(timeoutMs).then(() => null)])
    if (!frame || typeof frame !== 'object') return null
    const parse = sanitizeFrame(frame as Record<string, unknown>, raw)
    if (!parse) return null
    return { parse, ms: Date.now() - started }
  } catch {
    return null
  }
}

async function requestFrame(raw: string): Promise<unknown> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk')
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: raw },
    ],
    thinking: { type: 'disabled' },
  })
  const text = completion.choices[0]?.message?.content ?? ''
  return extractJson(text)
}

function sleep(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms))
}

/** Pull the first JSON object out of a model response, fences included. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const src = fenced ? fenced[1] : text
  const start = src.indexOf('{')
  const end = src.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(src.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * Validate and coerce a model-produced frame into CueParse. Every field is
 * whitelisted against the library vocabulary; anything the engine cannot
 * interpret is dropped rather than guessed at.
 */
export function sanitizeFrame(frame: Record<string, unknown>, raw: string): CueParse | null {
  if (!frame || typeof frame !== 'object') return null

  const timeHints: TimeHint[] = []
  const hints = Array.isArray(frame.timeHints) ? frame.timeHints : []
  for (const h of hints) {
    if (!h || typeof h !== 'object') continue
    const hint = h as Record<string, unknown>
    const kind = typeof hint.kind === 'string' ? hint.kind : ''
    const hintRaw = typeof hint.raw === 'string' && hint.raw.trim() ? hint.raw.trim().slice(0, 80) : kind
    const months = ints(hint.months).filter((m) => m >= 0 && m <= 11)
    const years = ints(hint.years).filter((y) => y >= 1990 && y <= 2100)
    if (kind === 'absolute' || kind === 'season') {
      if (!months.length && !years.length) continue
      timeHints.push({ kind, months, years, raw: hintRaw })
    } else if (kind === 'anchor' && hint.anchor === 'birthday') {
      timeHints.push({ kind: 'anchor', anchor: 'birthday', raw: hintRaw })
    } else if (kind === 'anchor' || kind === 'vague') {
      // Only the birthday anchor has a resolver in the engine; every other
      // anchored hint degrades to a vague hint that widens nothing but is
      // still shown to the user.
      timeHints.push({ kind: 'vague', raw: hintRaw })
    }
  }

  const events = strs(frame.events).filter((e) => EVENTS.has(e))
  const tags = strs(frame.tags).filter((t) => TAGS.has(t)).slice(0, 8)
  const colors = Array.from(new Set(strs(frame.colors).map((c) => COLOR_ALIASES[c] ?? c))).filter((c) => COLORS.has(c))
  const settings = strs(frame.settings).filter((s) => SETTINGS.has(s as Setting)) as Setting[]

  const peopleFrame = (frame.people && typeof frame.people === 'object' ? frame.people : {}) as Record<string, unknown>
  const people: CueParse['people'] = { group: 'any' }
  const group = typeof peopleFrame.group === 'string' ? peopleFrame.group : 'any'
  if (group === 'friends' || group === 'family') people.group = group
  const min = typeof peopleFrame.min === 'number' ? peopleFrame.min : Number.NaN
  if (Number.isFinite(min) && min >= 2) people.min = 2

  const scopeHints = strs(frame.scopeHints).filter((s) => s === 'chat' || s === 'forwarded') as CueParse['scopeHints']
  const flags = strs(frame.flags).filter((f) => FLAGS.has(f)) as CueParse['flags']

  return { raw, timeHints, events, tags, colors, settings, people, scopeHints, flags }
}

function ints(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return Array.from(new Set(v.map((x) => Math.round(Number(x))).filter((n) => Number.isFinite(n))))
}

function strs(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return Array.from(new Set(v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((s) => s.trim().toLowerCase())))
}
