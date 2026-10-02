'use client'

// Cue First wordmark. The aperture ring is half-drawn: retrieval that meets
// the memory part-way. Palette matches the discovery engine.

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm shadow-primary/20">
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none" aria-hidden>
          <path d="M16 7c-5 0-9 4-9 9s4 9 9 9c2.4 0 4.6-.9 6.2-2.5" stroke="oklch(0.985 0.005 85)" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="16" cy="16" r="3.5" fill="oklch(0.985 0.005 85)" />
          <path d="M22 11.5 25 8M25.5 14H29" stroke="oklch(0.9 0.09 80)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-tight">Cue First</span>
          <span className="block text-[11px] font-medium text-muted-foreground">retrieval prototype</span>
        </span>
      )}
    </span>
  )
}
