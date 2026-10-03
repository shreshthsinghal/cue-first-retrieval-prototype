# Scripts: rebuild everything with one command each

Prerequisites: `bun install`, then one `bun scripts/index-library.ts` run downloads the CLIP weights into `cache-hf/` (about 155 MB total, cached).

## The full library + index pipeline, in order

| Command | What it does |
| --- | --- |
| `bun scripts/fetch-candidates.ts` | download candidate photos from Unsplash CDN (resumable) |
| `bun scripts/fetch-picsum.ts` | download Picsum fillers (authors recorded) |
| `python3 scripts/render-screenshots.py` | render the 8 chat screenshots |
| `bun scripts/build-manifest.ts` | assemble the curated camera-roll (first half) |
| `bun scripts/extend-manifest.ts` | everyday-photo extension (second half) |
| `bun scripts/finalize-manifest.ts` | merge + screenshots -> `data/library-manifest.json` |
| `bun scripts/index-library.ts` | embed all images, derive clusters + screenshot/indoor/people probes + hint chips -> `data/image-index.json` |

## Evaluation pipeline, in order

| Command | What it does |
| --- | --- |
| `bun scripts/pick-heldout.ts` | choose the 15% holdout + query targets (seeded) -> `eval/splits.json` |
| `python3 scripts/query-sheets.py` | contact sheets used while writing the held-out queries |
| `bun scripts/build-label-view.ts` | CLIP auto-tagged label view for the baselines -> `eval/labels.json` |
| `bun eval/fit-calibration.ts` | fit a, pi, T, noneLogit on dev + derive band cutoffs |
| `bun eval/run-eval.ts [--llm]` | run baselines + ablation + calibration on test -> `eval/results.json` |
| `bun tests/engine2-check.ts` | engine unit tests |

`eval/queries.jsonl` holds the held-out queries. Format: one JSON object per line with `id`, `target`, `present`, `style`, `lang`, `text`. To add tester queries (for example from the memory-task exports), append lines in the same format; the README in `docs/tester-guide.md` describes the export.
