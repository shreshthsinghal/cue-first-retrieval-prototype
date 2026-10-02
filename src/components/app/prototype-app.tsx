'use client'

// Single-page prototype shell. Tabs are client-side (the sandbox exposes one
// route) and synced to the hash so any view can be shared: #/library, #/benchmark.

import { useEffect, useState } from 'react'
import { FlaskConical, Image as ImageIcon, ListChecks, Search } from 'lucide-react'
import { Logo } from '@/components/app/logo'
import { RetrieveTab } from './retrieve-tab'
import { LibraryTab } from './library-tab'
import { BenchmarkTab } from './benchmark-tab'
import { MethodTab } from './method-tab'
import { cn } from '@/lib/utils'

export type TabKey = 'retrieve' | 'library' | 'benchmark' | 'method'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Search }> = [
  { key: 'retrieve', label: 'Retrieve', icon: Search },
  { key: 'library', label: 'Library', icon: ImageIcon },
  { key: 'benchmark', label: 'Benchmark', icon: ListChecks },
  { key: 'method', label: 'Method', icon: FlaskConical },
]

export function PrototypeApp() {
  const [tab, setTab] = useState<TabKey>('retrieve')

  useEffect(() => {
    // Read the initial hash after paint to avoid a synchronous setState in
    // the effect body (and a hydration mismatch against the prerender).
    const raf = requestAnimationFrame(() => {
      const fromHash = window.location.hash.replace('#/', '') as TabKey
      if (TABS.some((t) => t.key === fromHash)) setTab(fromHash)
    })
    const onHash = () => {
      const h = window.location.hash.replace('#/', '') as TabKey
      if (TABS.some((t) => t.key === h)) setTab(h)
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  const go = (key: TabKey) => {
    setTab(key)
    window.history.replaceState(null, '', `#/${key}`)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={() => go('retrieve')} className="cursor-pointer" aria-label="Cue First: home">
            <Logo />
          </button>
          <nav className="flex items-center" aria-label="Sections">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => go(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={cn(
                  'relative flex h-16 items-center gap-1.5 px-3 text-sm font-medium transition-colors sm:px-4',
                  tab === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className={cn(key !== 'retrieve' && 'hidden md:inline')}>{label}</span>
                {tab === key && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Active tab ─────────────────────────────────────────── */}
      <main className="flex-1">
        {tab === 'retrieve' && <RetrieveTab />}
        {tab === 'library' && <LibraryTab />}
        {tab === 'benchmark' && <BenchmarkTab />}
        {tab === 'method' && <MethodTab onNavigate={go} />}
      </main>

      {/* ── Footer (sticky bottom) ─────────────────────────────── */}
      <footer className="mt-auto border-t border-border/70 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:px-6 sm:text-left">
          <p>Cue First: a standalone prototype of the cue-first retrieval workflow, positioned as a feature concept for Google Photos.</p>
          <p>Synthetic photo library, no real user data · part of the Recall photo-retrieval research program</p>
        </div>
      </footer>
    </div>
  )
}
