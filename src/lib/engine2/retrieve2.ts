// v2 orchestration: score, decide, explain. Always returns the 5 closest
// living photos with probabilities; every terminal state is explained.

import { CALIBRATION } from './calibration'
import { buildClarifyQuestion, bandOf, reasonLine, scoreAll } from './score'
import type { IndexEntry } from './types'
import type {
  BandedResult, InterpretResult, QueryText, Retrieve2Response, ScoreComponents,
} from './types'

export interface Retrieve2Options {
  cue: string
  interpretation: InterpretResult
  texts: QueryText[] // raw + rewrites, each with its embedding
  clarifyAnswer?: string | null // photo id picked in the one clarifying question
  clarifyUsed?: boolean
  scoreMs?: number
  interpretMs?: number
}

const PCT = (p: number) => Math.round(p * 100)

function toBanded(s: ReturnType<typeof scoreAll>['scored'][number], interpretation: InterpretResult, cap = 0.95): BandedResult {
  const displayP = Math.min(s.prob, cap)
  const components: ScoreComponents = {
    contentZ: Math.round(s.contentZ * 100) / 100,
    contentCos: Math.round(s.cos * 10000) / 10000,
    timeBonus: Math.round(s.timeBonus * 100) / 100,
    eventBonus: Math.round(s.eventBonus * 100) / 100,
    clarifyBonus: Math.round(s.clarifyBonus * 100) / 100,
  }
  return {
    id: s.entry.id,
    file: s.entry.file,
    ts: s.entry.ts,
    source: s.entry.source as 'camera' | 'screenshot',
    deleted: s.entry.deleted,
    thumbnail: `/photos-v2/${s.entry.file}`,
    probability: Math.round(displayP * 1000) / 1000,
    band: bandOf(displayP),
    scoreComponents: components,
    reason: reasonLine(s, interpretation.time, interpretation.eventAnchor),
    hints: s.entry.hints,
    width: s.entry.width,
    height: s.entry.height,
  }
}

export interface IndexMeta { indexHash: string; modelId: string }

export function makeRetriever(entries: IndexEntry[], meta: IndexMeta = { indexHash: '', modelId: '' }) {
  return function retrieve2(opts: Retrieve2Options): Retrieve2Response {
    const started = Date.now()
    const cal = CALIBRATION
    const { cue, interpretation, texts } = opts
    const clarifyUsed = Boolean(opts.clarifyUsed || opts.clarifyAnswer)

    const { scored, nonePct, zMean, zStd } = scoreAll(entries, {
      texts,
      time: interpretation.time,
      eventAnchor: interpretation.eventAnchor,
      clarifyAnswer: opts.clarifyAnswer ?? null,
    })

    const byProb = [...scored].sort((a, b) => b.prob - a.prob)
    const living = byProb.filter((s) => !s.entry.deleted)
    const ghosts = byProb.filter((s) => s.entry.deleted)
    const top5 = living.slice(0, 5).map((s) => toBanded(s, interpretation))
    const noneIsTop = nonePct > byProb[0].prob

    const ghostTop = ghosts[0]
    const topLiving = living[0]
    const p1 = topLiving.prob
    const p2 = living[1]?.prob ?? 0
    const isScreenshot = (s: typeof topLiving) => s.entry.source === 'screenshot' || s.entry.screenshotProb > 0.5

    const trace = {
      indexHash: meta.indexHash,
      modelId: meta.modelId,
      librarySize: entries.length,
      texts: texts.map((t) => ({ role: t.role, text: t.text })),
      timeEstimate: interpretation.time,
      eventAnchor: interpretation.eventAnchor,
      contentZMean: Math.round(zMean * 10000) / 10000,
      contentZStd: Math.round(zStd * 10000) / 10000,
      clarifyUsed,
      stageMs: { interpret: opts.interpretMs ?? 0, score: opts.scoreMs ?? Date.now() - started },
      params: {
        a: cal.a, pi: cal.pi, T: cal.T, noneLogit: cal.noneLogit,
        clarifyBonus: cal.clarifyBonus, highCutoff: cal.highCutoff,
        mediumCutoff: cal.mediumCutoff, clarifyGap: cal.clarifyGap,
      },
    }

    const base = {
      nonePct: Math.round(nonePct * 1000) / 1000,
      interpretation,
      trace,
      results: top5,
    }

    // ── out of scope: the target was deleted. Existence, not a result. ──────
    if (ghostTop && ghostTop.prob >= 0.15 && ghostTop.prob >= topLiving.prob) {
      const sameCluster = living.filter((s) => s.entry.cluster === ghostTop.entry.cluster).slice(0, 3)
      return {
        ...base,
        outcome: 'out_of_scope_deleted',
        headline: 'This photo existed, but it is no longer in the library',
        explanation: 'The strongest match is a photo that was deleted. Nothing can bring a deleted photo back; saying so now saves the hopeless scrolling the research describes. Photos from the same day are still in the library.',
        existenceStatement: {
          ghost: toBanded(ghostTop, interpretation),
          note: 'Shown as an existence record only. The image is never presented as a result.',
          sameDay: sameCluster.map((s) => toBanded(s, interpretation)),
        },
      }
    }

    // ── out of scope: chat-app content ───────────────────────────────────────
    if (topLiving && isScreenshot(topLiving) && interpretation.scope === 'received') {
      return {
        ...base,
        outcome: 'out_of_scope_chat',
        headline: 'This looks like chat-app content',
        explanation: 'The closest match is a screenshot, and your description sounds like something someone sent you. That kind of photo often lives in a chat app rather than the photo library, so the search scope may be wrong.',
        scopeStatement: {
          screenshot: toBanded(topLiving, interpretation),
          note: 'Scope is checked before declaring failure: 2 of 3 research participants kept such photos in chat apps.',
        },
      }
    }

    // ── none of these is the most likely outcome ─────────────────────────────
    if (noneIsTop) {
      return {
        ...base,
        outcome: 'none_of_these',
        headline: 'Probably none of these',
        explanation: 'The closest matches are shown anyway, with the full trace of what was searched. If one of them is right after all, it is one tap away.',
      }
    }

    // ── found ────────────────────────────────────────────────────────────────
    const p1Pct = PCT(p1)
    if (p1Pct >= Math.round(cal.highCutoff * 100)) {
      return {
        ...base,
        outcome: 'found',
        headline: 'Closest matches, top confidence',
        explanation: `The top match clears the High confidence bar (${Math.round(cal.highCutoff * 100)} percent, derived on held-out practice queries). Every result shows what drove its score.`,
      }
    }

    // ── one clarifying question before committing ────────────────────────────
    if (!clarifyUsed && p1 - p2 < cal.clarifyGap && nonePct < 0.6) {
      const clarify = buildClarifyQuestion(living.slice(0, 2))
      if (clarify) {
        return {
          ...base,
          outcome: 'clarify',
          headline: 'Two moments fit. One question, then the answer',
          explanation: 'The two leading candidates are close. Instead of making you retype the query (people did not reformulate once in the live tasks), the engine asks once and re-runs with the answer.',
          clarify,
        }
      }
    }

    if (p1Pct >= Math.round(cal.mediumCutoff * 100)) {
      return {
        ...base,
        outcome: 'found',
        headline: 'Closest matches',
        explanation: 'The top match is a Medium confidence fit. The second candidate stayed close, so verify with the reasons shown on each card.',
      }
    }

    // ── honest not-found, still with the 5 closest ───────────────────────────
    return {
      ...base,
      outcome: 'not_found',
      headline: 'No confident match, these came closest',
      explanation: 'Nothing cleared the confidence bar. The five closest photos and the none-of-these probability are shown so the failure is explained, not silent.',
    }
  }
}
