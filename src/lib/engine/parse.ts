import { BIRTHDAY_MONTH, REFERENCE_NOW } from './library'
import type { CueParse, Setting, TimeHint } from './types'

// ── Move 1: parse a memory dump into structured cues ────────────────────────
// The parser accepts memory's native format: relative time, life-event
// anchors, visual fragments, and hints that may be confidently wrong. It is
// deliberately deterministic so the benchmark is reproducible; this module is
// the adapter point where a production embedding/LLM parser would slot in.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december']
const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec']

const COLOR_WORDS: Record<string, string> = {
  red: 'red', orange: 'orange', yellow: 'yellow', green: 'green', blue: 'blue',
  purple: 'purple', pink: 'pink', black: 'black', white: 'white',
  grey: 'grey', gray: 'grey', brown: 'brown', gold: 'orange', golden: 'orange',
}

const SETTING_PATTERNS: Array<[RegExp, Setting]> = [
  [/\b(lake|lakeside|river|waterside|water|boating|boat)\b/, 'water'],
  [/\b(beach|sea|ocean|shore|goa|gokarna)\b/, 'beach'],
  [/\b(mountain|mountains|himalaya|summit|snow|trek|campsite)\b/, 'mountains'],
  [/\b(home|house|kitchen|sofa|room)\b/, 'home'],
  [/\b(city|mumbai|metro|skyline|concert|street)\b/, 'city'],
  [/\b(campus|college|university|convocation)\b/, 'campus'],
  [/\b(indoor|inside)\b/, 'indoor'],
  [/\b(outdoor|outside|outdoors)\b/, 'outdoor'],
]

const TAG_PATTERNS: Array<[RegExp, string]> = [
  [/blowing (out )?(the )?candles|candle.?blow|blew (out )?(the )?candles/, 'blowing'],
  [/\b(candle|candles)\b/, 'candles'],
  [/\b(cake)\b/, 'cake'],
  [/\b(balloon|balloons)\b/, 'balloons'],
  [/\b(fairy.?lights|string.?lights|lights)\b/, 'fairy-lights'],
  [/\b(selfie)\b/, 'selfie'],
  [/\b(sunset|dusk|golden hour)\b/, 'sunset'],
  [/\b(night|after dark)\b/, 'night'],
  [/\b(morning|dawn)\b/, 'morning'],
  [/\b(daytime|day time|midday)\b/, 'day'],
  [/\b(crowd)\b/, 'crowd'],
  [/\b(concert|gig|live music)\b/, 'concert'],
  [/\b(fireworks|firecrackers)\b/, 'fireworks'],
  [/\b(mehndi|henna)\b/, 'mehndi'],
  [/\b(mandap)\b/, 'mandap'],
  [/\b(dinner|supper)\b/, 'dinner'],
  [/\b(food|meal|lunch)\b/, 'food'],
  [/\b(dog|pet|puppy)\b/, 'dog'],
  [/\b(chai|tea)\b/, 'chai'],
  [/\b(rain|rainy|monsoon)\b/, 'rain'],
  [/\b(kitchen|cooking|chapati)\b/, 'kitchen'],
  [/\b(coffee|latte|cafe)\b/, 'coffee'],
  [/\b(cycling|cycle|bicycle)\b/, 'cycling'],
  [/\b(books|bookshelf|shelf)\b/, 'books'],
  [/\b(whiteboard|blackboard)\b/, 'whiteboard'],
  [/\b(study|studying|exam|exams|notes|revision)\b/, 'exam'],
  [/\b(memes?|funny picture|funny picture)\b/, 'meme'],
  [/\b(ticket|booking|confirmation|reservation)\b/, 'ticket'],
  [/\b(snow)\b/, 'snow'],
  [/\b(trail|hiking|forest|pine)\b/, 'trail'],
  [/\b(tents?|camping)\b/, 'tents'],
  [/\b(summit)\b/, 'summit'],
  [/\b(waves?)\b/, 'waves'],
  [/\b(volleyball)\b/, 'volleyball'],
  [/\b(lake|lakeside|river|water|waves)\b/, 'water'],
  [/\b(portrait|close.?up)\b/, 'portrait'],
  [/\b(boat|boating|rowing)\b/, 'boating'],
  [/\b(skyline|marine drive)\b/, 'skyline'],
  [/\b(street.?food|pav bhaji|stall)\b/, 'street-food'],
  [/\b(park)\b/, 'park'],
  [/\b(fog|foggy|mist)\b/, 'fog'],
  [/\b(graduation cap|cap and gown|the cap|caps?)\b/, 'cap'],
  [/\b(gown)\b/, 'gown'],
  [/\b(meme|forwarded|forward)\b/, 'forwarded'],
]

const EVENT_PATTERNS: Array<[RegExp, string[]]> = [
  [/\b(birthday|bday)\b/, ['birthday']],
  [/\b(wedding|marriage|shaadi|haldi|mehndi ceremony)\b/, ['wedding']],
  [/\b(graduation|convocation|degree)\b/, ['graduation']],
  [/\b(trek|hike|hiking)\b/, ['trek']],
  [/\b(beach trip|beach weekend|goa trip|gokarna)\b/, ['beach-trip']],
  [/\b(city trip|weekend in|mumbai trip)\b/, ['city-trip']],
]

const CONFIDENT_RE = /\b(sure|exactly|definitely|for sure|certain|100|confirm)\b/
const VAGUAL_CUE_RE = /\b(can'?t (really )?describe|don'?t (really )?remember|no idea|something like|not sure what|some kind of)\b/

const STOP = new Set(['photo', 'picture', 'pic', 'it', 'was', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'my', 'i', 'we', 'she', 'he', 'her', 'his', 'there', 'and', 'or', 'with', 'think', 'maybe', 'around', 'about', 'sometime', 'some', 'time', 'last', 'this', 'that', 'one', 'is', 'are'])

function parseMonths(text: string): { months: number[]; raw: string[] } {
  const months: number[] = []
  const raws: string[] = []
  MONTHS.forEach((m, i) => {
    if (new RegExp(`\\b${m}\\b`).test(text) && !months.includes(i)) { months.push(i); raws.push(m) }
  })
  MONTH_ABBR.forEach((m) => {
    const idx = MONTHS.findIndex((full) => full.startsWith(m.replace('sept', 'sep')))
    const re = new RegExp(`\\b${m}\\b`)
    if (idx >= 0 && re.test(text) && !months.includes(idx)) { months.push(idx); raws.push(m) }
  })
  return { months: months.sort((a, b) => a - b), raw: raws }
}

function parseYears(text: string): number[] {
  const years: number[] = []
  const re = /\b(20\d{2})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) years.push(Number(m[1]))
  return years
}

/**
 * Build time windows from the parsed hints. Windows are candidates, never
 * hard filters: a miss costs a little score, content evidence can still win.
 */
export function buildWindows(
  hints: TimeHint[],
): Array<{ years: number[]; months: number[]; label: string }> {
  const Y = REFERENCE_NOW.year
  const windows: Array<{ years: number[]; months: number[]; label: string }> = []
  for (const h of hints) {
    if (h.kind === 'absolute') {
      if (h.years.length && h.months.length) {
        windows.push({ years: h.years, months: h.months, label: h.raw })
      } else if (h.years.length) {
        windows.push({ years: h.years, months: Array.from({ length: 12 }, (_, i) => i), label: h.raw })
      } else if (h.months.length) {
        windows.push({ years: [Y - 1, Y], months: h.months, label: h.raw })
      }
    } else if (h.kind === 'season') {
      windows.push({ years: h.years.length ? h.years : [Y - 1, Y], months: h.months, label: h.raw })
    } else if (h.kind === 'anchor') {
      if (h.anchor === 'birthday') {
        const bm = BIRTHDAY_MONTH
        const around = [bm - 2, bm - 1, bm, bm + 1, bm + 2].map((m) => (m + 12) % 12)
        const before = Array.from({ length: bm }, (_, i) => i)
        windows.push({ years: [Y - 1, Y], months: h.raw.includes('before') ? before : around, label: h.raw })
      }
    } else if (h.kind === 'vague') {
      if (h.raw.includes('last year')) windows.push({ years: [Y - 1], months: Array.from({ length: 12 }, (_, i) => i), label: 'last year' })
      if (h.raw.includes('year or two')) windows.push({ years: [Y - 1, Y - 2], months: Array.from({ length: 12 }, (_, i) => i), label: 'a year or two ago' })
      if (h.raw.includes('few months')) {
        const nowM = REFERENCE_NOW.month
        const months = Array.from({ length: 6 }, (_, i) => (nowM - 1 - i + 24) % 12)
        windows.push({ years: [Y - 1, Y], months, label: 'past few months' })
      }
    }
  }
  return windows
}

/**
 * Widen windows. Modest mode (+-1 year, +-1 month) backs the wrong-date
 * hypothesis. Full mode (all months, +-1 year) backs the escalation pass.
 */
export function widenWindows(
  windows: Array<{ years: number[]; months: number[]; label: string }>,
  full: boolean,
): Array<{ years: number[]; months: number[]; label: string }> {
  if (!windows.length) return windows
  const years = new Set<number>()
  let months = new Set<number>()
  for (const w of windows) {
    for (const y of w.years) { years.add(y - 1); years.add(y); years.add(y + 1) }
    if (full) {
      Array.from({ length: 12 }, (_, i) => i).forEach((m) => months.add(m))
    } else if (w.months.length <= 3) {
      for (const m of w.months) { months.add((m + 11) % 12); months.add(m); months.add((m + 1) % 12) }
    } else {
      w.months.forEach((m) => months.add(m))
    }
  }
  return [{ years: Array.from(years).sort(), months: Array.from(months).sort((a, b) => a - b), label: full ? 'widened (all months, years ±1)' : 'widened' }]
}

export function parseCue(rawInput: string): CueParse {
  const raw = rawInput.trim()
  const text = raw.toLowerCase().replace(/[',;]/g, ' ').replace(/\s+/g, ' ')

  // ── time ────────────────────────────────────────────────────────────────
  const timeHints: TimeHint[] = []
  const { months, raw: monthRaws } = parseMonths(text)
  const years = parseYears(text)

  if (years.length && months.length) {
    timeHints.push({ kind: 'absolute', months, years, raw: `${monthRaws.join('/')} ${years.join('/')}` })
  } else if (years.length) {
    timeHints.push({ kind: 'absolute', months: [], years, raw: years.join('/') })
  } else if (months.length) {
    timeHints.push({ kind: 'absolute', months, years: [], raw: monthRaws.join('/') })
  }

  const seasonMatch = text.match(/\b(last |this )?(summer|winter|monsoon|spring)\b/)
  if (seasonMatch) {
    const season = seasonMatch[2]
    const sm = season === 'summer' || season === 'spring' ? [4, 5, 6] : season === 'monsoon' ? [6, 7, 8] : [11, 0, 1]
    const sy = seasonMatch[1] === 'this ' ? [REFERENCE_NOW.year] : [REFERENCE_NOW.year - 1, REFERENCE_NOW.year]
    timeHints.push({ kind: 'season', months: sm, years: sy, raw: `${seasonMatch[0].trim()}` })
  }
  const birthdayMatch = text.match(/\b(before|after|around|near|close to)?\s*(my|the) birthday\b/)
  if (birthdayMatch) {
    timeHints.push({ kind: 'anchor', anchor: 'birthday', raw: birthdayMatch[0].trim() })
  }
  if (/\blast year\b/.test(text)) timeHints.push({ kind: 'vague', raw: 'last year' })
  if (/\b(a|one|or) year or two\b|\byear or two ago\b/.test(text)) timeHints.push({ kind: 'vague', raw: 'year or two ago' })
  if (/\b(few|couple of|some) months ago\b|\bpast (few|couple of) months\b/.test(text)) timeHints.push({ kind: 'vague', raw: 'few months ago' })

  // ── events, settings, tags, colors ──────────────────────────────────────
  const events: string[] = []
  for (const [re, evs] of EVENT_PATTERNS) if (re.test(text)) events.push(...evs.filter((e) => !events.includes(e)))
  // Hedged events ("a trip maybe") stay as content hints, not hard anchors.
  const hedgedEvent = /\b(trip|travel|vacation|outing)\b/.test(text)

  const settings: Setting[] = []
  for (const [re, s] of SETTING_PATTERNS) if (re.test(text) && !settings.includes(s)) settings.push(s)
  const genericOutdoor = settings.length === 1 && settings[0] === 'outdoor'

  const tags: string[] = []
  for (const [re, t] of TAG_PATTERNS) if (re.test(text) && !tags.includes(t)) tags.push(t)

  const colors: string[] = []
  for (const [w, c] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(text) && !colors.includes(c)) colors.push(c)
  }

  // ── people ──────────────────────────────────────────────────────────────
  const people: CueParse['people'] = { group: 'any' }
  if (/\b(friends|buddies|gang)\b/.test(text)) people.group = 'friends'
  if (/\b(family|parents|mom|dad|brother|sister)\b/.test(text)) people.group = 'family'
  if (/\b(friends|family|we|us|everyone|group|people|together)\b/.test(text)) people.min = 2

  // ── scope (G1) ──────────────────────────────────────────────────────────
  const scopeHints: CueParse['scopeHints'] = []
  if (/\b(sent me|forwarded|forward|whatsapp|snapchat|status|insta|instagram)\b/.test(text)) scopeHints.push('chat')
  if (/\b(meme|screenshot)\b/.test(text) && !scopeHints.includes('chat')) scopeHints.push('chat')

  // ── research-grounded confidence flags ──────────────────────────────────
  const flags: CueParse['flags'] = []
  const hasAbsolute = timeHints.some((h) => h.kind === 'absolute' && (h.months.length || h.years.length))
  if (hasAbsolute && (CONFIDENT_RE.test(text) || /\bfor sure\b/.test(text))) flags.push('confident-date')
  const TIME_WORDS = new Set(['sunset', 'night', 'morning', 'day'])
  const contentCues = tags.filter((t) => !TIME_WORDS.has(t)).length + colors.length + settings.filter((s) => s !== 'outdoor').length
  if (timeHints.length > 0 && contentCues <= 1 && events.length === 0) flags.push('time-only')
  if (VAGUAL_CUE_RE.test(text)) flags.push('visual-not-verbalizable')
  if (scopeHints.length > 0) flags.push('scope-maybe-outside')

  return {
    raw,
    timeHints,
    events: hedgedEvent && events.length === 0 ? [] : events,
    tags,
    colors,
    settings,
    people,
    scopeHints,
    flags,
  }
}
