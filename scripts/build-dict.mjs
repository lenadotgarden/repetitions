// Étape 2 du build : fabrique les 3 fichiers de dict/ à partir des sources (voir NOTICE.md).
// Usage : node scripts/build-dict.mjs lefff.json thes_fr.dat wik.jsonl
// (lefff.json : huggingface.co/datasets/sagot/lefff_morpho, thes_fr.dat : LibreOffice/dictionaries,
//  wik.jsonl : sortie de scripts/extract-wiktionnaire.mjs)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const [lefffPath, thesPath, wikPath] = process.argv.slice(2)
const MAX_SYN = 12
const MAX_SIBLINGS = 30
const CATS = new Set(['nc', 'adj', 'v', 'adv'])
const letters = (w) => /^\p{L}+$/u.test(w)

// 1. Lefff -> formes fléchies : une ligne "f lemme cat forme:traits,traits ..." par lemme et catégorie
const lefff = JSON.parse(readFileSync(lefffPath, 'utf8')).filter((e) => e.type === 'infl' && CATS.has(e.category) && letters(e.form) && letters(e.lemma))
const byLemma = new Map()
const lemmaOfCat = new Map() // "mot cat" -> lemme, pour relier les mots des autres sources
for (const e of lefff) {
  const key = e.lemma + ' ' + e.category
  const forms = byLemma.get(key) ?? byLemma.set(key, new Map()).get(key)
  const feats = forms.get(e.form) ?? forms.set(e.form, new Set()).get(e.form)
  feats.add(e.msfeatures)
  if (!lemmaOfCat.has(e.form + ' ' + e.category)) lemmaOfCat.set(e.form + ' ' + e.category, e.lemma)
}
for (const key of byLemma.keys()) lemmaOfCat.set(key, key.split(' ')[0]) // un lemme se représente lui-même
const lemmas = new Set([...byLemma.keys()].map((k) => k.split(' ')[0]))
const toLemma = (w, cat) => lemmaOfCat.get(w.toLowerCase() + ' ' + cat)
const toAnyLemma = (w) => (lemmas.has(w.toLowerCase()) ? w.toLowerCase() : [...CATS].map((c) => toLemma(w, c)).find(Boolean))

const header = (title, licence) => `# ${title}\n# Licence : ${licence} - voir NOTICE.md\n`
const formes = [...byLemma]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, forms]) => 'f ' + key + ' ' + [...forms].map(([f, t]) => f + ':' + [...t].join(',')).join(' '))
mkdirSync('dict', { recursive: true })
writeFileSync('dict/formes.txt', header('Formes fléchies : Lefff 3.5 (B. Sagot, INRIA)', 'LGPL-LR') + formes.join('\n') + '\n')

// 2. Thésaurus LibreOffice/Dicollecte -> synonymes par catégorie (paires réciproques seulement : bien plus fiables)
const THES_CAT = { Verbe: 'v', Nom: 'nc', Adjectif: 'adj', Adverbe: 'adv' }
const lines = readFileSync(thesPath, 'utf8').split('\n')
const thes = new Map() // "mot cat" -> synonymes bruts
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^([^|(]+)\|(\d+)$/)
  if (!m || !letters(m[1])) continue
  for (let k = 1; k <= Number(m[2]); k++) {
    const [pos, ...syn] = (lines[i + k] ?? '').split('|')
    for (const cat of (pos.match(/\p{L}+/gu) ?? []).map((p) => THES_CAT[p]).filter(Boolean)) {
      const key = m[1] + ' ' + cat
      thes.set(key, [...new Set([...(thes.get(key) ?? []), ...syn.filter(letters)])])
    }
  }
}
// map "lemme cat" -> Set(synonymes)
const add = (m, a, cat, b) => a && b && a !== b && (m.get(a + ' ' + cat) ?? m.set(a + ' ' + cat, new Set()).get(a + ' ' + cat)).add(b)
const thesSyn = new Map()
for (const [key, list] of thes) {
  const [w, cat] = key.split(' ')
  const a = toLemma(w, cat)
  for (const s of list) {
    const b = toLemma(s, cat)
    if (b && thes.get(s + ' ' + cat)?.some((x) => toLemma(x, cat) === a)) add(thesSyn, a, cat, b)
  }
}
const synLines = (map) =>
  [...map]
    .filter(([, s]) => s.size)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, s]) => 's ' + k + ' ' + [...s].slice(0, MAX_SYN).join(','))
writeFileSync('dict/synonymes.txt', header('Synonymes : thésaurus français myThes 2.3 (F. Labbé, Dicollecte)', 'LGPL 2.1+') + synLines(thesSyn).join('\n') + '\n')

// 3. Wiktionnaire -> synonymes en plus + familles de mots (étymologie : mots dérivés d'un même mot)
const WIK_CAT = { noun: 'nc', verb: 'v', adj: 'adj', adv: 'adv' }
const wik = readFileSync(wikPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
const wikSyn = new Map()
const fam = new Map()
// Les liens étymologiques lointains (demain < de + main, matin) ne sont pas des familles : on exige une racine visible.
const sameStem = (a, b) => {
  let n = 0
  while (n < a.length && a[n] === b[n]) n++
  return n >= 4 || (n === Math.min(a.length, b.length) && n >= 3) || (b.length >= 4 && a.includes(b)) || (a.length >= 4 && b.includes(a))
}
const link = (a, b) => a && b && a !== b && sameStem(a, b) && (fam.get(a) ?? fam.set(a, new Set()).get(a)).add(b) && (fam.get(b) ?? fam.set(b, new Set()).get(b)).add(a)
const children = new Map()
for (const e of wik) {
  const cat = WIK_CAT[e.p]
  const a = cat && toLemma(e.w, cat)
  if (a) for (const s of e.syn) { const b = toLemma(s, cat); add(wikSyn, a, cat, b); add(wikSyn, b, cat, a) }
  const anyA = a ?? toAnyLemma(e.w)
  for (const p of e.ety) {
    const b = toAnyLemma(p)
    link(anyA, b)
    if (anyA && b) (children.get(b) ?? children.set(b, new Set()).get(b)).add(anyA)
  }
}
// parents-pivots trop fréquents (déverbal, apocope...) : termes de linguistique, pas des familles
for (const [parent, kids] of children) {
  if (kids.size > MAX_SIBLINGS) { for (const k of kids) fam.get(k)?.delete(parent); fam.delete(parent); continue }
  for (const x of kids) for (const y of kids) link(x, y)
}
const famLines = [...fam]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([l, s]) => 'r ' + l + ' ' + [...s].join(','))
const wikSynLines = synLines(wikSyn)
writeFileSync('dict/wiktionnaire.txt', header('Synonymes et familles : Wiktionnaire français (contributeurs)', 'CC BY-SA 4.0') + wikSynLines.join('\n') + '\n' + famLines.join('\n') + '\n')

console.error(`formes: ${formes.length} lemmes+cat, synonymes thésaurus: ${synLines(thesSyn).length}, synonymes wiktionnaire: ${wikSynLines.length}, familles: ${famLines.length}`)
