# Répétitions

Détecte les répétitions dans un texte français (même mot, formes conjuguées ou accordées, mots de la même famille) et propose des synonymes accordés. Sans IA, sans serveur, sans dépendance.

**Interface web** : https://lenadotgarden.github.io/repetitions/ (tout se passe dans ton navigateur, rien n'est envoyé). Les répétitions sont soulignées directement dans le texte : un clic sur un mot ouvre ses synonymes (un clic les applique), les flèches passent d'une occurrence à l'autre, un mot remplacé affiche l'original au survol et peut être remis. « Tout corriger » applique tout d'un coup, « Tout annuler » revient en arrière.

## En ligne de commande (humains et IA)

Node 20+ suffit.

```bash
node src/cli.mjs texte.md              # liste des répétitions
node src/cli.mjs texte.md --json       # idem en JSON (pour un script ou une IA)
node src/cli.mjs texte.md --fix        # texte corrigé sur la sortie standard
node src/cli.mjs texte.md --fix --json # texte corrigé + liste des remplacements
cat texte.md | node src/cli.mjs        # entrée standard
```

Option `--window N` : distance maximale en mots entre deux répétitions (50 par défaut).

Sortie JSON de la détection :

```json
{ "repetitions": [ { "lemma": "chemin", "family": false,
    "occurrences": [ { "word": "chemin", "start": 17, "end": 23, "suggestions": ["sentier", "circuit"] } ] } ] }
```

`start` et `end` sont des positions dans le texte d'origine.

## Comment ça marche

1. Le markdown technique (frontmatter, blocs de code, code inline, URL, cibles de liens, balises HTML) est masqué, le reste est lu.
2. Chaque mot est ramené à son lemme grâce au dictionnaire de formes (une forme ambiguë prend le lemme le plus fréquent du texte). Les mots vides et les verbes très courants (être, avoir, aller, faire...) sont ignorés.
3. Deux mots sont une répétition s'ils ont le même lemme, ou des lemmes de la même famille (même racine visible), à moins de N mots l'un de l'autre. Les locutions voulues (*petit à petit*, *étape par étape*, *jour après jour*, *de jour en jour*) sont ignorées.
4. La correction garde la première occurrence et remplace les suivantes par un synonyme (classé : sources concordantes d'abord, puis mots bien documentés), ré-accordé (nombre, genre, temps, personne) avec la table de formes. Un synonyme déjà présent dans le voisinage est écarté.

## Limites connues

La correction est une aide, à relire :
- le sens n'est pas vérifié : un synonyme de *marcher* peut être *fonctionner* ;
- les constructions ne sont pas recalculées (prépositions, article après un nom de genre différent : on refuse un nom si le genre change, mais pas `beau` / `bel`) ;
- pas de remplacement après une élision (`l'arbre`) ni quand le déterminant dépend de la 1re lettre (`ce` / `cet`) ;
- les familles de mots viennent de l'étymologie du Wiktionnaire : incomplètes ;
- les noms propres et les mots absents du dictionnaire ne sont détectés qu'en répétition exacte, sans synonyme.

## Développement

```bash
npm test    # node:test, aucun paquet à installer
```

- `src/core.mjs` : toute la logique (navigateur et Node).
- `src/cli.mjs` : la ligne de commande.
- `index.html` : l'interface web.
- `dict/` : dictionnaires générés (voir ci-dessous).
- `scripts/` : reconstruction des dictionnaires.

Reconstruire `dict/` :

```bash
node scripts/extract-wiktionnaire.mjs wik.jsonl          # lit ~3 Go en flux, rien n'est stocké
node scripts/build-dict.mjs lefff_morpho-3.5.json thes_fr.dat wik.jsonl
```

## Licences

Le code est sous licence MIT. Les dictionnaires de `dict/` ont chacun leur licence : voir [NOTICE.md](NOTICE.md).
