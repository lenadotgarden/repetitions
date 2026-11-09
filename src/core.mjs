// Détecteur de répétitions : logique pure, sans dépendance, tourne dans Node et dans le navigateur.

const STOP_FORMS = new Set(`
le la les un une des du de au aux ce cet cette ces mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs
je tu il elle on nous vous ils elles me te se lui eux moi toi soi y en qui que quoi dont où
et ou mais donc or ni car si comme quand lorsque puisque quoique
dans sur sous avec sans pour par vers chez entre contre selon après avant depuis pendant jusque
ne pas plus moins très trop aussi bien alors ainsi encore déjà toujours jamais puis enfin
tout tous toute toutes même autre autres tel telle tels telles quel quelle quels quelles chaque quelque
ceci cela ça celui celle ceux celles ici là voici voilà oui non
ai as ont est sont suis es sommes êtes été étant eu fait faire va vont`.split(/\s+/))
// Verbes trop courants pour compter comme répétition.
const STOP_LEMMAS = new Set(['être', 'avoir', 'aller', 'faire', 'pouvoir', 'vouloir', 'devoir', 'falloir'])
const MIN_LEN = 3

export function loadDict(text) {
  const d = { forms: new Map(), byLemma: new Map(), syn: new Map(), fam: new Map() }
  const push = (m, k, v) => (m.has(k) ? m.get(k).push(v) : m.set(k, [v]))
  for (const line of text.split('\n')) {
    const p = line.split(' ')
    if (p[0] === 'f') {
      const [, lemma, cat, ...items] = p
      const inflections = new Map()
      for (const it of items) {
        const i = it.lastIndexOf(':')
        const form = it.slice(0, i)
        for (const feat of it.slice(i + 1).split(',')) {
          push(d.forms, form, { lemma, cat, feat })
          if (!inflections.has(feat)) inflections.set(feat, form)
        }
      }
      d.byLemma.set(lemma + ' ' + cat, inflections)
    } else if (p[0] === 's') {
      // plusieurs fichiers complètent un lemme ; les synonymes cités par plusieurs sources passent devant
      const k = p[1] + ' ' + p[2]
      const seen = d.syn.get(k) ?? d.syn.set(k, new Map()).get(k)
      for (const s of new Set(p[3].split(','))) seen.set(s, (seen.get(s) ?? 0) + 1)
    }
    else if (p[0] === 'r') d.fam.set(p[1], new Set([...(d.fam.get(p[1]) ?? []), ...p[2].split(',')]))
  }
  for (const [k, m] of d.syn) d.syn.set(k, [...m].sort((a, b) => b[1] - a[1]).map(([s]) => s))
  return d
}

// Remplace par des espaces (donc mêmes positions) ce qui n'est pas du texte à relire.
function mask(text) {
  const blank = (m) => m.replace(/[^\n]/g, ' ')
  return text
    .replace(/^---\n[\s\S]*?\n---(?=\n|$)/, blank)
    .replace(/(```|~~~)[\s\S]*?(\1|$)/g, blank)
    .replace(/`[^`\n]*`/g, blank)
    .replace(/\]\([^)\n]*\)/g, blank)
    .replace(/<[^>\n]*>/g, blank)
    .replace(/https?:\/\/\S+/g, blank)
}

function tokenize(text) {
  const clean = mask(text)
  const tokens = []
  for (const m of clean.matchAll(/\p{L}+/gu)) {
    const prev = clean[m.index - 1]
    tokens.push({ word: m[0], lower: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length, elided: prev === "'" || prev === '’' })
  }
  return tokens
}

function resolveLemmas(tokens, dict) {
  const cands = tokens.map((t) => [...new Set((dict.forms.get(t.lower) ?? []).map((e) => e.lemma))])
  const count = new Map()
  for (const c of cands) for (const l of c) count.set(l, (count.get(l) ?? 0) + 1)
  tokens.forEach((t, i) => {
    // forme ambiguë (porte : nom ou verbe) : on garde le lemme le plus fréquent dans le texte
    t.lemma = cands[i].length ? cands[i].reduce((a, b) => (count.get(b) > count.get(a) ? b : a)) : t.lower
    t.skip = t.lower.length < MIN_LEN || STOP_FORMS.has(t.lower) || STOP_LEMMAS.has(t.lemma)
  })
}

const related = (dict, a, b) => a === b || dict.fam.get(a)?.has(b) || dict.fam.get(b)?.has(a)

// Mots devant lesquels le choix de la forme dépend de la 1re lettre (ce/cet, le/l', ma/mon...)
const SENSITIVE = new Set(['ce', 'le', 'la', 'de', 'que', 'je', 'ne', 'me', 'te', 'se', 'si', 'ma', 'ta', 'sa'])
const vowelStart = (w) => /^[aeiouyàâäéèêëîïôöùûüœh]/i.test(w)

function suggest(t, dict, prev) {
  if (t.elided) return [] // shortcut: l'élision (l'arbre → le bois) n'est pas recalculée, à améliorer si besoin
  const out = new Map()
  for (const e of dict.forms.get(t.lower) ?? []) {
    if (e.lemma !== t.lemma) continue
    for (const s of dict.syn.get(t.lemma + ' ' + e.cat) ?? []) {
      const form = dict.byLemma.get(s + ' ' + e.cat)?.get(e.feat)
      if (form && form !== t.lower && !out.has(form) && !(prev && SENSITIVE.has(prev.lower) && vowelStart(form) !== vowelStart(t.lower))) out.set(form, s)
    }
  }
  return [...out].map(([form, lemma]) => ({ form, lemma }))
}

function matchCase(from, to) {
  if (from.length > 1 && from === from.toUpperCase()) return to.toUpperCase()
  return from[0] === from[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to
}

function scan(text, dict, { window = 50 } = {}) {
  const tokens = tokenize(text)
  resolveLemmas(tokens, dict)
  const parent = tokens.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const linked = new Set()
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].skip) continue
    for (let j = i + 1; j < tokens.length && j - i <= window; j++) {
      if (!tokens[j].skip && related(dict, tokens[i].lemma, tokens[j].lemma)) {
        parent[find(j)] = find(i)
        linked.add(i).add(j)
      }
    }
  }
  const groups = new Map()
  for (const i of linked) (groups.get(find(i)) ?? groups.set(find(i), []).get(find(i))).push(i)
  const repetitions = [...groups.values()]
    .map((idx) => idx.sort((a, b) => a - b))
    .map((idx) => {
      const lemmas = idx.map((i) => tokens[i].lemma)
      const lemma = lemmas.sort((a, b) => lemmas.filter((x) => x === b).length - lemmas.filter((x) => x === a).length)[0]
      return {
        lemma,
        family: new Set(lemmas).size > 1,
        occurrences: idx.map((i) => {
          const t = tokens[i]
          return { word: t.word, start: t.start, end: t.end, suggestions: suggest(t, dict, tokens[i - 1]).map((s) => matchCase(t.word, s.form)), _i: i }
        }),
      }
    })
    .sort((a, b) => a.occurrences[0].start - b.occurrences[0].start)
  return { repetitions, _tokens: tokens }
}

export function analyze(text, dict, opts) {
  const { repetitions } = scan(text, dict, opts)
  return { repetitions: repetitions.map((g) => ({ ...g, occurrences: g.occurrences.map(({ _i, ...o }) => o) })) }
}

export function fix(text, dict, opts = {}) {
  const { repetitions, _tokens: tokens } = scan(text, dict, opts)
  const window = opts.window ?? 50
  const replacements = []
  for (const g of repetitions) {
    for (const o of g.occurrences.slice(1)) {
      const t = tokens[o._i]
      // on évite de recréer une répétition avec le synonyme choisi
      const near = tokens.slice(Math.max(0, o._i - window), o._i + window + 1).map((x) => x.lemma)
      const pick = suggest(t, dict, tokens[o._i - 1]).find((s) => !near.some((l) => related(dict, l, s.lemma)))
      if (!pick) continue
      t.lemma = pick.lemma
      replacements.push({ start: o.start, end: o.end, from: o.word, to: matchCase(o.word, pick.form) })
    }
  }
  let out = text
  for (const r of [...replacements].sort((a, b) => b.start - a.start)) out = out.slice(0, r.start) + r.to + out.slice(r.end)
  return { text: out, replacements }
}
