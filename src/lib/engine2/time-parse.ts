// Deterministic time parser: turns the relative, event-anchored, sometimes
// wrong ways people state time into a center date plus a spread in days.
// This is the fallback when the language model is unavailable, and the
// validator for what the model returns. Never a filter: the caller treats the
// result as a soft prior.

import type { PersonaProfile, TimeEstimate } from './types'

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const MONTH_ABBR: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
}

const CONFIDENT_RE = /\b(i'?m sure|for sure|definitely|exactly|100%|certain|i remember)\b/
const HARD_DESCRIBE_RE = /\b(can'?t (really |exactly )?describe|no idea how to|don'?t remember (the|any) (words|details)|hard to describe|cannot describe)\b/

export function dayOfYear(iso: string): number {
  return Math.floor((new Date(iso + 'T00:00:00Z').getTime() - new Date(iso.slice(0, 4) + '-01-01T00:00:00Z').getTime()) / 86400000)
}

function iso(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function shiftDays(base: string, days: number): string {
  const t = new Date(base + 'T00:00:00Z').getTime() + days * 86400000
  return new Date(t).toISOString().slice(0, 10)
}

function midOfMonth(y: number, m: number): string {
  return iso(y, m, 15)
}

// Season months for an Indian persona.
const SEASONS: Record<string, number[]> = {
  summer: [2, 3, 4], // Mar-May
  monsoon: [5, 6, 7, 8], // Jun-Sep
  winter: [10, 11, 0, 1], // Nov-Feb
  spring: [9], // Oct
}

export function parseTime(raw: string, persona: PersonaProfile): TimeEstimate {
  const text = raw.toLowerCase().replace(/[',;.]/g, ' ').replace(/\s+/g, ' ').trim()
  const now = new Date(persona.referenceNow + 'T00:00:00Z')
  const nowY = now.getUTCFullYear()
  const nowM = now.getUTCMonth()
  const nowDayIso = persona.referenceNow

  const est: TimeEstimate = { center: null, spreadDays: 45, confident: false, source: 'parser', kind: 'none', matched: '' }
  const set = (center: string | null, spread: number, kind: TimeEstimate['kind'], matched: string) => {
    est.center = center
    est.spreadDays = spread
    est.kind = kind
    est.matched = matched
  }

  // ── "N years ago" / "a couple of years ago" / "a year or two ago" ─────────
  let m = text.match(/\b(\w+|\d+)\s+years?\s+ago\b/)
  if (m) {
    const wordNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, couple: 2, few: 3, some: 2, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
    const n = wordNum[m[1]] ?? Number(m[1])
    if (Number.isFinite(n) && n >= 1 && n <= 15) {
      set(shiftDays(nowDayIso, -365 * n), 120, 'relative', m[0])
    }
  }
  if (!est.center && /\b(a|one) year or two ago\b|\byear or two ago\b/.test(text)) {
    set(shiftDays(nowDayIso, -545), 200, 'relative', 'a year or two ago')
  }
  if (!est.center && /\bhalf a year ago\b/.test(text)) set(shiftDays(nowDayIso, -183), 60, 'relative', 'half a year ago')

  // ── "N months ago" / "a few months ago" / "last month" ────────────────────
  if (!est.center) {
    const mm = text.match(/\b(\w+|\d+)\s+months?\s+ago\b/)
    if (mm) {
      const wordNum: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, a: 1, couple: 2, few: 3, some: 3, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }
      const n = wordNum[mm[1]] ?? Number(mm[1])
      if (Number.isFinite(n) && n >= 1 && n <= 24) set(shiftDays(nowDayIso, -30 * n), 30 + 10 * n, 'relative', mm[0])
    }
  }
  if (!est.center && /\b(a few|some|couple of) (months|weeks) back\b/.test(text)) set(shiftDays(nowDayIso, -100), 70, 'relative', 'a few months back')
  if (!est.center && /\blast month\b/.test(text)) set(shiftDays(nowDayIso, -30), 20, 'relative', 'last month')
  if (!est.center && /\bthis month\b/.test(text)) set(nowDayIso, 15, 'relative', 'this month')
  if (!est.center && /\blast week(end)?\b/.test(text)) set(shiftDays(nowDayIso, -8), 6, 'relative', 'last week')
  if (!est.center && /\byesterday\b/.test(text)) set(shiftDays(nowDayIso, -1), 2, 'relative', 'yesterday')

  // ── seasons: "last summer", "this winter", "during monsoon 2024" ──────────
  if (!est.center) {
    const sm = text.match(/\b(last|this|past)?\s*(summer|winter|monsoon|spring)(?:\s+(20\d\d))?\b/)
    if (sm) {
      const which = sm[1] ?? 'last'
      const season = sm[2]
      const year = sm[3] ? Number(sm[3]) : which === 'this' ? nowY : nowY - 1
      const months = SEASONS[season]
      // center = middle month of the season, mid-month
      const midM = months[Math.floor((months.length - 1) / 2)]
      let cy = year
      if (season === 'winter' && !sm[3] && nowM >= 9) cy = nowY - 1
      if (midM > nowM && which === 'last' && !sm[3] && cy === nowY) cy -= 1
      set(midOfMonth(cy, midM), 16 * months.length + 14, 'season', sm[0].trim())
    }
  }

  // ── birthday anchor: "around my birthday", "my birthday 2025" ─────────────
  if (!est.center) {
    const bm = text.match(/\b(before|after|around|near|during|on|close to)?\s*(my|the)?\s*birthday(?:\s+(?:in\s+)?(20\d\d))?\b/)
    if (bm && (bm[2] || bm[0])) {
      const ym = text.match(/\b(20\d\d)\b/)
      const year = ym ? Number(ym[1]) : (() => {
        // most recent June 14 that is not in the future
        const cand = new Date(Date.UTC(nowY, persona.birthday.month - 1, persona.birthday.day))
        return cand > now ? nowY - 1 : nowY
      })()
      const bd = iso(year, persona.birthday.month - 1, persona.birthday.day)
      if (bm[1] === 'before') set(shiftDays(bd, -30), 40, 'anchor', bm[0].trim())
      else if (bm[1] === 'after') set(shiftDays(bd, 30), 40, 'anchor', bm[0].trim())
      else set(bd, 20, 'anchor', bm[0].trim())
    }
  }

  // ── festival and life-event anchors via the shared matcher ────────────────
  if (!est.center) {
    const m = matchEventAnchor(raw, persona)
    if (m) set(m.date, 4, 'event', m.label)
  }

  // ── absolute months / years ───────────────────────────────────────────────
  if (!est.center) {
    const ym = text.match(/\b(20\d\d)\b/)
    const monthNames = MONTHS.filter((mo) => new RegExp(`\\b${mo}\\b`).test(text)).map((mo) => MONTHS.indexOf(mo))
    for (const [abbr, idx] of Object.entries(MONTH_ABBR)) {
      if (new RegExp(`\\b${abbr}\\b`).test(text) && !monthNames.includes(idx)) monthNames.push(idx)
    }
    monthNames.sort((a, b) => a - b)
    if (ym && monthNames.length) set(midOfMonth(Number(ym[1]), monthNames[0]), 18, 'absolute', `${MONTHS[monthNames[0]]} ${ym[1]}`)
    else if (ym) set(midOfMonth(Number(ym[1]), 5), 183, 'absolute', ym[1])
    else if (monthNames.length) {
      // most recent occurrence of that month
      const mo = monthNames[0]
      let cy = nowM > mo || (nowM === mo) ? nowY : nowY - 1
      if (/\bnext\b/.test(text)) cy = nowY + 1
      set(midOfMonth(cy, mo), 18, 'absolute', MONTHS[mo])
    }
  }

  // ── sequencing relative to an event: "the day before the wedding" ─────────
  if (est.center && /\bthe day (before|after)\b/.test(text) && est.kind === 'event') {
    const delta = text.includes('before') ? -1 : 1
    est.center = shiftDays(est.center, delta)
    est.spreadDays = 2
  }

  est.confident = CONFIDENT_RE.test(text)
  if (!est.center) est.spreadDays = 0
  return est
}

export function looksHardToDescribe(raw: string): boolean {
  return HARD_DESCRIBE_RE.test(raw.toLowerCase())
}

export function looksReceived(raw: string): boolean {
  const text = raw.toLowerCase()
  return /\b(sent|forwarded|forward|shared|whatsapp|status|insta|instagram|dm|texted|ma (sent|forwarded)|someone sent)\b/.test(text)
}

export function looksGroup(raw: string): boolean {
  return /\b(we|us|friends|family|everyone|together|group|all of)\b/.test(raw.toLowerCase())
}

// ── Event-anchor resolution (shared by the parser and the interpreter) ──────
const ANCHOR_STOP = new Set(['the', 'a', 'an', 'my', 'at', 'in', 'on', 'of', 'to', 'was', 'were', 'is', 'and', 'for', 'with', 'last', 'this', 'that', 'trip', 'day'])

export interface AnchorMatch { key: string; label: string; date: string; score: number }

export function matchEventAnchor(text: string, persona: PersonaProfile): AnchorMatch | null {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const isYear = (w: string) => /^20\d\d$/.test(w)
  const t = norm(text)
  const tokens = new Set(t.split(' ').filter((w) => w.length > 2 && !ANCHOR_STOP.has(w) && !isYear(w)))
  const yearMatch = text.match(/\b(20\d\d)\b/)
  const now = new Date(persona.referenceNow + 'T00:00:00Z')
  let best: AnchorMatch | null = null
  for (const imp of persona.importantDates) {
    const labelTokens = norm(imp.label).split(' ').filter((w) => w.length > 2 && !ANCHOR_STOP.has(w) && !isYear(w))
    const keyTokens = norm(imp.key.replace(/-/g, ' ')).split(' ').filter((w) => w.length > 2 && !ANCHOR_STOP.has(w) && !isYear(w))
    const overlap = labelTokens.filter((w) => tokens.has(w)).length + keyTokens.filter((w) => tokens.has(w)).length
    if (overlap === 0) continue
    let score = overlap
    // A stated year must agree with the profile date; otherwise demote.
    if (yearMatch && imp.label.includes(yearMatch[1])) score += 2
    else if (yearMatch && !imp.label.includes(yearMatch[1])) score -= 2
    // Extra label words present in the text strengthen the match (e.g. "lake").
    const extra = labelTokens.filter((w) => tokens.has(w)).length
    if (extra > 1) score += extra - 1
    const notFuture = new Date(imp.date + 'T00:00:00Z') <= now
    if (!notFuture) score -= 1
    if (!best || score > best.score || (score === best.score && imp.date > best.date)) {
      best = { key: imp.key, label: imp.label, date: imp.date, score }
    }
  }
  return best && best.score > 0 ? best : null
}
