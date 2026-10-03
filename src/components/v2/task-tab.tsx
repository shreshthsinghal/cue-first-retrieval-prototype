'use client'

// Memory task mode: a guided task that produces honest vague-memory queries.
// Show a photo for 8 s, distract for 20 s, ask how the person would search,
// show the closest matches with confidences, let them pick or say none, then
// reveal. Records are exportable from the browser; nothing is stored
// server-side.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Play } from 'lucide-react'
import { useEncoder } from './use-encoder'
import { useSearch, type IndexPayload } from './use-search'
import type { BandedResult } from '@/lib/engine2/types'
import { cn } from '@/lib/utils'

interface TaskRecord {
  taskId: number
  targetId: string
  query: string
  topIds: string[]
  targetRank: number
  top1Confidence: number | null
  choice: string
  choiceCorrect: boolean | null
  timeToDecideMs: number
  interpretedBy: string
}

type Phase = 'intro' | 'show' | 'distract' | 'query' | 'pick' | 'reveal'

const SHOW_SECONDS = 8
const DISTRACT_SECONDS = 20

export function TaskTabV2() {
  const [index, setIndex] = useState<IndexPayload | null>(null)
  const encoder = useEncoder()
  const { state, search, reset } = useSearch(index, encoder.state === 'ready' ? encoder.embed : null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [countdown, setCountdown] = useState(0)
  const [target, setTarget] = useState<{ id: string; file: string } | null>(null)
  const [query, setQuery] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [records, setRecords] = useState<TaskRecord[]>([])
  const [taskId, setTaskId] = useState(1)
  const decideStart = useRef(0)
  const results = state.final?.results ?? []

  useEffect(() => {
    fetch('/api/index').then((r) => r.json()).then(setIndex).catch(() => setIndex(null))
  }, [])

  const pickTarget = useCallback(() => {
    if (!index) return null
    const pool = index.entries.filter((e) => !e.deleted && e.source === 'camera')
    return pool[Math.floor(Math.random() * pool.length)]
  }, [index])

  const beginTask = () => {
    const t = pickTarget()
    if (!t) return
    setTarget({ id: t.id, file: t.file })
    setQuery('')
    setPick(null)
    reset()
    setCountdown(SHOW_SECONDS)
    setPhase('show')
  }

  useEffect(() => {
    if (phase !== 'show' && phase !== 'distract') return
    if (countdown <= 0) {
      if (phase === 'show') { setCountdown(DISTRACT_SECONDS); setPhase('distract') }
      else setPhase('query')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, countdown])

  const submitQuery = () => {
    if (!query.trim() || encoder.state !== 'ready') return
    decideStart.current = Date.now()
    void search(query.trim())
    setPhase('pick')
  }

  const choose = (choice: string) => {
    if (!target) return
    const topIds = results.map((r) => r.id)
    const rank = topIds.indexOf(target.id) + 1
    const record: TaskRecord = {
      taskId,
      targetId: target.id,
      query: query.trim(),
      topIds,
      targetRank: rank,
      top1Confidence: results[0]?.probability ?? null,
      choice,
      choiceCorrect: choice === target.id ? true : choice === 'none' ? null : false,
      timeToDecideMs: Date.now() - decideStart.current,
      interpretedBy: state.final?.interpretation.interpretedBy ?? 'unknown',
    }
    setRecords((r) => [...r, record])
    setPick(choice)
    setTaskId((t) => t + 1)
    setPhase('reveal')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-task-session-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => {
    const header = 'taskId,targetId,query,targetRank,top1Confidence,choice,choiceCorrect,timeToDecideMs,interpretedBy'
    const rows = records.map((r) =>
      [r.taskId, r.targetId, `"${r.query.replace(/"/g, '""')}"`, r.targetRank, r.top1Confidence ?? '', r.choice, r.choiceCorrect ?? '', r.timeToDecideMs, r.interpretedBy].join(','))
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `memory-task-session-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-serif text-2xl font-semibold">Memory task</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your typed searches will be saved in a file you can send to the researcher. No photos of yours are involved; the demo library is a fictional person&apos;s photos. Nothing is stored server-side.
      </p>

      {phase === 'intro' && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">You will see a photo for {SHOW_SECONDS} seconds. After a short wait, tell the app how you would search for it, the way memory would describe it. Then see whether it finds the photo.</p>
          <button
            onClick={beginTask}
            disabled={encoder.state !== 'ready' || !index}
            className={cn(
              'mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold',
              encoder.state === 'ready' && index ? 'bg-primary text-primary-foreground hover:opacity-90' : 'cursor-not-allowed bg-stone-200 text-stone-400',
            )}
          >
            <Play className="h-4 w-4" aria-hidden />
            {encoder.state === 'ready' ? 'Start the task' : `Loading the search model... ${encoder.pct}%`}
          </button>
        </div>
      )}

      {phase === 'show' && target && (
        <div className="mt-6">
          <p className="mb-2 text-center text-sm text-muted-foreground">Remember this photo. {countdown}s</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/photos-v2/${target.file}`} alt="photo to remember" className="mx-auto max-h-[420px] rounded-2xl border border-border object-contain" />
        </div>
      )}

      {phase === 'distract' && (
        <div className="mt-16 rounded-2xl border border-border bg-card p-10 text-center">
          <p className="font-serif text-xl">Count backwards from 84 in steps of 7.</p>
          <p className="mt-2 text-sm text-muted-foreground">The search box opens in {countdown}s.</p>
        </div>
      )}

      {(phase === 'query' || phase === 'pick') && (
        <div className="mt-6">
          <label htmlFor="task-query" className="text-sm font-medium">How would you search for it now?</label>
          <p className="mb-2 text-xs text-muted-foreground">Freely, like telling a friend. Fragments are fine.</p>
          <textarea
            id="task-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            disabled={phase === 'pick'}
            className="w-full rounded-xl border border-border bg-card p-3 text-sm"
          />
          {phase === 'query' && (
            <button
              onClick={submitQuery}
              disabled={!query.trim() || encoder.state !== 'ready'}
              className={cn(
                'mt-3 rounded-full px-5 py-2.5 text-sm font-semibold',
                query.trim() && encoder.state === 'ready' ? 'bg-primary text-primary-foreground hover:opacity-90' : 'cursor-not-allowed bg-stone-200 text-stone-400',
              )}
            >
              Search
            </button>
          )}
        </div>
      )}

      {phase === 'pick' && (
        <div className="mt-6">
          <h2 className="font-serif text-lg font-semibold">Which one is it, if any?</h2>
          {state.phase === 'provisional' && <p className="mt-1 text-xs text-muted-foreground">Provisional matches, final confidence arriving...</p>}
          {state.phase === 'final' && (
            <p className="mt-1 text-xs text-muted-foreground">
              None of these: {Math.round((state.final?.nonePct ?? 0) * 100)}%. Pick the photo you believe is the one; the reveal comes after.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {results.map((r: BandedResult) => (
              <button key={r.id} onClick={() => choose(r.id)} className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumbnail} alt={r.hints.join(', ')} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="block p-1.5 text-[11px] font-semibold">
                  {Math.round(r.probability * 100)}% <span className="font-normal text-muted-foreground">{r.band}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => choose('none')}
            className="mt-3 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            None of these
          </button>
        </div>
      )}

      {phase === 'reveal' && target && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="font-serif text-lg font-semibold">The photo you saw</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/photos-v2/${target.file}`} alt="the photo you saw" className="mt-3 max-h-[360px] rounded-xl border border-border object-contain" />
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p>
              It was at rank {records[records.length - 1]?.targetRank || 'beyond 5'} of the results
              {records[records.length - 1]?.choice === 'none' ? ', and you answered none of these.' : records[records.length - 1]?.choiceCorrect ? ', and you picked it.' : ', and you picked a different one.'}
            </p>
            <p className="text-xs">Top-1 confidence the engine showed: {records[records.length - 1] ? `${Math.round((records[records.length - 1].top1Confidence ?? 0) * 100)}%` : 'n/a'}. Small numbers of tasks make these per-task reads noisy; the export is what matters for the research.</p>
          </div>
          <button onClick={beginTask} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Next photo
          </button>
        </div>
      )}

      {records.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Session: {records.length} task{records.length > 1 ? 's' : ''}</p>
            <div className="flex gap-2">
              <button onClick={exportJson} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"><Download className="h-3 w-3" aria-hidden /> JSON</button>
              <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"><Download className="h-3 w-3" aria-hidden /> CSV</button>
            </div>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-3">#</th><th className="py-1 pr-3">target rank</th><th className="py-1 pr-3">top-1 conf</th><th className="py-1 pr-3">choice</th><th className="py-1">query</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.taskId} className="border-t border-border/50">
                    <td className="py-1 pr-3">{r.taskId}</td>
                    <td className="py-1 pr-3">{r.targetRank || '>5'}</td>
                    <td className="py-1 pr-3">{r.top1Confidence != null ? `${Math.round(r.top1Confidence * 100)}%` : ''}</td>
                    <td className="py-1 pr-3">{r.choice === 'none' ? 'none' : r.choiceCorrect ? 'correct' : 'wrong'}</td>
                    <td className="max-w-[280px] truncate py-1" title={r.query}>{r.query}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
