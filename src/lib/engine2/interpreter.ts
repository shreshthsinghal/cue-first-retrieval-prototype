// Stage A: understand the cue.
// Optional language-model pass with a hard timeout, plus the deterministic
// fallback. The model is never given the library's vocabulary: it answers
// with free-form visual captions and structured time, and anything it returns
// is validated before use. No silent fallback: the caller receives the reason.

import { parseTime, looksHardToDescribe, looksReceived, looksGroup, matchEventAnchor } from './time-parse'
import type { EventAnchor, InterpretResult, PersonaProfile, TimeEstimate } from './types'

const TIMEOUT_MS = 4000

const SYSTEM_PROMPT = `You interpret raw photo-search cues for a photo retrieval engine. People describe a photo the way memory keeps it: relative time, life events, visual fragments, sometimes a wrong date. Today is 2026-10-01.

Respond with ONLY a JSON object, no prose, in exactly this shape:
{
  "rewrites": ["a short visual caption of what the photo probably looks like", "another possible look"],
  "time": { "center": "YYYY-MM-DD" | null, "spreadDays": 30, "confident": false },
  "eventAnchor": "a short label like my birthday 2025, Anjali's wedding, the trek" | null,
  "scope": "own" | "received" | null,
  "peopleHint": "alone" | "group" | null
}

Rules:
- rewrites: 1 to 3 captions describing the likely VISUALS (scene, objects, people, lighting). Plain descriptive English. Never invent brand names or full names of people.
- time.center: your best single guess for when the photo was taken, resolving relative phrases against today. null if there is no time cue at all.
- time.spreadDays: how wide the uncertainty around that guess is (e.g. 20 for "around my birthday", 90 for "a year or two ago", 1 for "I know the exact date").
- time.confident: true only if the person asserts the date with confidence.
- eventAnchor: a named life event the person refers to (birthday, wedding, trek, trip, festival, graduation), with its year if stated. null if none.
- scope: "received" if the photo sounds like content someone else sent or forwarded (memes, tickets, screenshots). Otherwise "own" or null.
- peopleHint: "group" if the cue implies other people (we, friends, family), "alone" otherwise. null if unclear.
- Omit nothing: always return every key.`

interface LlmFrame {
  rewrites?: unknown
  time?: unknown
  eventAnchor?: unknown
  scope?: unknown
  peopleHint?: unknown
}

export interface LlmStatus {
  configured: boolean
  provider: 'openai-compatible' | 'z-ai-sdk' | 'none'
}

export function llmStatus(): LlmStatus {
  if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) return { configured: true, provider: 'openai-compatible' }
  // The z-ai sdk self-configures in environments that provide .z-ai-config and
  // reads ZAI_CONFIG on hosted deploys. Whether it works is only known by
  // calling it: interpretCue reports the failure reason if it does not.
  return { configured: false, provider: 'z-ai-sdk' }
}

export function extractJson(text: string): LlmFrame | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const src = fenced ? fenced[1] : text
  const start = src.indexOf('{')
  const end = src.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(src.slice(start, end + 1)) as LlmFrame
  } catch {
    return null
  }
}

async function callOpenAiCompatible(raw: string): Promise<string> {
  const base = process.env.LLM_BASE_URL!.replace(/\/$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: raw },
      ],
      temperature: 0.2,
      max_tokens: 400,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`provider http ${res.status}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callZaiSdk(raw: string): Promise<string> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk')
  const envConfig = process.env.ZAI_CONFIG
  // The sdk's constructor is typed private but is the documented entry point
  // (the same pattern the v1 parser ships). Construct via a cast; the sdk
  // exposes both a constructor (with config) and a static create().
  const Ctor = ZAI as unknown as (new (config?: unknown) => {
    chat: { completions: { create: (opts: unknown) => Promise<{ choices?: Array<{ message?: { content?: string } }> }> } }
  }) & { create: () => Promise<InstanceType<never>> }
  const zai = envConfig ? new Ctor(JSON.parse(envConfig)) : await Ctor.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: SYSTEM_PROMPT },
      { role: 'user', content: raw },
    ],
    thinking: { type: 'disabled' },
  })
  return completion.choices?.[0]?.message?.content ?? ''
}

function validDate(s: unknown): string | null {
  if (typeof s !== 'string') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  if (y < 2015 || y > 2027) return null
  return s
}

function coerceTime(frame: LlmFrame): TimeEstimate | null {
  const t = frame.time as { center?: unknown; spreadDays?: unknown; confident?: unknown } | null
  if (!t || typeof t !== 'object') return null
  const center = validDate(t.center)
  let spread = Number(t.spreadDays)
  if (!Number.isFinite(spread)) spread = center ? 30 : 0
  spread = Math.max(0, Math.min(400, Math.round(spread)))
  return { center, spreadDays: center ? spread : 0, confident: t.confident === true, source: 'llm', kind: center ? 'absolute' : 'none' }
}

function coerceRewrites(frame: LlmFrame): string[] {
  const arr = Array.isArray(frame.rewrites) ? frame.rewrites : []
  return arr
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 3)
    .map((r) => r.trim().slice(0, 140))
    .slice(0, 3)
}

/**
 * Interpret the cue. Never throws: any failure produces the deterministic
 * interpretation plus a reason string that the UI shows verbatim.
 */
export async function interpretCue(raw: string, persona: PersonaProfile): Promise<InterpretResult> {
  const started = Date.now()
  const parserTime = parseTime(raw, persona)
  const notes: string[] = []
  if (parserTime.confident && parserTime.center) {
    notes.push('You stated the date with confidence. The engine still treats time as a soft clue: dates held with confidence were often wrong in the research.')
  }
  if (looksHardToDescribe(raw)) {
    notes.push('Hard to put into words, and that is fine: the search runs on what the scene probably looked like, not on keywords.')
  }
  if (looksReceived(raw)) {
    notes.push('This sounds like content someone sent you. If the best match is a screenshot, the app will say it probably lives in a chat app.')
  }

  const status = llmStatus()
  if (!status.configured && status.provider !== 'z-ai-sdk') {
    return {
      rewrites: [],
      time: parserTime,
      eventAnchor: (() => {
        const m = matchEventAnchor(raw, persona)
        return m ? { key: m.key, label: m.label, date: m.date } : null
      })(),
      scope: looksReceived(raw) ? 'received' : null,
      peopleHint: looksGroup(raw) ? 'group' : 'alone',
      interpretedBy: 'basic-parser',
      reason: 'model unavailable: no interpreter is configured on this deployment',
      llmMs: 0,
      note: notes,
    }
  }

  let frame: LlmFrame | null = null
  let reason = 'ok'
  try {
    const call = (status.provider === 'openai-compatible' ? callOpenAiCompatible(raw) : callZaiSdk(raw))
      // A late failure after the timeout won the race must not crash the process.
      .catch((e) => { throw new Error(e instanceof Error ? e.message.slice(0, 80) : 'model unavailable') })
    const text = await Promise.race([
      call,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
    ])
    frame = extractJson(text)
    if (!frame) reason = 'model returned a malformed frame; the basic parser took over'
  } catch (err) {
    reason = err instanceof Error && err.message === 'timeout'
      ? `model did not answer within ${TIMEOUT_MS / 1000} s; the basic parser took over`
      : `model unavailable (${err instanceof Error ? err.message : 'unknown error'}); the basic parser took over`
  }

  if (!frame) {
    return {
      rewrites: [],
      time: parserTime,
      eventAnchor: (() => {
        const m = matchEventAnchor(raw, persona)
        return m ? { key: m.key, label: m.label, date: m.date } : null
      })(),
      scope: looksReceived(raw) ? 'received' : null,
      peopleHint: looksGroup(raw) ? 'group' : 'alone',
      interpretedBy: 'basic-parser',
      reason,
      llmMs: Date.now() - started,
      note: notes,
    }
  }

  const llmTime = coerceTime(frame)
  const time: TimeEstimate = llmTime?.center
    ? llmTime
    : parserTime.center
      ? parserTime
      : { center: null, spreadDays: 0, confident: false, source: 'parser', kind: 'none', matched: '' }
  const anchor = matchEventAnchor(String(frame.eventAnchor ?? raw), persona)
    ? { key: matchEventAnchor(String(frame.eventAnchor ?? raw), persona)!.key, label: matchEventAnchor(String(frame.eventAnchor ?? raw), persona)!.label, date: matchEventAnchor(String(frame.eventAnchor ?? raw), persona)!.date }
    : null
  const scope = frame.scope === 'received' || looksReceived(raw) ? 'received' : frame.scope === 'own' ? 'own' : null
  const peopleHint = looksGroup(raw) || frame.peopleHint === 'group' ? 'group' : frame.peopleHint === 'alone' ? 'alone' : null

  return {
    rewrites: coerceRewrites(frame),
    time,
    eventAnchor: anchor,
    scope,
    peopleHint,
    interpretedBy: 'ai-model',
    reason: 'ok',
    llmMs: Date.now() - started,
    note: notes,
  }
}
