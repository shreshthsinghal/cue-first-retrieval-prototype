import { embedText, saveEmbedCache } from './lib/common'
const text = process.argv[2]
const v = await embedText(text)
saveEmbedCache()
console.log(JSON.stringify(v))
