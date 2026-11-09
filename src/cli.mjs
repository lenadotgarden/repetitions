#!/usr/bin/env node
// Usage : node src/cli.mjs [fichier.md] [--fix] [--json] [--window N]   (sans fichier : lit l'entrée standard)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadDict, analyze, fix } from './core.mjs'

const args = process.argv.slice(2)
const flag = (n) => args.includes(n)
const wi = args.indexOf('--window')
const window = wi >= 0 ? Number(args[wi + 1]) : 50
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--window')
if (flag('--help') || (!file && process.stdin.isTTY)) {
  console.error('Usage : node src/cli.mjs [fichier.md] [--fix] [--json] [--window N]')
  process.exit(flag('--help') ? 0 : 1)
}

const dir = new URL('../dict/', import.meta.url)
const dict = loadDict(['wiktionnaire', 'synonymes', 'formes'].map((n) => readFileSync(fileURLToPath(new URL(n + '.txt', dir)), 'utf8')).join('\n'))
const text = readFileSync(file ?? 0, 'utf8')

if (flag('--fix')) {
  const r = fix(text, dict, { window })
  console.log(flag('--json') ? JSON.stringify(r, null, 2) : r.text)
} else {
  const r = analyze(text, dict, { window })
  if (flag('--json')) console.log(JSON.stringify(r, null, 2))
  else if (!r.repetitions.length) console.log('Aucune répétition.')
  else
    for (const g of r.repetitions) {
      const words = g.occurrences.map((o) => o.word).join(', ')
      const sug = g.occurrences[1]?.suggestions.slice(0, 5).join(', ')
      console.log(`${g.lemma}${g.family ? ' (famille)' : ''} x${g.occurrences.length} : ${words}${sug ? '  -> ' + sug : ''}`)
    }
}
