'use client'

// Method: the problem statement this prototype serves, the four moves mapped
// to the implementation, what is real versus simulated, and the evidence base.

import { motion } from 'framer-motion'
import { BookOpen, BrainCircuit, CheckCircle2, Circle, ExternalLink, Quote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { TabKey } from './prototype-app'

const PROBLEM_STATEMENT = `When a person holds a partial memory of a specific photo that exists, retrieval fails because the cues memory keeps do not match the input the interface accepts; because the person often cannot tell whether the photo is even inside the searched scope; and because a failed attempt offers no recovery path, so people switch apps or stop trying.`

const MOVES: Array<{ n: string; title: string; impl: string; evidence: string }> = [
  {
    n: '01',
    title: 'Accept the memory as-is',
    impl: 'parse.ts: a deterministic cue parser over the library\u2019s attribute vocabulary. Time hints (absolute, seasonal, event-anchored, vague), events, colors, settings, fragments, people, and chat-origin scope hints. In production this module is the adapter point for an embedding or LLM parser.',
    evidence: 'Memory keeps relative, event-anchored, visual cues [9][10]; the search box is skipped rather than misused (3 of 3 live tasks).',
  },
  {
    n: '02',
    title: 'Run parallel hypotheses',
    impl: 'retrieve.ts: four hypotheses per cue \u2014 literal time, event anchors against real cluster dates, a shifted window for wrong dates, and content-only ranking \u2014 scored over every item with evidence recorded per feature.',
    evidence: 'Dates held with confidence were wrong 2 of 3 times (insight 2c); encoding specificity says retrieval succeeds when the cue matches encoding [9].',
  },
  {
    n: '03',
    title: 'Escalate automatically, clarify once',
    impl: 'Pass 2 widens time windows and relaxes attributes before the user is asked anything. If evidence still splits across moments, exactly one clarifying question is generated, with the candidates attached.',
    evidence: '0 reformulations were observed across 3 live tasks; under failure people switch apps or quit. The moment to help is before giving up.',
  },
  {
    n: '04',
    title: 'Explain every outcome',
    impl: 'Five terminal states \u2014 found, clarify, honest not-found, out-of-scope deleted, out-of-scope chat \u2014 all carrying an explanation, evidence chips on each result, and a full search trace (every hypothesis, window, count).',
    evidence: 'Silent failure produced resignation (16 corpus items) and app-switching (3 of 3). G1: photos live outside Photos (2 of 3); one live target was deleted.',
  },
]

const REAL_VS_SIM = [
  { real: true, text: 'The retrieval workflow itself: parsing, hypotheses, scoring, escalation, clarification and explanations are the real deterministic engine this prototype ships (verified by tests/engine-check.ts).' },
  { real: true, text: 'The eight benchmark cases and their scripted clarification answers, derived from the interview round 1 live tasks and insights.' },
  { real: false, text: 'The library: 40 AI-generated photos for one synthetic persona. Real-library scale, noise and personal history are not simulated.' },
  { real: false, text: 'The classic-search baseline: a literal AND-match keyword simulation over the same library. Real classic search differs in ranking detail, not in the documented failure mode.' },
  { real: false, text: 'Cross-app scope awareness is interaction design only: the prototype redirects to the chat-app hypothesis (G1) but cannot search WhatsApp or Snapchat.' },
]

export function MethodTab({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Method: what this is, and why</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        This prototype is the answer to one question from the problem definition: what does retrieval look like
        if the system accepts memory&apos;s format instead of demanding keywords?
      </p>

      {/* Problem statement */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-8 rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Quote className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-sm leading-relaxed text-foreground/90">&ldquo;{PROBLEM_STATEMENT}&rdquo;</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Problem definition, docs/part3 (Tulving &amp; Thomson 1973 [9]; Conway &amp; Pleydell-Pearce 2000 [10]).
              The framing to avoid: &ldquo;users find it difficult to search for old photos.&rdquo; The failure sits in
              the mismatch, not in the person&apos;s effort.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Four moves */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight">The four moves, mapped to the implementation</h2>
        <div className="mt-4 space-y-3">
          {MOVES.map((m, i) => (
            <motion.div
              key={m.n}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="rounded-2xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-sm font-semibold tracking-widest text-primary">{m.n}</span>
                <h3 className="text-sm font-semibold">{m.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground/80">Implementation. </span>{m.impl}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground"><span className="font-medium text-foreground/80">Grounding. </span>{m.evidence}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Real vs simulated */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold tracking-tight">What is real, what is simulated</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Stated plainly, the way the research report states its limitations.</p>
        <ul className="mt-4 space-y-2.5">
          {REAL_VS_SIM.map((r) => (
            <li key={r.text} className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed">
              {r.real
                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-chart-3" aria-hidden />
                : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className={r.real ? 'text-foreground/90' : 'text-muted-foreground'}>{r.text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Evidence base */}
      <section className="mt-10 rounded-2xl border border-border bg-secondary/50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <BrainCircuit className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">The evidence base behind the design</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              3,646 public items mined and classified (YouTube 2,226, Play Store 1,345, survey 75); 158 on-target;
              899 observations coded. Interview round 1: 4 sessions, 3 counted, 81 answers, 3 live tasks, 0 of 3
              finds, 0 reformulations. Top re-ranked opportunity: content plus approximate-time hybrid search,
              requested by 3 of 3 — exactly what Move 2 implements first.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={() => onNavigate('benchmark')} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-background px-3.5 py-1.5 text-xs font-medium hover:bg-accent">
                <BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden /> See the research replayed
              </button>
              <a
                href="https://recall-photo-retrieval-research.vercel.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5 text-primary" aria-hidden /> Discovery engine dashboard
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section className="mt-10">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">Positioning</Badge>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          This is a standalone prototype of an <span className="font-medium text-foreground/90">AI-powered retrieval workflow</span> —
          the only solution shape on the option list that is a mechanism rather than a container (a feature within
          Google Photos), a surface (a conversational experience), or an execution strategy (an agent). It is
          designed and argued as a drop-in feature concept for Google Photos: every interaction here is arguable
          as native, and the escalation tier is where agentic execution earns its place.
        </p>
      </section>
    </div>
  )
}
