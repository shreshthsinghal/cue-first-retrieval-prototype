// Sanity: embed 3 queries in Node and run the v2 engine end to end.
import { pipeline, env, CLIPTextModelWithProjection, AutoTokenizer } from '@huggingface/transformers'
import { ENTRIES, INDEX, PERSONA } from '../src/lib/engine2/index-loader'
import { interpretCue } from '../src/lib/engine2/interpreter'
import { makeRetriever } from '../src/lib/engine2/retrieve2'

env.cacheDir = './.cache/hf'
const MODEL_ID = 'Xenova/clip-vit-base-patch32'

const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID)
const textModel = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' })
async function embed(text: string): Promise<number[]> {
  const inputs = tokenizer([text], { padding: true, truncation: true })
  const outputs = await textModel(inputs)
  return Array.from(outputs.text_embeds.normalize(2, 1).data as Float32Array)
}

const retrieve = makeRetriever(ENTRIES)

const probes = [
  'a sea of hands at the concert with purple beams cutting the sky',
  'that crowded beach with colorful umbrellas and a huge rock arch over the water, feb 2024',
  'a person in a red jacket standing before a huge snowy pyramid peak',
  'me blowing the candles at the lake birthday, the yellow dress one',
]

const t0 = Date.now()
for (const cue of probes) {
  const embedding = await embed(cue)
  const interpretation = await interpretCue(cue, PERSONA)
  const res = retrieve({ cue, interpretation, texts: [{ role: 'raw', text: cue, embedding }] })
  console.log(`\nQ: ${cue}`)
  console.log(`   outcome=${res.outcome} nonePct=${res.nonePct} time=${interpretation.time.center} (${interpretation.time.kind}, ${interpretation.time.matched}) anchor=${interpretation.eventAnchor?.key ?? 'none'}`)
  for (const r of res.results.slice(0, 3)) console.log(`   ${(r.probability * 100).toFixed(0)}% [${r.band}] ${r.id} ${r.deleted ? '(DELETED)' : ''} :: ${r.reason.slice(0, 90)}`)
  if (res.existenceStatement) console.log(`   GHOST: ${res.existenceStatement.ghost.id} prob=${res.existenceStatement.ghost.probability} sameDay=${res.existenceStatement.sameDay.length}`)
}
console.log('\ntotal ms:', Date.now() - t0)
