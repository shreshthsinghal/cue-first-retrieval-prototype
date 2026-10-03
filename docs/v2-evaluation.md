# v2 evaluation

All numbers below come from `eval/run-eval.ts` (one command, re-runnable) and are rendered verbatim by the Benchmark tab from the same output file. Queries: `eval/queries.jsonl`. Splits: `eval/splits.json` plus a seeded dev/test split by photo.

## The test set

- 85 held-out memory-style queries. 68 have a present target (2 to 3 queries per target, 26 targets), 12 are absent-target queries (their targets are photos excluded from the search index entirely), 5 are ghost scenarios (targets deleted from the library).
- Written by a vision-language model (GLM, used with vision) that looked at each photo and wrote what memory would say about it, without access to any retrieval vocabulary, index, or label data. Styles: visual fragments, relative time, event anchors, confidently wrong dates, "cannot describe it", plus 8 Hinglish (mixed Hindi-English) queries.
- Split by photo, never by query: 16 present targets and 8 absent targets to dev (60 percent), the rest to test. All fitting used dev only. Reported numbers are the test split, run once after freezing.

## Systems compared (test split, 26 present-target queries)

| System | Recall@1 | Recall@3 | Recall@5 | MRR |
| --- | --- | --- | --- | --- |
| (A) Classic keyword box on the CLIP-generated label view | 0.0% | 0.0% | 0.0% | 0.000 |
| (B) The v1 engine on the same label view | 19.2% (Wilson 95%: 8.5 to 37.9) | 34.6% | 50.0% | 0.304 |
| (C) v2, full system | 80.8% (Wilson 95%: 62.1 to 91.5) | 92.3% | 100.0% | 0.878 |

Fairness notes, stated plainly:

- The candidate set is identical for all three systems: 134 searchable photos (the 24 held-out photos are invisible to every system).
- (A)'s label view was produced by CLIP zero-shot classification in v1's exact vocabulary format (script: `scripts/build-label-view.ts`, threshold 0.24, average 2.8 tags per photo). No human labels, no person identity, no event or place names. (A) requires every content token to match, which is how an AND-style keyword box behaves on a memory dump; real products do soft matching, so (A) is a floor, not a strawman target.
- (B) is the actual v1 engine code (unmodified scoring, thresholds and clarify flow; only the library is injected) run against that label view.

## Ablation of v2 (test split)

| Stage | Recall@1 | Recall@3 | Recall@5 | MRR |
| --- | --- | --- | --- | --- |
| S1: content search on the raw text only | 69.2% | 92.3% | 96.2% | 0.803 |
| S2: + rule-based time prior (no model) | 76.9% | 96.2% | 100.0% | 0.869 |
| S3: + model interpretation | 76.9% | 92.3% | 100.0% | 0.859 |
| S4: + one clarifying question (simulated) | 80.8% | 92.3% | 100.0% | 0.878 |
| S5: + none-of-these handling (full v2) | 80.8% | 92.3% | 100.0% | 0.878 |

Reading:

- The content model does most of the work. Everything else is refinement.
- The rule-based time prior (one fitted probability) adds 7.7 points of Recall@1 and fixes every top-5 miss on its own.
- The model interpreter did not add measurable value on this test set. During this evaluation run the shared model endpoint rate-limited every attempt (0 of 87 calls succeeded, HTTP 429), so S3 is effectively the fallback path; the UI label and reason strings reflect that honestly, and the deployment behaves the same way. In earlier isolated runs the model stage worked (about 1 to 1.7 s per cue) and produced usable rewrites; measuring its true contribution remains open until a dedicated key is configured (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, or `ZAI_CONFIG`).
- The clarifying question (simulated oracle: the correct option when the target is among the two candidates) adds 3.9 points of Recall@1. It is an upper bound, not a human measurement; the memory-task mode exists to replace it with real data.

## Recall@1 by query style (full v2, small n per row)

| Style | Recall@1 | n |
| --- | --- | --- |
| event-anchor | 100% | 6 |
| undescribable ("can't describe it") | 100% | 2 |
| visual | 90.0% | 10 |
| relative-time | 80.0% | 5 |
| wrong-date (confidently wrong) | 66.7% | 3 |
| mixed (Hinglish) | 33.3% | 6 |

The Hinglish result is the clearest remaining weakness and matches the known limits of an English-centered CLIP text tower. The evaluation's design shows exactly where a multilingual text encoder would earn its place.

## Calibration

Reliability table (test present queries, full v2; displayed confidence capped at 95%):

| Displayed confidence | Queries | Average confidence | Observed top-1 accuracy |
| --- | --- | --- | --- |
| 0 to 10% | 9 | 0.03 | 0.56 |
| 10 to 20% | 4 | 0.17 | 0.75 |
| 20 to 30% | 2 | 0.22 | 1.00 |
| 30 to 40% | 2 | 0.38 | 1.00 |
| 40 to 50% | 2 | 0.45 | 1.00 |
| 60 to 70% | 3 | 0.67 | 1.00 |
| 70 to 80% | 3 | 0.76 | 0.67 |
| 90 to 100% | 1 | 0.91 | 1.00 |

Expected calibration error: 0.287. The system is mildly over-confident in the low bins (small n; wide intervals). Bands were derived on dev, not hand-set: High at top-1 confidence of at least 0.60 (where dev top-1 precision first reached 80 percent), Medium at 0.12 (50 percent). Read shapes, not digits: the test split is 26 queries.

## None of these, and ghosts

- Absent-target queries (n=4 test): none-of-these landed on top in 0 of 4 (Wilson 95%: 0.0 to 49.0); average none-probability 3.4 percent. All four failures are the same failure: each held-out target has a near-duplicate in the index (for example a family dinner lookalike, a beach with similar rocks), and content matching cannot tell a duplicate from the target. A joint dev fit that pushed the none logit high enough to win on dev absent queries (8 of 8) made present queries worse (18 of 26 wrongly told "none of these"); the joint log-loss optimum was chosen instead and the limitation is reported rather than tuned away on the test set. The detector does separate out-of-distribution queries (in dev, glass bottles on a fence and a Manhattan-style skyline scored clearly higher none-probabilities than targets-present queries).
- Ghost scenarios (n=5): an existence statement (never the photo as a result) appeared in 4 of 5 (Wilson 95%: 37.6 to 96.4). The miss: a ghost whose near-duplicate living photo scored higher, so the run resolved as a found-style answer pointing at the wrong-but-same-day photo.

## Latency and size (measured)

- Library payload: 13.5 MB for 158 photos (about 86 KB average), thumbnails lazy-loaded.
- Text model: 65 MB quantized ONNX, downloaded once in the worker, then browser-cached; warm text embedding is 7 to 17 ms in Node and a few hundred milliseconds in the browser worker.
- Index build: 158 images in about 16 s (embedding 14 s), one command, deterministic; the written index is 0.69 MB.
- Server score stage: single-digit milliseconds. Interpretation stage: about 1.0 to 1.7 s when the model responds; 0 ms parser path; on the deployed preview the model is not configured, so the parser path runs and says so.
- Production architecture note: the server never loads a model. The browser worker pays the 65 MB once; a serverless function bundling the runtime plus the model would risk platform size limits and per-instance cold starts.

## What did not work, what could not be verified

- The model interpreter could not be measured on the deployed environment: no interpreter key is configured, and during the evaluation window the shared endpoint returned 429 for all 87 attempts. The fallback path is what the numbers show, and the UI reports the fallback by design. Contribution of the LLM stage: not verified.
- None-of-these detection under near-duplicates: not solved (see above).
- The ghost-vs-lookalike case: one of five ghost queries resolved to a same-day lookalike instead of an existence statement.
- Multilingual queries: weak, inherited from the embedding model; measured, not fixed.
- Statistical power: 26 present-target test queries means every interval is wide. Nothing here claims significance; the ablation deltas are descriptive.

## Reproduce

```
bun scripts/index-library.ts        # rebuild the index (one command)
bun scripts/pick-heldout.ts         # regenerate the 15% holdout (seeded)
bun eval/fit-calibration.ts         # fit a, pi, T, noneLogit on dev; derive bands
bun eval/run-eval.ts [--llm]        # run the full evaluation, writes eval/results.json
bun tests/engine2-check.ts          # engine unit tests
```
