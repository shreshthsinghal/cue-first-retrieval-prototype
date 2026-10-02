# How Cue First Works

Technical overview of the cue-first retrieval workflow prototype. Companion to the
problem definition (`docs/part3/problem-definition.md` in the research repo) and to the
live app: https://cue-first-retrieval-prototype.vercel.app

## 1. What Cue First is

Cue First is a standalone prototype of a **cue-first retrieval workflow**, designed and
argued as a feature concept for Google Photos. It answers one question from the problem
definition: what does photo retrieval look like if the system accepts memory's native
format instead of demanding exact, textual, absolute queries? The research behind it found
a cue-format mismatch: people remember relative time, event anchors, and visual fragments,
sometimes confidently wrong, while the search box accepts none of that. In the live study
the baseline outcome was 0 of 3 finds with 0 reformulations.

The prototype does the translating instead: it accepts a memory dump exactly as written,
runs several interpretations in parallel, escalates on its own when evidence is thin, asks
at most one clarifying question with the candidates attached, and explains every outcome,
including the honest failures.

## 2. Architecture at a glance

| Module | Role in the workflow |
|---|---|
| `src/lib/engine/parse-llm.ts` | Stage 1 parser: a language model reads the raw dump and returns a structured cue frame. Falls back silently on any failure. |
| `src/lib/engine/parse.ts` | Stage 2 parser: validates the model's frame against the library vocabulary, supplies the frame deterministically when needed, and is what the benchmark replays with. |
| `src/lib/engine/retrieve.ts` | The workflow: four hypotheses, per-feature scoring, automatic escalation, one clarification, five explained decisions. |
| `src/lib/engine/library.ts` | The synthetic evaluation library: a 40-item camera roll with event clusters, two deleted ghosts, two chat screenshots. The retrieval ground truth. |
| `src/lib/engine/benchmark.ts` | Sixteen research-grounded cases plus the classic keyword baseline simulator. |
| API routes | `POST /api/retrieve`, `GET /api/benchmark`, `GET /api/health`. |
| UI tabs | Retrieve (staged interactive reveal), Library, Benchmark, Method. |

## 3. The two-stage parser

Stage 1 is a language-model parser: it reads the cue the way a person would, handling
hedging, self-correction, and fragments no lexicon can cover, and returns a structured
frame: time hints (absolute, seasonal, birthday-anchored, vague), events, content tags,
colors, settings, a people requirement, chat-scope hints, and confidence flags such as
`confident-date`.

Stage 2 is a deterministic vocabulary parser, and it never trusts stage 1 blindly. Every
field is whitelisted against the library's attribute vocabulary: months must be integers
0 to 11, years are clamped, tags, colors, settings, and events must exist in the manifest,
and anything the engine cannot interpret is dropped rather than guessed at. If the model is
unreachable, times out, or returns a malformed frame, stage 2 produces the frame itself, so
the API never hard-fails. The benchmark replays with stage 2 for reproducibility, and a
clarify follow-up carries the original frame back to the server so both runs replay the
same interpretation. The Retrieve tab shows which stage produced the interpretation.

## 4. The retrieval workflow

Up to four hypotheses run in parallel over every living item:

1. **Take the memory literally**: stated time and content, exactly as said.
2. **Trust the event, not the date**: event anchors against the library's real cluster dates.
3. **The date might be wrong**: windows widened by a year on each side, a month around the season.
4. **Ignore time completely**: content-only ranking.

Scoring is additive and transparent; time windows are candidates, never hard filters
(dates held with confidence were wrong 2 of 3 times in the interviews):

| Signal | Weight | Notes |
|---|---|---|
| Event match | +3.0 | The strongest anchor in autobiographical memory. |
| Time window hit | +2.5 | Photo month inside a hypothesis window. |
| Time window miss | -0.8 (-0.4 relaxed) | A cost, never a filter. |
| Content tag hit | +1.2 (cap 3) | Cake, snow, chai, fairy lights, crowd, and the rest. |
| Color hit | +1.0 | Preferred: miss costs 0.2; relaxed: no cost. |
| Setting hit | +1.0 | Water, beach, mountains, home, city; miss costs 0.3. |
| People requirement | +0.4 | Applies when the cue implies others. |
| Time-of-day match | +0.3 | Night, sunset, morning, day. |
| Clarify answer boost | +2.8 | Applied to the chosen album after the one question. |

Decision thresholds: a top score of **4.2** is a find, **6.5** is a strong find that skips
the margin check, and **2.6 to 4.2** means the evidence splits, which triggers escalation
or one clarification. If nothing clears the bar, pass 2 widens all literal windows to every
month across adjacent years, relaxes color and setting penalties, and re-runs: the system
does the reformulating, because 0 reformulations were observed in live tasks. Chat-scope
hints short-circuit into the scope check before any failure is declared.

## 5. Explained outcomes

Every run ends in one of five terminal states, each with a plain explanation, evidence
chips on every result, and a full search trace (every hypothesis, window, and count):

| State | What the user sees |
|---|---|
| found | Results with the reasons they matched, competing hypotheses and why they lost, and a recovered date when the guess was wrong. |
| clarify | One question with the top albums as candidates and the evidence note attached; the answer boosts that album and the workflow re-runs once. |
| not_found | The three closest items and the complete trace of what was searched. |
| out of scope: deleted | An existence statement for the deleted item plus same-day photos that remain; never sold as a search result. |
| out of scope: chat | A scope check pointing at the chat app where 2 of 3 participants keep such content. |

## 6. The benchmark

Sixteen cases: three mirror the live think-aloud tasks (P1 to P3); the rest embody the
findings (2c confident wrong dates and places, 2d non-verbalizable visual memory, G1
chat-app scope, deleted targets, resigned memories, event-anchored sequencing). The suite
asserts outcomes, determinism, the known-item fast path, and the one-clarification budget.

Replay summary: 14 of 16 resolve with an explanation; 2 fail honestly with closest
candidates and the full trace; 2 clarifications used against a budget of one per case; the
classic box is silent on 15 of 16 cues. The one case where the classic box works is kept on
purpose: the research never claimed literal search is useless, only that it fails exactly
when memory is vague.

Run it: `bun tests/engine-check.ts`

## 7. API and deployment

| Endpoint | Purpose |
|---|---|
| `POST /api/retrieve` | Runs the workflow on one cue; `parser: "deterministic"` forces stage 2; clarify follow-ups carry the original frame. |
| `GET /api/benchmark` | Replays all 16 cases plus the classic baseline. |
| `GET /api/health` | Engine version, parser mode, library shape. |

Stack: Next.js, React, TypeScript, Tailwind. Deploys as a single Vercel project with no
database and no authentication by design: a public research artifact over a synthetic library.

## 8. What is real, what is simulated

Real: the workflow itself, the two-stage parsing, scoring, escalation, clarification, and
explanations, verified by the benchmark on every deploy. Simulated: the library (40
generated photos for one synthetic persona; no real person's library), the classic baseline
(a literal AND-match simulation; real products differ in ranking detail, not in the
documented failure mode), and cross-app scope (interaction design only; the prototype
redirects to the chat-app hypothesis but cannot search WhatsApp or Snapchat).
