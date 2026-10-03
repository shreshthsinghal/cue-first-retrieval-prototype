// Browser text encoder worker: loads the CLIP text tower (quantized, about
// 65 MB, browser-cached after the first visit) and embeds query texts.
// transformers.js loads from the CDN per its documented browser usage; model
// weights load straight from the Hugging Face CDN. All traffic stays on the
// client: nothing is uploaded, nothing is stored server-side.

import { AutoTokenizer, CLIPTextModelWithProjection, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0';

env.allowLocalModels = false;

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
let tokenizer = null;
let model = null;

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID, {
        progress_callback: (p) => {
          if (p.status === 'progress') self.postMessage({ type: 'progress', pct: p.progress ?? 0 });
        },
      });
      model = await CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: 'q8' });
      self.postMessage({ type: 'ready' });
      return;
    }
    if (msg.type === 'embed') {
      if (!tokenizer || !model) throw new Error('encoder not ready');
      const t0 = performance.now();
      const vectors = [];
      for (const text of msg.texts) {
        const inputs = tokenizer([String(text).slice(0, 300)], { padding: true, truncation: true });
        const outputs = await model(inputs);
        vectors.push(Array.from(outputs.text_embeds.normalize(2, 1).data, (v) => Math.round(v * 1000000) / 1000000));
      }
      self.postMessage({ type: 'embeddings', id: msg.id, vectors, ms: Math.round(performance.now() - t0) });
      return;
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : 'worker error' });
  }
};
