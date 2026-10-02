# Cue First: a retrieval workflow that accepts memory's format

Standalone research prototype of a **cue-first retrieval workflow**, designed and
argued as a feature concept for Google Photos. Built on the cue-format mismatch
problem definition from the Recall photo-retrieval research program.

Live: https://cue-first-retrieval-prototype.vercel.app
How it works: see `HOW-IT-WORKS.md` in this repo.

**The problem it serves.** When a person holds a partial memory of a specific
photo that exists, retrieval fails because the cues memory keeps (relative time,
life events, visual fragments, sometimes confidently wrong) do not match the
input the interface accepts (exact, textual, absolute queries); because scope is
uncertain; and because failed attempts offer no recovery path. People switch
apps or stop trying. Live baseline: 0 of 3 finds, 0 reformulations.

**The four moves**

1. **Accept the memory as-is**: `src/lib/engine/parse-llm.ts` (stage 1) reads the
   free-form memory dump with a language model and returns a structured cue frame;
   `src/lib/engine/parse.ts` (stage 2) validates that frame against the library's
   vocabulary and stands in as the deterministic fallback, so the API never hard-fails
   and the benchmark stays reproducible.
2. **Run parallel hypotheses**: `src/lib/engine/retrieve.ts` runs literal time,
   event anchors against real cluster dates, a shifted date window, and
   content-only ranking, all scored with per-feature evidence.
3. **Escalate automatically, clarify once**: pass 2 widens windows and relaxes
   attributes before the user is ever asked; then at most one clarifying
   question, with the candidates attached.
4. **Explain every outcome**: five terminal states (found, clarify, honest
   not-found, out-of-scope deleted, out-of-scope chat), each with an
   explanation, evidence chips, and a full search trace.

**Benchmark.** `tests/engine-check.ts` replays sixteen research-grounded cue
cases (three mirror the live think-aloud tasks P1-P3) and asserts outcomes,
determinism, the fast path, and the one-clarification budget:

```bash
bun tests/engine-check.ts
```

**The evaluation library.** `src/lib/engine/library.ts` is a 40-item synthetic
camera roll (generated photos + two HTML-rendered chat screenshots) with two
deleted ghosts kept as existence records. No real person's library is simulated.

**API.** `POST /api/retrieve` (stateless; parser modes: auto with neural first,
or deterministic), `GET /api/benchmark` (replays all cases with the classic
keyword baseline), `GET /api/health`.

Positioning: the workflow is the mechanism (the "what"); the Google Photos
feature is the end state (the "where"), the cue-first multimodal surface is the
interface (the "how"), and the escalation tier is where agentic execution earns
its place. See the Method tab in the app.
