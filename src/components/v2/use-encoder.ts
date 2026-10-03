'use client'

// Hook: the browser-side text encoder. Loads the CLIP text tower in a Web
// Worker on first use (about 65 MB, cached by the browser after the first
// visit) and embeds query texts entirely on-device.

import { useCallback, useEffect, useRef, useState } from 'react'

export type EncoderState = 'idle' | 'loading' | 'ready' | 'error'

export function useEncoder() {
  const [state, setState] = useState<EncoderState>('idle')
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const pending = useRef(new Map<number, { resolve: (v: number[][]) => void; reject: (e: Error) => void }>())
  const nextId = useRef(1)

  useEffect(() => {
    const worker = new Worker('/workers/encoder.js', { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data as { type: string; pct?: number; id?: number; vectors?: number[][]; message?: string }
      if (msg.type === 'progress') setPct(Math.round(msg.pct ?? 0))
      else if (msg.type === 'ready') setState('ready')
      else if (msg.type === 'error') { setError(msg.message ?? 'encoder failed'); setState('error') }
      else if (msg.type === 'embeddings' && msg.id != null) {
        const p = pending.current.get(msg.id)
        if (p) { pending.current.delete(msg.id); p.resolve(msg.vectors ?? []) }
      }
    }
    worker.onerror = (e) => { setError(e.message || 'worker failed to start'); setState('error') }
    worker.postMessage({ type: 'init' })
    setState('loading')
    return () => { worker.terminate(); workerRef.current = null }
  }, [])

  const embed = useCallback((texts: string[]): Promise<number[][]> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current
      if (!worker || state !== 'ready') { reject(new Error('encoder not ready')); return }
      const id = nextId.current++
      pending.current.set(id, { resolve, reject })
      worker.postMessage({ type: 'embed', id, texts })
      setTimeout(() => {
        if (pending.current.has(id)) { pending.current.delete(id); reject(new Error('encoding timed out')) }
      }, 15000)
    })
  }, [state])

  return { state, pct, error, embed }
}
