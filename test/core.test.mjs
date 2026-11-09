import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadDict, analyze, fix } from '../src/core.mjs'
import { FIXTURE } from './fixture.mjs'

const dict = loadDict(FIXTURE)
const lemmas = (r) => r.repetitions.map((g) => g.lemma)

test('détecte un même mot répété', () => {
  const r = analyze('Le chemin est long. Ce chemin est beau.', dict)
  assert.deepEqual(lemmas(r), ['chemin'])
  assert.equal(r.repetitions[0].occurrences.length, 2)
})

test('rapproche les formes fléchies du même lemme', () => {
  const r = analyze('Elle marchait vite. Nous marchons ensemble.', dict)
  assert.deepEqual(lemmas(r), ['marcher'])
})

test('rapproche les mots de la même famille', () => {
  const r = analyze('Le chanteur est là. Il chante bien.', dict)
  assert.equal(r.repetitions.length, 1)
  assert.equal(r.repetitions[0].family, true)
})

test('ignore les mots vides', () => {
  assert.deepEqual(lemmas(analyze('Il dit que le chat et le chien et la table.', dict)).includes('le'), false)
})

test('ignore les répétitions hors de la fenêtre', () => {
  const L = 'abcdefghijklmnopqrstuvwxyz'
  const filler = Array.from({ length: 60 }, (_, i) => 'zq' + L[i % 26] + L[Math.floor(i / 26)]).join(' ') // mots tous distincts
  const r = analyze(`chemin ${filler} chemin`, dict, { window: 50 })
  assert.deepEqual(lemmas(r), [])
})

test('ignore le markdown technique (code, liens, frontmatter)', () => {
  const md = '---\ntags: chemin\n---\nUn chemin `chemin` [lien](http://chemin.fr/chemin)\n```\nchemin\n```'
  assert.deepEqual(lemmas(analyze(md, dict)), [])
})

test('garde le texte des liens et des titres', () => {
  const r = analyze('# Chemin\nUn [chemin](http://x.fr) long.', dict)
  assert.deepEqual(lemmas(r), ['chemin'])
})

test('les positions pointent vers le texte original', () => {
  const t = 'Un [beau](u) chemin et un beau chemin.'
  const r = analyze(t, dict)
  for (const g of r.repetitions) for (const o of g.occurrences) assert.equal(t.slice(o.start, o.end), o.word)
})

test('propose des synonymes accordés', () => {
  const r = analyze('Elle marchait. Ils marchaient.', dict)
  const second = r.repetitions[0].occurrences[1]
  // flâner n'a pas de forme I3p dans le dictionnaire : seul déambuler est accordable
  assert.deepEqual(second.suggestions, ['déambulaient'])
})

test('fix remplace la 2e occurrence et garde la 1re', () => {
  const r = fix('Elle marchait. Ils marchaient.', dict)
  assert.equal(r.text, 'Elle marchait. Ils déambulaient.')
  assert.equal(r.replacements.length, 1)
})

test('fix garde la majuscule', () => {
  assert.equal(fix('Il marche. Marchons.', dict).text.includes('Déambulons'), true)
})

test('fix ne remplace pas un nom si le genre change', () => {
  // chemin (m) -> route (f) refusé, sentier (m) accepté
  assert.equal(fix('Un chemin. Un chemin.', dict).text, 'Un chemin. Un sentier.')
})

test('fix ne touche pas au markdown autour', () => {
  assert.equal(fix('**Elle marchait.** Ils marchaient.', dict).text, '**Elle marchait.** Ils déambulaient.')
})

test('fix ne remplace pas après une élision', () => {
  assert.equal(fix("Un chemin. L'chemin.", dict).text, "Un chemin. L'chemin.")
})

test('mot inconnu du dictionnaire : répétition exacte détectée, pas de synonyme', () => {
  const r = analyze('Zorglub vient. Zorglub part.', dict)
  assert.deepEqual(lemmas(r), ['zorglub'])
  assert.deepEqual(r.repetitions[0].occurrences[1].suggestions, [])
})

test('fix ne remplace pas si le déterminant dépend de la voyelle initiale (ce chemin / cet ...)', () => {
  const d = loadDict(FIXTURE + '\nf abri nc abri:ms abris:mp\ns chemin nc abri,sentier')
  assert.equal(fix('Un chemin. Ce chemin.', d).text, 'Un chemin. Ce sentier.')
})

test('les synonymes cités par plusieurs sources passent en premier', () => {
  const d = loadDict(FIXTURE + '\ns chemin nc voie\ns chemin nc voie,sentier\nf voie nc voie:fs\nf sentier nc sentier:ms')
  // "voie" est féminin, chemin masculin : seul sentier reste, il reste premier
  assert.equal(analyze('Un chemin. Un chemin.', d).repetitions[0].occurrences[1].suggestions[0], 'sentier')
})
