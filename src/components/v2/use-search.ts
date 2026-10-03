'use client'

// Shared v2 search pipeline for the Retrieve and Memory-task tabs.
// Progressive by design: provisional content-only matches appear as soon as
// the on-device encoder answers, then the interpreted, calibrated results
// replace them. Nothing is stored server-side.

import { useCallback, useRef, useState } from 'react'
import type { BandedResult, InterpretResult, Retrieve2Response } from '@/lib/engine2/types'

export interface IndexPayload {
  modelId: string
  indexHash: string
  entries: Array<{
    id: string; file: string; ts: string; source: string; deleted: boolean
    emb: number[]; hints: string[]; cluster: string
  }>
}

export interface Provisional { id: string; file: string; cos: number }

export interface SearchState {
  phase: 'idle' | 'encoding' | 'provisional' | 'final' | 'error'
  provisional: Provisional[]
  final: Retrieve2Response | null
  interpretation: InterpretResult | null
  error: string | null
  updatedNote: boolean
}

export function useSearch(index: IndexPayload | null, embed: ((texts: string[]) => Promise<number[][]>) | null) {
  const [state, setState] = useState<SearchState>({ phase: 'idle', provisional: [], final: null, interpretation: null, error: null, updatedNote: false })
  const rawEmbRef = useRef<number[] | null>(null)
  const cueRef = useRef('')
  const embCache = useRef(new Map<string, number[]>())

  const runPhaseB = useCallback(async (cue: string, interpretation: InterpretResult, opts?: { clarifyAnswer?: string | null; clarifyUsed?: boolean }) => {
    const texts: Array<{ role: 'raw' | 'rewrite'; text: string; embedding: number[] }> = []
    const raw = rawEmbRef.current
    if (!raw) throw new Error('missing raw embedding')
    texts.push({ role: 'raw', text: cue, embedding: raw })
    for (const rw of interpretation.rewrites) {
      let v = embCache.current.get(rw)
      if (!v) {
        const [vec] = await embed!([rw])
        v = vec
        embCache.current.set(rw, vec)
      }
      texts.push({ role: 'rewrite', text: rw, embedding: v })
    }
    const res = await fetch('/api/retrieve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cue, texts, interpretation, clarifyAnswer: opts?.clarifyAnswer ?? null, clarifyUsed: opts?.clarifyUsed ?? false }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(body.error ?? 'The search hit an unexpected error.')
    }
    const data = (await res.json()) as Retrieve2Response
    return data
  }, [embed])

  const search = useCallback(async (cue: string) => {
    if (!index || !embed) return
    cueRef.current = cue
    setState({ phase: 'encoding', provisional: [], final: null, interpretation: null, error: null, updatedNote: false })
    try {
      // Phase A (interpretation) runs in parallel with the on-device encoding.
      const phaseAPromise = fetch('/api/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cue }),
      }).then((r) => r.json())

      const [rawVec] = await embed([cue])
      rawEmbRef.current = rawVec
      embCache.current.set(cue, rawVec)

      // Provisional content-only ranking, computed locally.
      const living = index.entries.filter((e) => !e.deleted)
      const scored = living.map((e) => ({ id: e.id, file: e.file, cos: e.emb.reduce((s, x, i) => s + x * rawVec[i], 0) }))
      scored.sort((a, b) => b.cos - a.cos)
      const provisional = scored.slice(0, 5)
      setState((s) => ({ ...s, phase: 'provisional', provisional }))

      const phaseA = (await phaseAPromise) as { interpretation?: InterpretResult; error?: string }
      if (phaseA.error) throw new Error(phaseA.error)
      const interpretation = phaseA.interpretation!
      setState((s) => ({ ...s, interpretation }))

      const final = await runPhaseB(cue, interpretation)
      setState((s) => ({ ...s, phase: 'final', final, interpretation, updatedNote: true }))
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: err instanceof Error ? err.message : 'Something went wrong.' }))
    }
  }, [index, embed, runPhaseB])

  const rerunWithInterpretation = useCallback(async (interpretation: InterpretResult) => {
    try {
      setState((s) => ({ ...s, phase: 'encoding' }))
      const final = await runPhaseB(cueRef.current, interpretation)
      setState((s) => ({ ...s, phase: 'final', final, interpretation, updatedNote: true }))
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: err instanceof Error ? err.message : 'Something went wrong.' }))
    }
  }, [runPhaseB])

  const answerClarify = useCallback(async (optionId: string) => {
    if (!state.interpretation) return
    try {
      const final = await runPhaseB(cueRef.current, state.interpretation, { clarifyAnswer: optionId, clarifyUsed: true })
      setState((s) => ({ ...s, phase: 'final', final, updatedNote: false }))
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: err instanceof Error ? err.message : 'Something went wrong.' }))
    }
  }, [state.interpretation, runPhaseB])

  const reset = useCallback(() => {
    setState({ phase: 'idle', provisional: [], final: null, interpretation: null, error: null, updatedNote: false })
    rawEmbRef.current = null
    cueRef.current = ''
  }, [])

  return { state, search, rerunWithInterpretation, answerClarify, reset }
}

export function resultIconLabel(r: BandedResult): string | null {
  if (r.source === 'screenshot') return 'screenshot'
  return null
}
