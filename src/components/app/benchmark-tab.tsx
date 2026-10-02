'use client'

// Benchmark: replay the eight research-grounded cue cases through the engine
// and show the classic-keyword baseline side by side. Served by /api/benchmark.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  Loader2,
  Search,
  SearchX,
  Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PhotoThumb } from './photo-card'
import type { CaseOutcome } from '@/lib/engine/benchmark'
import type { RetrievalResult } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

interface BenchmarkResponse {
  outcomes: CaseOutcome[]
  summary: {
    cases: number
    found: number
    outOfScopeExplained: number
    honestNotFound: number
    clarificationsUsed: number
    classicFound: number
    classicSilent: number
  }
}

const KIND_BADGE: Record<string, { label: string; className: string }> = {
  found: { label: 'found', className: 'border-chart-3/40 bg-chart-3/[0.1] text-foreground' },
  clarify: { label: 'clarified once', className: 'border-primary/40 bg-primary/[0.08] text-foreground' },
  not_found: { label: 'honest not-found', className: 'border-border bg-muted text-foreground/80' },
  out_of_scope_deleted: { label: 'out of scope: deleted', className: 'border-destructive/35 bg-destructive/[0.08] text-foreground' },
  out_of_scope_chat: { label: 'out of scope: chat app', className: 'border-chart-4/45 bg-chart-4/[0.1] text-foreground' },
}

export function BenchmarkTab() {
  const [data, setData] = useState<BenchmarkResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCase, setOpenCase] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/benchmark')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d as BenchmarkResponse)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load benchmark.'))
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Benchmark: the research, replayed</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Eight cue cases built from the study: three mirror the live think-aloud tasks (P1 to P3), the rest embody
        individual insights (confident wrong dates 2c, non-verbalizable visual memory 2d, chat-app scope G1).
        The classic column is a literal keyword search over the same library: every content word of the query must
        appear in the photo&apos;s searchable text, and deleted photos are invisible to it. In the live study,
        the baseline outcome was 0 of 3 finds with 0 reformulations.
      </p>

      {error && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden /> {error}
        </p>
      )}

      {!data && !error && (
        <div className="mt-10 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Replaying the cases through the engine…
        </div>
      )}

      {data && (
        <>
          {/* Summary strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Cases resolved with an explanation" value={`${data.summary.cases - data.summary.honestNotFound}/${data.summary.cases}`} sub="found or out-of-scope, stated" />
            <Stat label="Found outright" value={`${data.summary.found}`} sub="plus 1 honest failure, fully traced" />
            <Stat label="Clarifications used" value={`${data.summary.clarificationsUsed}`} sub="budget: one per case, max" />
            <Stat label="Classic search silent-fails" value={`${data.summary.classicSilent}/${data.summary.cases}`} sub={`${data.summary.classicFound} case works, kept on purpose`} />
          </div>

          {/* Case cards */}
          <div className="mt-8 space-y-4">
            {data.outcomes.map((o, i) => (
              <motion.article
                key={o.case.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.05, duration: 0.35 }}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  onClick={() => setOpenCase((v) => (v === o.case.id ? null : o.case.id))}
                  className="flex w-full items-start justify-between gap-4 p-5 text-left"
                  aria-expanded={openCase === o.case.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold tracking-tight sm:text-lg">{o.case.title}</h2>
                      {o.ok ? (
                        <Badge variant="outline" className="gap-1 rounded-full border-chart-3/40 text-[11px] text-foreground/80">
                          <BadgeCheck className="h-3 w-3 text-chart-3" aria-hidden /> engine check
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-destructive/40 text-[11px]">unexpected</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 max-w-2xl text-sm italic leading-relaxed text-muted-foreground">&ldquo;{o.case.cue}&rdquo;</p>
                    <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted-foreground/90">{o.case.groundedIn}</p>
                  </div>
                  <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', openCase === o.case.id && 'rotate-180')} aria-hidden />
                </button>

                {openCase === o.case.id && (
                  <div className="border-t border-border/70 p-5">
                    <div className="grid gap-5 lg:grid-cols-2">
                      {/* Classic baseline */}
                      <div className="rounded-xl border border-border bg-background p-4">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <SearchX className="h-3.5 w-3.5" aria-hidden /> Classic keyword box
                        </p>
                        <p className="mt-2.5 font-mono text-xs text-muted-foreground">
                          tokens: [{o.classic.tokens.slice(0, 8).join(', ')}{o.classic.tokens.length > 8 ? ', …' : ''}]
                        </p>
                        <p className="mt-2 text-2xl font-semibold">
                          {o.classic.count} result{o.classic.count === 1 ? '' : 's'}
                        </p>
                        {o.classic.samples.length > 0 && (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{o.classic.samples.map((s) => s.id).join(', ')}</p>
                        )}
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{o.case.classicNote}</p>
                      </div>

                      {/* Prototype */}
                      <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
                        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                          <Search className="h-3.5 w-3.5" aria-hidden /> Cue-first workflow
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn('rounded-full text-[11px]', KIND_BADGE[o.final.decision.kind]?.className)}>
                            {KIND_BADGE[o.final.decision.kind]?.label ?? o.final.decision.kind}
                          </Badge>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {o.final.metrics.passes} pass{o.final.metrics.passes > 1 ? 'es' : ''} · {o.final.metrics.clarificationsUsed} clarif. · {o.final.metrics.elapsedMs} ms
                          </span>
                        </div>
                        <p className="mt-2.5 text-sm leading-relaxed text-foreground/85">{compactExplanation(o.final)}</p>
                        {o.firstRun.decision.kind === 'clarify' && (
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            Asked once: &ldquo;{o.firstRun.decision.clarify?.question}&rdquo; Answer used: {o.case.clarifyAlbum ?? 'none of these'}.
                          </p>
                        )}
                        {o.final.decision.results.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {o.final.decision.results.slice(0, 4).map((s) => (
                              <PhotoThumb key={s.photo.id} photo={s.photo} className="h-20 w-16 shrink-0" sizes="80px" />
                            ))}
                          </div>
                        )}
                        {o.final.decision.closest && o.final.decision.closest.length > 0 && (
                          <div className="mt-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">closest, with the trace attached</p>
                            <div className="mt-2 flex gap-2">
                              {o.final.decision.closest.map((s) => (
                                <PhotoThumb key={s.photo.id} photo={s.photo} className="h-20 w-16 shrink-0" sizes="80px" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.article>
            ))}
          </div>

          <p className="mt-8 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            The classic baseline is a simulation of literal keyword matching, run honestly over the same synthetic
            library; real libraries are thousands of times larger, where silent misses are harder to escape by
            scrolling. The engine column is the real deterministic engine this prototype ships, not a mock.
          </p>
        </>
      )}
    </div>
  )
}

function compactExplanation(r: RetrievalResult): string {
  const d = r.decision
  if (d.kind === 'found') {
    const top = d.results[0]
    const reasons = top?.evidence.slice(0, 2).map((e) => e.text).join('; ')
    return `Top: ${top?.photo.id}. ${d.headline} via "${r.hypotheses.find((h) => h.id === top?.via)?.label}". ${reasons ? `Because: ${reasons}.` : ''}${top?.dateRecovered ? ` Date recovered (${top.dateRecovered.guessed} → ${top.dateRecovered.actual}).` : ''}`
  }
  if (d.kind === 'out_of_scope_deleted') return d.explanation.split(' Nothing can retrieve')[0] + '.'
  if (d.kind === 'out_of_scope_chat') return `Top: ${d.results[0]?.photo.id}. Scope checked before calling it a failure.`
  if (d.kind === 'clarify') return 'Evidence split across moments; one question with candidates attached.'
  return 'Nothing cleared the bar; closest candidates and full trace provided.'
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="font-display text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-medium leading-snug">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  )
}
