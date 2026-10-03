'use client'

import { useEffect, useState } from 'react'
import { Camera, FlaskConical, Image as ImageIcon, ListChecks, Search, Timer } from 'lucide-react'
import { Logo } from '@/components/app/logo'
import { cn } from '@/lib/utils'
import { RetrieveTabV2 } from '@/components/v2/retrieve-tab'
import { LibraryTabV2 } from '@/components/v2/library-tab'
import { BenchmarkTabV2 } from '@/components/v2/benchmark-tab'
import { MethodTabV2 } from '@/components/v2/method-tab'
import { TaskTabV2 } from '@/components/v2/task-tab'

export type TabKey = 'retrieve' | 'library' | 'benchmark' | 'method' | 'task'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Search }> = [
  { key: 'retrieve', label: 'Retrieve', icon: Search },
  { key: 'library', label: 'Library', icon: ImageIcon },
  { key: 'benchmark', label: 'Benchmark', icon: ListChecks },
  { key: 'method', label: 'Method', icon: FlaskConical },
  { key: 'task', label: 'Memory task', icon: Timer },
]

export function V2App() {
  const [tab, setTab] = useState<TabKey>('retrieve')

  useEffect(() => {
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
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={() => go('retrieve')} className="cursor-pointer" aria-label="Cue First v2: home">
            <span className="flex items-center">
              <Logo />
              <span className="ml-1.5 align-super text-[10px] font-semibold tracking-wide text-muted-foreground">v2</span>
            </span>
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
            <a
              href="/v1"
              className="flex h-16 items-center gap-1.5 px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-4"
              title="The v1 prototype: string matching over authored labels"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden md:inline">v1</span>
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {tab === 'retrieve' && <RetrieveTabV2 />}
        {tab === 'library' && <LibraryTabV2 />}
        {tab === 'benchmark' && <BenchmarkTabV2 />}
        {tab === 'method' && <MethodTabV2 onNavigate={go} />}
        {tab === 'task' && <TaskTabV2 />}
      </main>

      <footer className="mt-auto border-t border-border/70 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Cue First v2: content-based retrieval research prototype. Demo library: a fictional person&apos;s photos (AI-generated or stock). These are not your photos.</p>
          <p>Nothing you type is stored server-side.</p>
        </div>
      </footer>
    </div>
  )
}
