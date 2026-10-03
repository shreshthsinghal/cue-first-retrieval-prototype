'use client'

// The v2 Retrieve tab: cue box (not a search box), progressive results,
// calibrated confidence with bands, "Understood as" chips (the recovery path),
// the interpreter label, one clarifying question, and explained terminal
// states (ghost, chat scope, none of these).

import { useEffect, useMemo, useState } from 'react'
import { Clock, Info, Pencil, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import { useEncoder } from './use-encoder'
import { useSearch, type IndexPayload } from './use-search'
import type { BandedResult, InterpretResult } from '@/lib/engine2/types'
import { cn } from '@/lib/utils'

const CONFIDENCE_DEFINITION =
  'An estimate of the chance this is the photo you meant, based on tests with practice queries. It is a guide, not a promise.'

function Band({ band }: { band: 'High' | 'Medium' | 'Low' }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        band === 'High' && 'bg-emerald-100 text-emerald-800',
        band === 'Medium' && 'bg-amber-100 text-amber-800',
        band === 'Low' && 'bg-stone-200 text-stone-600',
      )}
    >
      {band}
    </span>
  )
}

function ResultCard({ r, rank }: { r: BandedResult; rank: number }) {
  const pct = Math.round(r.probability * 100)
  return (
    <figure className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={r.thumbnail}
          alt={r.hints.join(', ') || 'library photo'}
          loading={rank < 2 ? 'eager' : 'lazy'}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white" title={CONFIDENCE_DEFINITION}>
          {pct}% <Band band={r.band} />
        </span>
      </div>
      <figcaption className="space-y-1 p-2.5">
        <p className="line-clamp-2 text-xs leading-snug text-foreground/90">{r.reason}</p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(r.ts.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' · '}
          <span title={CONFIDENCE_DEFINITION} className="cursor-help underline decoration-dotted underline-offset-2">what does this % mean?</span>
        </p>
      </figcaption>
    </figure>
  )
}

function GhostCard({ r }: { r: BandedResult }) {
  return (
    <figure className="relative w-40 shrink-0 overflow-hidden rounded-xl border border-dashed border-border">
      <div className="relative aspect-[4/3] bg-stone-200 grayscale">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.thumbnail} alt="deleted photo (existence record only)" loading="lazy" className="h-full w-full object-cover opacity-60" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-[11px] font-semibold text-white">deleted</span>
      </div>
      <figcaption className="p-2 text-[11px] text-muted-foreground">
        matched at {Math.round(r.probability * 100)}% confidence, but never shown as a result
      </figcaption>
    </figure>
  )
}

function InterpretChips({ interpretation, onChange, onRerun }: {
  interpretation: InterpretResult
  onChange: (next: InterpretResult) => void
  onRerun: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<InterpretResult>(interpretation)

  useEffect(() => setDraft(interpretation), [interpretation])

  const commit = () => { onChange(draft); setEditing(false); onRerun() }

  const view = (
    <div className="flex flex-wrap items-center gap-1.5">
      {interpretation.rewrites.length === 0 && interpretation.time.source === 'none' && !interpretation.eventAnchor && (
        <span className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground">
          taken as written: no rewrite or date detected
        </span>
      )}
      {interpretation.rewrites.map((rw, i) => (
        <span key={i} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />{rw}
        </span>
      ))}
      {interpretation.time.center && (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
          <Clock className="mr-1 inline h-3 w-3" aria-hidden />
          around {new Date(interpretation.time.center.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' '}±{interpretation.time.spreadDays}d
          {interpretation.time.source === 'llm' ? ' (model)' : ' (parser)'}
        </span>
      )}
      {interpretation.eventAnchor && (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
          {interpretation.eventAnchor.label}
        </span>
      )}
      {interpretation.scope === 'received' && (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">sounds received or forwarded</span>
      )}
      <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
        <Pencil className="h-3 w-3" aria-hidden /> edit and re-run
      </button>
    </div>
  )

  const editor = (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <p className="text-xs font-medium text-foreground/80">What the engine understood. Remove or change anything, then re-run. Editing a chip is the recovery path after a miss.</p>
      <div className="space-y-1.5">
        <label className="block text-xs text-muted-foreground" htmlFor="rw-edit">Visual descriptions (one per line)</label>
        <textarea
          id="rw-edit"
          className="w-full rounded-lg border border-border bg-background p-2 text-sm"
          rows={3}
          value={draft.rewrites.join('\n')}
          onChange={(e) => setDraft({ ...draft, rewrites: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3) })}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-muted-foreground">
          Date
          <input
            type="date"
            className="ml-2 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
            value={draft.time.center ?? ''}
            onChange={(e) => setDraft({ ...draft, time: { ...draft.time, center: e.target.value || null, source: draft.time.source } })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Spread (days)
          <input
            type="number"
            min={0}
            max={400}
            className="ml-2 w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
            value={draft.time.center ? draft.time.spreadDays : 0}
            onChange={(e) => setDraft({ ...draft, time: { ...draft.time, spreadDays: Math.max(0, Math.min(400, Number(e.target.value) || 0)) } })}
          />
        </label>
        {draft.eventAnchor && (
          <button
            className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setDraft({ ...draft, eventAnchor: null })}
          >
            <X className="h-3 w-3" aria-hidden /> remove event anchor: {draft.eventAnchor.label}
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={commit} className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          <RefreshCw className="h-3 w-3" aria-hidden /> re-run with these
        </button>
        <button onClick={() => setEditing(false)} className="rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">cancel</button>
      </div>
    </div>
  )

  return editing ? editor : view
}

function Trace({ final }: { final: NonNullable<ReturnType<typeof useSearch>['state']['final']> }) {
  const t = final.trace
  return (
    <details className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none text-foreground/80">Full search trace</summary>
      <div className="mt-2 space-y-1">
        <p>index {t.indexHash} · model {t.modelId} · {t.librarySize} searchable photos</p>
        <p>stage latencies: interpret {t.stageMs.interpret} ms · score {t.stageMs.score} ms</p>
        <p>fitted parameters: a={t.params.a}, pi={t.params.pi}, T={t.params.T}, noneLogit={t.params.noneLogit}, clarifyGap={t.params.clarifyGap}</p>
        <p>content z: mean {t.contentZMean}, std {t.contentZStd} (standardized within this query)</p>
        <p>texts used: {t.texts.map((x) => `"${x.text.slice(0, 60)}" (${x.role})`).join('; ')}</p>
        <p>clarification used: {t.clarifyUsed ? 'yes' : 'no'}</p>
      </div>
    </details>
  )
}

export function RetrieveTabV2() {
  const [index, setIndex] = useState<IndexPayload | null>(null)
  const [cue, setCue] = useState('')
  const encoder = useEncoder()
  const { state, search, rerunWithInterpretation, answerClarify, reset } = useSearch(index, encoder.state === 'ready' ? encoder.embed : null)
  const [editedInterpretation, setEditedInterpretation] = useState<InterpretResult | null>(null)

  useEffect(() => {
    fetch('/api/index').then((r) => r.json()).then(setIndex).catch(() => setIndex(null))
  }, [])

  const canSearch = encoder.state === 'ready' && cue.trim().length > 0 && state.phase !== 'encoding'

  const submit = () => {
    if (!canSearch) return
    setEditedInterpretation(null)
    void search(cue.trim())
  }

  const final = state.final
  const shownResults: BandedResult[] = useMemo(() => {
    if (state.phase === 'final' && final) return final.results
    if (state.phase === 'provisional') {
      return state.provisional.map((p) => ({
        id: p.id, file: p.file, ts: '', source: 'camera' as const, deleted: false,
        thumbnail: `/photos-v2/${p.file}`, probability: 0, band: 'Low' as const,
        scoreComponents: { contentZ: 0, contentCos: p.cos, timeBonus: 0, eventBonus: 0, clarifyBonus: 0 },
        reason: '', hints: [], width: 0, height: 0,
      }))
    }
    return []
  }, [state.phase, state.provisional, final])

  const interpretationForChips = editedInterpretation ?? state.interpretation

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* ── Cue box ─────────────────────────────────────────────── */}
      <section aria-label="Describe the memory">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Describe the memory. Any way it comes.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Fragments, relative time, a wrong date, a color you half remember. This is not a keyword box: the search runs on what the scene probably looked like.
        </p>
        <div className="mt-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <textarea
            value={cue}
            onChange={(e) => setCue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
            rows={3}
            maxLength={600}
            placeholder="e.g. the one where we were all laughing near the water at sunset, maybe two years ago"
            className="w-full resize-none bg-transparent p-2 text-base outline-none placeholder:text-muted-foreground/70"
          />
          <div className="flex items-center justify-between gap-3 px-1 pt-1">
            <p className="text-xs text-muted-foreground">
              {encoder.state === 'loading' && `Loading the search model, about 65 MB, first visit only... ${encoder.pct}%`}
              {encoder.state === 'ready' && 'Search model ready. The interpretation model is optional and separate.'}
              {encoder.state === 'error' && `Search model failed to load: ${encoder.error}. The API alone cannot run without it in this build.`}
              {encoder.state === 'idle' && 'Preparing the search model...'}
            </p>
            <button
              onClick={submit}
              disabled={!canSearch}
              className={cn(
                'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all',
                canSearch ? 'bg-primary text-primary-foreground hover:opacity-90' : 'cursor-not-allowed bg-stone-200 text-stone-400',
              )}
            >
              <Search className="h-4 w-4" aria-hidden />
              {state.phase === 'encoding' || state.phase === 'provisional' ? 'Searching...' : 'Find the photo'}
            </button>
          </div>
        </div>
      </section>

      {state.phase === 'error' && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{state.error}</p>
      )}

      {/* ── Results ─────────────────────────────────────────────── */}
      {(state.phase === 'provisional' || state.phase === 'final') && (
        <section className="mt-8" aria-label="Closest matches">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-xl font-semibold">
              {state.phase === 'provisional' ? 'Provisional matches (before interpretation)' : 'Closest matches'}
            </h2>
            {state.phase === 'final' && state.updatedNote && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">updated with the interpretation</span>
            )}
          </div>

          {state.phase === 'provisional' && (
            <p className="mt-1 text-xs text-muted-foreground">Ranked by visual similarity only. Confidence and interpretation arrive next; the model never blocks the first results.</p>
          )}

          {state.phase === 'final' && final && (
            <>
              {final.interpretation && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Understood as</h3>
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                        final.interpretation.interpretedBy === 'ai-model' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800',
                      )}
                      title={final.interpretation.reason}
                    >
                      <Info className="h-3 w-3" aria-hidden />
                      {final.interpretation.interpretedBy === 'ai-model'
                        ? `Interpreted by: AI model (${final.interpretation.llmMs} ms)`
                        : 'Interpreted by: basic parser (model unavailable)'}
                    </span>
                    {final.interpretation.interpretedBy !== 'ai-model' && (
                      <span className="text-xs text-muted-foreground">reason: {final.interpretation.reason}</span>
                    )}
                  </div>
                  {interpretationForChips && (
                    <InterpretChips
                      interpretation={interpretationForChips}
                      onChange={(next) => setEditedInterpretation(next)}
                      onRerun={() => {
                        if (editedInterpretation) void rerunWithInterpretation(editedInterpretation)
                      }}
                    />
                  )}
                  {final.interpretation.note.map((n, i) => (
                    <p key={i} className="mt-1.5 text-xs text-muted-foreground">{n}</p>
                  ))}
                </div>
              )}

              {final.outcome === 'out_of_scope_deleted' && final.existenceStatement && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">{final.headline}</p>
                  <p className="mt-1 text-sm text-amber-900/90">{final.explanation}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <GhostCard r={final.existenceStatement.ghost} />
                    <div className="space-y-1 text-xs text-amber-900/80">
                      {final.existenceStatement.sameDay.map((s) => (
                        <p key={s.id}>same day, still in the library: <button className="underline" onClick={() => window.open(s.thumbnail, '_blank')}>{s.id}</button></p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {final.outcome === 'out_of_scope_chat' && final.scopeStatement && (
                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm font-semibold text-sky-900">{final.headline}</p>
                  <p className="mt-1 text-sm text-sky-900/90">{final.explanation}</p>
                </div>
              )}

              {final.outcome === 'none_of_these' && (
                <div className="mt-4 rounded-xl border border-stone-300 bg-stone-50 p-4">
                  <p className="text-sm font-semibold">{final.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{final.explanation}</p>
                </div>
              )}

              {final.outcome === 'clarify' && final.clarify && (
                <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <p className="text-sm font-semibold text-indigo-900">{final.clarify.question}</p>
                  <p className="mt-1 text-xs text-indigo-900/80">{final.clarify.note}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {final.clarify.options.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => void answerClarify(o.id)}
                        className="w-36 overflow-hidden rounded-xl border border-indigo-200 bg-white text-left transition-shadow hover:shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={o.thumbnail} alt={o.label} className="aspect-[4/3] w-full object-cover" />
                        <span className="block p-2 text-xs font-medium">{o.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {final.outcome === 'not_found' && (
                <div className="mt-4 rounded-xl border border-stone-300 bg-stone-50 p-4">
                  <p className="text-sm font-semibold">{final.headline}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{final.explanation}</p>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {shownResults.map((r, i) => <ResultCard key={r.id} r={r} rank={i} />)}
              </div>

              {state.phase === 'final' && final && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p className="rounded-full bg-stone-100 px-3 py-1.5 text-sm">
                    <span className="font-semibold">None of these: {Math.round(final.nonePct * 100)}%</span>
                    <span className="ml-1 text-xs text-muted-foreground">the estimated chance the photo is not in this library</span>
                  </p>
                  {final.outcome === 'found' && <p className="text-xs text-muted-foreground">{final.explanation}</p>}
                </div>
              )}

              <div className="mt-5">
                <Trace final={final} />
              </div>
            </>
          )}
        </section>
      )}

      {state.phase === 'idle' && (
        <section className="mt-10 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3" aria-label="How it works">
          <div className="rounded-xl border border-border bg-card p-4"><p className="font-medium text-foreground">Every query returns the 5 closest photos</p><p className="mt-1 text-xs">with a calibrated confidence and a band, plus the chance that none of them is right. Never an empty result.</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="font-medium text-foreground">Time is a soft clue, never a filter</p><p className="mt-1 text-xs">a confident wrong date lowers a prior; it can never hide a photo. The engine reformulates for you.</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="font-medium text-foreground">Every failure is explained</p><p className="mt-1 text-xs">deleted photos get an existence statement, chat content gets a scope warning, misses get the closest matches anyway.</p></div>
        </section>
      )}
    </div>
  )
}
