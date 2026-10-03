'use client'

// Method tab: what is real and what is simulated in v2, where intelligence
// sits in the retrieval journey and the evidence for each placement, and what
// changed from v1 and why.

interface Row { real: boolean; text: string }

const REAL_OR_SIMULATED: Row[] = [
  { real: true, text: 'Content-based retrieval: every query and every library photo is embedded with CLIP (Xenova/clip-vit-base-patch32, quantized ONNX, 512-d). Similarity is computed between what the query describes and what the images look like. No authored text label participates in matching.' },
  { real: true, text: 'The library: 158 real photographs (Unsplash License via images.unsplash.com and Picsum, authors recorded per item) plus 43 AI-generated or rendered items, all labeled per item in the manifest. Two beach trips, two birthdays, near-duplicate bursts, 8 rendered chat screenshots and 5 deleted ghosts are deliberate hard cases.' },
  { real: true, text: 'Event clusters are derived by clustering capture timestamps (36 h gap rule) at index time. Named events resolve through the persona profile, which is structured data like the important dates in a phone.' },
  { real: true, text: 'The deterministic time parser: relative time, seasons, festival and life-event anchors resolve to a center date plus a spread, with no model in the loop. It is the fallback whenever the model is unavailable, and the UI says which one ran.' },
  { real: true, text: 'Calibration: the fusion weight, the time-mixture probability, the softmax temperature and the none-of-these logit were fitted by grid search minimizing log loss on a dev split of held-out queries, then frozen. High and Medium band cutoffs were derived on dev at top-1 precision of 80% and 50%.' },
  { real: true, text: 'The evaluation: 85 held-out queries written by a vision-language model that saw the images but never the labels; dev/test split by photo; the test split reported once. Ablations, baselines and the calibration table are all script outputs re-runnable with one command.' },
  { real: false, text: 'The persona is fictional and the library is a demo. Nothing in the numbers transfers to a real personal library; the Method tab and the evaluation doc say so plainly.' },
  { real: false, text: 'The clarifying question is simulated in the ablation with the correct answer when the target is among the two options: an upper bound, not a human measurement. In the live UI the question is real and the answer is yours.' },
  { real: false, text: 'The optional interpretation stage uses a large language model with a 4 s hard timeout. When it is unavailable (including in this deployment unless an interpreter key is configured), the deterministic parser takes over and the UI shows the label and the reason. The evaluation measured the parser path because the shared model endpoint was rate-limited during the run.' },
]

const WHERE_INTELLIGENCE = [
  {
    place: 'Understanding the cue (optional, small, expendable)',
    evidence: 'Removing the model interpretation entirely costs 0 Recall@1 on the test split (S2 vs S3 in the ablation). The research found that people describe time relatively and visually; the deterministic parser plus the raw-text embedding already covers most of that. The model adds rewrites for mixed-language cues and free-form phrasing, so it stays optional with a hard 4 s timeout and a visible fallback.',
  },
  {
    place: 'Matching what the scene looked like (the core)',
    evidence: 'This is where v1 failed: 81% of content words in natural queries had no representation in the v1 parse, because matching ran on authored strings. In v2 the content embedding does the work: raw content search alone reaches 69% Recall@1 on the test split versus 19% for the v1 engine on the same candidates, and 0% for a strict keyword box.',
  },
  {
    place: 'Treating time as a soft prior (small, fitted)',
    evidence: 'The time prior adds 8 percentage points of Recall@1 on the test split (S1 to S2). It is one fitted probability (pi), never a filter: a wrong stated date costs a little score and can never remove a photo.',
  },
  {
    place: 'Asking exactly one question (workflow, not model)',
    evidence: 'The simulated clarification adds 4 to 8 points of Recall@1 (S3 to S4). The research found 0 reformulations before abandonment: the system, not the person, should do the next attempt. The budget of one question is enforced in code and tested.',
  },
  {
    place: 'Ending honestly (explained states)',
    evidence: 'Every terminal state carries an explanation and a trace: found with score components, not-found with the closest matches, deleted with an existence statement (4 of 5 ghost scenarios on test), chat content with a scope warning, and none-of-these with its own fitted probability. The failure modes the research documented came from silent zeros; v2 has no silent zeros.',
  },
]

const CHANGES_FROM_V1 = [
  'Matching: authored-string scoring replaced by CLIP image-text embeddings; the label vocabulary no longer exists for retrieval (a test enforces that retrieval code never imports evaluation data).',
  'Library: 40 items became 158, with real photographs, two-year lookalike scenes, bursts, 8 chat screenshots and 5 ghosts; events are derived from timestamps, not typed.',
  'Parser: the vocabulary whitelist is gone from the retrieval path; the deterministic parser only handles time and scope, and says so in the UI.',
  'Confidence: hand-set thresholds (4.2 / 6.5 / 2.6) replaced by fitted, calibrated probabilities with derived bands and an explicit none-of-these class.',
  'Benchmark: the 16 self-referential cases became 85 held-out queries split by photo, with classic and v1 baselines on an identical candidate set, an ablation, and Wilson intervals; the old suite remains only as regression scenarios in the v1 app.',
]

export function MethodTabV2({ onNavigate }: { onNavigate: (key: 'retrieve' | 'library' | 'benchmark' | 'method' | 'task') => void }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold">Method: what is real, what is simulated, and why</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          v2 keeps the four moves from the research (accept the cue as spoken, interpret visibly, escalate before asking, end honestly) and replaces the matching core with content-based retrieval.
        </p>
      </header>

      <section aria-label="Real or simulated">
        <h2 className="mb-3 font-serif text-xl font-semibold">What is real and what is simulated</h2>
        <ul className="space-y-2">
          {REAL_OR_SIMULATED.map((row, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border bg-card p-3 text-sm">
              <span className={`mt-0.5 h-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.real ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {row.real ? 'real' : 'simulated / limited'}
              </span>
              <span className="text-foreground/90">{row.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Where intelligence sits">
        <h2 className="mb-3 font-serif text-xl font-semibold">Where intelligence sits, and the evidence</h2>
        <div className="space-y-3">
          {WHERE_INTELLIGENCE.map((row) => (
            <div key={row.place} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-semibold">{row.place}</p>
              <p className="mt-1 text-sm text-muted-foreground">{row.evidence}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Changes from v1">
        <h2 className="mb-3 font-serif text-xl font-semibold">What changed from v1, and why</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/90">
          {CHANGES_FROM_V1.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </section>

      <section aria-label="Efficiency" className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="mb-2 font-serif text-lg font-semibold">Efficiency, measured</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Library payload: 13.5 MB across 158 images (about 86 KB average), thumbnails lazy-loaded.</li>
          <li>Text model: about 65 MB quantized ONNX, downloaded once in the browser worker and cached by the browser; the image tower never ships to the client because image embeddings are precomputed at index time.</li>
          <li>Index build: 158 images in about 16 s on this machine, one command (<code>scripts/index-library.ts</code>), deterministic output with a recorded hash.</li>
          <li>Server score stage: single-digit milliseconds (no model on the server; the API validates and fuses the client embeddings).</li>
          <li>Choosing browser-side encoding: a serverless function bundling the ONNX runtime plus the model would sit close to the platform size limit and pay a cold-start model load per instance; the browser path pays 65 MB once and then encodes on-device in a few hundred milliseconds, with provisional results shown before any server round trip.</li>
        </ul>
      </section>

      <section aria-label="Try it" className="rounded-xl border border-border bg-card p-4 text-sm">
        <p>Compare v1 and v2 yourself: the <button className="underline" onClick={() => onNavigate('retrieve')}>v2 Retrieve tab</button> for content-based search, and the <a className="underline" href="/v1">v1 app</a> for the string-matching core it replaces. The <button className="underline" onClick={() => onNavigate('benchmark')}>Benchmark tab</button> holds the measured comparison.</p>
      </section>
    </div>
  )
}
