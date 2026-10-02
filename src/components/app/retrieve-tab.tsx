'use client'

// The Retrieve flow: Move 1 accept the memory as-is; Move 2 show the parse
// and the parallel hypotheses; Move 3 one clarification at most; Move 4 every
// outcome explained with evidence chips and a full search trace.

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  Clock,
  Eye,
  Layers,
  Lightbulb,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EvidenceChips, PhotoThumb } from './photo-card'
import type { RetrievalResult, ScoredPhoto } from '@/lib/engine/types'
import { cn } from '@/lib/utils'

const EXAMPLES: Array<{ label: string; cue: string }> = [
  { label: 'red dress, near water, around my birthday', cue: 'Around my birthday last summer. She was wearing red. Near the water.' },
  { label: 'beach wedding, June 2024, for sure', cue: 'June 2024, for sure. It was a beach wedding.' },
  { label: 'blowing candles, water behind her, around April', cue: "It was around April I think... no wait, I'm sure it was April. She was blowing out candles with the water behind her." },
  { label: 'outdoor trip, a year or two ago, cannot describe it', cue: "It was outdoors, some kind of trip I think, maybe a year or two ago, there were mountains too? I can't really describe it, just remember being with friends." },
  { label: 'daytime, last year, water somewhere', cue: 'Last year sometime, daytime, I think there was water somewhere in it.' },
  { label: 'exam meme Rahul sent me', cue: 'That exam meme Rahul sent me before my birthday.' },
  { label: 'unicorn on the beach', cue: 'Me riding a unicorn on the beach.' },
]

type Phase = 'idle' | 'running' | 'result'

const DECISION_META: Record<string, { tone: string; icon: typeof BadgeCheck }> = {
  found: { tone: 'border-chart-3/40 bg-chart-3/[0.08]', icon: BadgeCheck },
  clarify: { tone: 'border-primary/35 bg-primary/[0.06]', icon: MessageCircleQuestion },
  not_found: { tone: 'border-border bg-muted/40', icon: ShieldAlert },
  out_of_scope_deleted: { tone: 'border-destructive/30 bg-destructive/[0.06]', icon: AlertTriangle },
  out_of_scope_chat: { tone: 'border-chart-4/40 bg-chart-4/[0.08]', icon: Send },
}

export function RetrieveTab() {
  const [cue, setCue] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [stage, setStage] = useState(0)
  const [result, setResult] = useState<RetrievalResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [traceOpen, setTraceOpen] = useState(false)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const run = useCallback(async (cueText: string, clarify?: { album: string | 'neither' }) => {
    const trimmed = cueText.trim()
    if (!trimmed) return
    clearTimers()
    setPhase('running')
    setStage(0)
    setError(null)
    setResult(null)

    // Staged reveal: the engine answers in one call; the reveal walks the
    // panel through the four moves at readable speed.
    timers.current.push(setTimeout(() => setStage(1), 350))
    timers.current.push(setTimeout(() => setStage(2), 1100))
    timers.current.push(setTimeout(() => setStage(3), 1850))

    try {
      const res = await fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cue: trimmed, clarify }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      timers.current.push(
        setTimeout(() => {
          setResult(data as RetrievalResult)
          setPhase('result')
          setStage(3)
          requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }, 1950),
      )
    } catch (err) {
      clearTimers()
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('idle')
    }
  }, [])

  const reset = () => {
    clearTimers()
    setPhase('idle')
    setResult(null)
    setStage(0)
    setError(null)
  }

  const answerClarify = (album: string | 'neither') => {
    if (!result) return
    void run(result.parse.raw, { album })
  }

  return (
    <div>
      {/* ── Hero + cue box ─────────────────────────────────────── */}
      <section className="bg-grain border-b border-border/70">
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-12 sm:px-6 lg:pb-14 lg:pt-16">
          <Badge variant="secondary" className="mb-5 gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            Standalone research prototype · cue-first retrieval workflow
          </Badge>
          <h1 className="font-display text-3xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">
            Describe the photo the way you remember it.
            <br />
            <span className="text-primary">Search should accept memory&apos;s format.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Memory keeps relative time, visual fragments and event anchors, sometimes confidently wrong.
            The search box wants exact, textual, absolute queries. That mismatch is the root cause our research
            found. This prototype does the translating instead: parallel hypotheses, automatic escalation, one
            clarification at most, and every outcome explained.
          </p>

          <Card className="mt-8 border-border bg-card p-4 shadow-lg shadow-primary/[0.06] sm:p-5">
            <label htmlFor="cue" className="sr-only">Describe the photo you remember</label>
            <textarea
              id="cue"
              value={cue}
              onChange={(e) => setCue(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run(cue)
              }}
              rows={3}
              maxLength={600}
              placeholder={'the one from around my birthday last summer… she was wearing something red… there was water behind her…'}
              className="w-full resize-none rounded-xl border-0 bg-transparent p-2 text-base leading-relaxed outline-none placeholder:text-muted-foreground/70 sm:text-lg"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5 text-primary/80" aria-hidden />
                No keywords needed. No exact dates. Fragments welcome.
              </p>
              <Button size="lg" disabled={!cue.trim() || phase === 'running'} onClick={() => void run(cue)} className="rounded-full px-6">
                {phase === 'running' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
                {phase === 'running' ? 'Running the workflow' : 'Find it'}
              </Button>
            </div>
          </Card>

          {/* Example cues — the memory chips */}
          <div className="mt-6">
            <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Try a memory from the research</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <motion.button
                  key={ex.label}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.35 }}
                  onClick={() => { setCue(ex.cue); void run(ex.cue) }}
                  disabled={phase === 'running'}
                  className={cn(
                    'rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 shadow-sm transition-all',
                    'hover:-rotate-1 hover:border-primary/40 hover:text-foreground hover:shadow-md',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  &ldquo;{ex.label}&rdquo;
                </motion.button>
              ))}
            </div>
          </div>
          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-sm text-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden /> {error}
            </p>
          )}
        </div>
      </section>

      {/* ── Pipeline / result ──────────────────────────────────── */}
      <section ref={resultRef} className="mx-auto max-w-4xl scroll-mt-20 px-4 py-10 sm:px-6">
        <AnimatePresence mode="wait">
          {phase === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <IdleGuide />
            </motion.div>
          )}

          {phase === 'running' && (
            <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <StageRow active={stage >= 1} done={stage > 1} icon={Eye} title="Reading your memory" note="Accepting the cue in its own format: relative time, visual fragments, event anchors." />
              <StageRow active={stage >= 2} done={stage > 2} icon={Layers} title="Running hypotheses in parallel" note="Literal time, event anchors, shifted date, content-only — none is trusted alone." />
              <StageRow active={stage >= 3} done={false} icon={CheckCheck} title="Deciding and explaining" note="Escalate automatically, clarify once at most, and explain whatever happens." />
            </motion.div>
          )}

          {phase === 'result' && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-8">
              <ParsePanel result={result} onReset={reset} />
              <HypothesesPanel result={result} />
              <OutcomePanel result={result} onClarify={answerClarify} />
              <TracePanel result={result} open={traceOpen} onToggle={() => setTraceOpen((v) => !v)} />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}

// ── Idle: what the four moves are ────────────────────────────────────────────

const MOVES = [
  { icon: Eye, title: 'Accept the memory as-is', body: 'Your cue is parsed in its own format: relative time ("last summer"), event anchors ("my birthday"), visual fragments ("red", "near water"), and hints that may be confidently wrong.' },
  { icon: Layers, title: 'Run parallel hypotheses', body: 'Literal date, event anchors, a shifted date window, and content-only ranking all run at once. 2 of 3 interviewees held wrong dates with confidence, so no single interpretation is trusted.' },
  { icon: MessageCircleQuestion, title: 'Escalate before asking', body: 'If evidence is thin, the workflow widens windows and relaxes attributes by itself. Only then does it ask one clarifying question, with the candidates attached. Reformulating is left to the system, because 0 reformulations were observed in people.' },
  { icon: CheckCheck, title: 'Explain every outcome', body: 'Found: with match reasons. Not found: with the closest candidates and the full trace. Deleted or chat-app content: said out loud, with the research grounding. No silent failures.' },
]

function IdleGuide() {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">What this workflow does differently</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {MOVES.map((m, i) => (
          <motion.div
            key={m.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.4 }}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <m.icon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h3 className="mt-3 text-sm font-semibold">{m.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Running stages ───────────────────────────────────────────────────────────

function StageRow({ active, done, icon: Icon, title, note }: { active: boolean; done: boolean; icon: typeof Eye; title: string; note: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0.35, y: 8 }}
      transition={{ duration: 0.35 }}
      className={cn('flex items-start gap-4 rounded-2xl border p-4 sm:p-5', done ? 'border-chart-3/35 bg-chart-3/[0.06]' : 'border-border bg-card')}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', done ? 'bg-chart-3/15' : 'bg-primary/10')}>
        {done ? <BadgeCheck className="h-5 w-5 text-chart-3" aria-hidden /> : <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{note}</p>
      </div>
      {active && !done && <Loader2 className="ml-auto mt-1 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />}
    </motion.div>
  )
}

// ── Move 1 panel: the parse ──────────────────────────────────────────────────

function ParsePanel({ result, onReset }: { result: RetrievalResult; onReset: () => void }) {
  const p = result.parse
  const chips: Array<{ icon: typeof Eye; text: string }> = []
  for (const t of p.timeHints) chips.push({ icon: CalendarClock, text: `time: ${t.raw}` })
  for (const e of p.events) chips.push({ icon: Sparkles, text: `event: ${e.replace('-', ' ')}` })
  for (const c of p.colors) chips.push({ icon: Eye, text: `color: ${c}` })
  for (const s of p.settings) chips.push({ icon: Eye, text: `setting: ${s}` })
  for (const t of p.tags) chips.push({ icon: Eye, text: `fragment: ${t.replace('-', ' ')}` })
  if (p.people.min) chips.push({ icon: Eye, text: `people: with ${p.people.group === 'any' ? 'others' : p.people.group}` })
  for (const s of p.scopeHints) chips.push({ icon: Send, text: `scope: ${s === 'chat' ? 'possibly chat-app content' : s}` })

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold tracking-tight">What the workflow understood</h2>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> New memory
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Accepted exactly as written — no field-filling, no keywords required.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.25 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/85"
          >
            <c.icon className="h-3 w-3 text-primary/80" aria-hidden />
            {c.text}
          </motion.span>
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {result.parseNotes.map((n, i) => (
          <li key={i} className="flex gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-3 text-sm leading-relaxed text-foreground/90">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            {n}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Move 2 panel: the hypotheses ─────────────────────────────────────────────

function HypothesesPanel({ result }: { result: RetrievalResult }) {
  const hitsByHyp = new Map<string, number>()
  for (const run of result.passes) {
    for (const r of run.runs) hitsByHyp.set(r.hypothesisId, Math.max(hitsByHyp.get(r.hypothesisId) ?? 0, r.hits))
  }
  return (
    <div>
      <h2 className="font-display text-xl font-semibold tracking-tight">Hypotheses that ran in parallel</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The cue is never taken on faith: every interpretation competes on evidence. {result.metrics.hypothesesRun} runs over {result.metrics.passes} pass{result.metrics.passes > 1 ? 'es' : ''}, {result.metrics.photosScanned} scorings in {result.metrics.elapsedMs} ms.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {result.hypotheses.map((h, i) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: 0.3 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{h.label}</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">{hitsByHyp.get(h.id) ?? 0} hits</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{h.rationale}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── Moves 3 + 4 panel: the outcome ───────────────────────────────────────────

function OutcomePanel({ result, onClarify }: { result: RetrievalResult; onClarify: (album: string | 'neither') => void }) {
  const d = result.decision
  const meta = DECISION_META[d.kind] ?? DECISION_META.not_found
  const Icon = meta.icon

  return (
    <div>
      <div className={cn('rounded-2xl border p-5 sm:p-6', meta.tone)}>
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/70">
            <Icon className="h-5 w-5 text-foreground/80" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{d.headline}</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{d.explanation}</p>
            {d.groundedIn && (
              <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                {d.groundedIn}
              </p>
            )}
          </div>
        </div>

        {/* Clarify: the single question (Move 3) */}
        {d.kind === 'clarify' && d.clarify && (
          <div className="mt-5 border-t border-border/60 pt-5">
            <p className="text-sm font-semibold">{d.clarify.question}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.clarify.options.map((o) => (
                <Button
                  key={o.id}
                  variant={o.id === 'neither' ? 'outline' : 'default'}
                  size="sm"
                  className="rounded-full"
                  onClick={() => onClarify(o.id === 'neither' ? 'neither' : o.cluster)}
                >
                  {o.label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{d.clarify.evidenceNote}</p>
          </div>
        )}
      </div>

      {/* Results */}
      {d.results.length > 0 && (
        <div className="mt-6">
          {d.kind === 'out_of_scope_deleted' && <ResultGrid heading="The photo as it was, and the same day still in the library" items={d.results} />}
          {d.kind === 'found' && <ResultGrid heading="Matches, with the reasons they matched" items={d.results} />}
          {(d.kind === 'clarify' || d.kind === 'out_of_scope_chat') && <ResultGrid heading="Candidates attached to the question" items={d.results} />}
        </div>
      )}

      {/* Closest for honest not-found */}
      {d.closest && d.closest.length > 0 && (
        <div className="mt-6">
          <ResultGrid heading="Closest matches in the library" items={d.closest} muted />
        </div>
      )}
    </div>
  )
}

function ResultGrid({ heading, items, muted = false }: { heading: string; items: ScoredPhoto[]; muted?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground/90">{heading}</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {items.map((s, i) => (
          <motion.div
            key={s.photo.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.07 * i, duration: 0.3 }}
            className={cn('rounded-2xl border bg-card p-3', i === 0 && !muted ? 'border-primary/40 shadow-md shadow-primary/[0.07]' : 'border-border')}
          >
            <div className="flex gap-3">
              <PhotoThumb photo={s.photo} className="h-28 w-24 shrink-0 sm:h-32 sm:w-28" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-xs text-muted-foreground">{s.photo.id}</p>
                  {i === 0 && !muted && <Badge className="rounded-full bg-primary px-2 py-0 text-[10px]">top match</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.photo.album} · {s.photo.people > 0 ? `${s.photo.people} people · ` : ''}
                  {s.photo.timeOfDay}
                  {s.photo.deleted ? ' · deleted' : ''}
                </p>
                <div className="mt-2">
                  <EvidenceChips items={s.evidence} limit={4} />
                </div>
                {s.dateRecovered && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-chart-3">
                    <Clock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    Date recovered: you guessed {s.dateRecovered.guessed}; the photo is from {s.dateRecovered.actual}.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ── The full search trace ────────────────────────────────────────────────────

function TracePanel({ result, open, onToggle }: { result: RetrievalResult; open: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left" aria-expanded={open}>
        <span className="text-sm font-semibold">Full search trace — every hypothesis, window and count</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border/70 px-5 py-5">
          {result.passes.map((pass) => (
            <div key={pass.pass}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pass {pass.pass} {pass.relaxed.length > 0 && `· relaxed: ${pass.relaxed.join(', ')}`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{pass.note}</p>
              <div className="mt-3 overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Hypothesis</th>
                      <th className="px-3 py-2 font-medium">Windows scanned</th>
                      <th className="px-3 py-2 font-medium text-right">Hits</th>
                      <th className="px-3 py-2 font-medium">Top items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pass.runs.map((r) => (
                      <tr key={`${pass.pass}-${r.hypothesisId}`} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2.5 font-medium">{r.label}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.windowsScanned.length ? r.windowsScanned.join('; ') : 'none (content only)'}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{r.hits}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{r.topIds.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Metrics: {result.metrics.photosScanned} scorings · {result.metrics.hypothesesRun} hypothesis runs · {result.metrics.passes} pass{result.metrics.passes > 1 ? 'es' : ''} · {result.metrics.clarificationsUsed} clarification{result.metrics.clarificationsUsed === 1 ? '' : 's'} · {result.metrics.elapsedMs} ms.
            Every failure state above is explained by design; silent failure is what the research found people could not recover from.
          </p>
        </div>
      )}
    </div>
  )
}
