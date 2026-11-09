// Étape 1 du build : lit le dump kaikki.org du Wiktionnaire FR en flux (3 Go, rien n'est stocké)
// et garde, par mot français simple : synonymes, dérivés et mots de l'étymologie.
// Usage : node scripts/extract-wiktionnaire.mjs sortie.jsonl
import { createWriteStream } from 'node:fs'

const URL = 'https://kaikki.org/frwiktionary/Français/kaikki.org-dictionary-Français.jsonl'
const out = createWriteStream(process.argv[2] ?? 'wik.jsonl')
const simple = (w) => typeof w === 'string' && /^[\p{L}]+$/u.test(w)
const words = (list) => [...new Set((list ?? []).map((x) => x.word).filter(simple))]

const res = await fetch(URL)
if (!res.ok) throw new Error('HTTP ' + res.status)
const dec = new TextDecoder()
let buf = ''
let n = 0
let kept = 0
const handle = (line) => {
  if (!line) return
  n++
  const o = JSON.parse(line)
  if (o.lang_code !== 'fr' || !simple(o.word)) return
  const syn = words([...(o.synonyms ?? []), ...(o.senses ?? []).flatMap((s) => s.synonyms ?? [])])
  const der = words([...(o.derived ?? []), ...(o.related ?? [])])
  const ety = [...new Set((o.etymology_links ?? []).map((l) => l[1]?.split('#')).filter((p) => p?.[1] === 'fr' && simple(p[0])).map((p) => p[0]))]
  if (syn.length + der.length + ety.length === 0) return
  kept++
  out.write(JSON.stringify({ w: o.word, p: o.pos, syn, der, ety }) + '\n')
}
for await (const chunk of res.body) {
  buf += dec.decode(chunk, { stream: true })
  let i
  let start = 0
  while ((i = buf.indexOf('\n', start)) >= 0) {
    handle(buf.slice(start, i))
    start = i + 1
  }
  buf = buf.slice(start)
}
handle(buf)
out.end()
console.error(`lu ${n} entrées, gardé ${kept}`)
