# Sources et licences des dictionnaires

Le code du dépôt (`src/`, `scripts/`, `test/`, `index.html`) est sous licence MIT (voir `LICENSE`). Les fichiers de `dict/` sont des données dérivées de ressources tierces, chacune sous sa propre licence. Ils sont séparés par licence et ne sont jamais fusionnés dans un même fichier.

## dict/formes.txt - Lefff
- Source : Lefff 3.5, Benoît Sagot (INRIA), https://huggingface.co/datasets/sagot/lefff_morpho
- Licence : LGPL-LR (Lesser General Public License For Linguistic Resources)
- Transformation : formes fléchies des noms communs, adjectifs, verbes et adverbes, au format compact du projet.
- Référence : Sagot (2010), *The Lefff, a freely available and large-coverage morphological and syntactic lexicon for French*, LREC 2010.

## dict/synonymes.txt - Thésaurus français myThes 2.3
- Source : https://github.com/LibreOffice/dictionaries (fr_FR/dictionaries/thes_fr.dat), Frédéric Labbé, Dicollecte / Grammalecte.
- Licence : LGPL 2.1 ou supérieure
- Transformation : seules les paires de synonymes réciproques sont gardées, par catégorie grammaticale.

## dict/wiktionnaire.txt - Wiktionnaire
- Source : Wiktionnaire français (contributeurs), via l'extraction https://kaikki.org/frwiktionary/ (wiktextract).
- Licence : CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/
- Transformation : synonymes et liens étymologiques (mots dérivés d'un même mot) entre mots simples.

Pas de conseil juridique ici : si tu réutilises `dict/` ailleurs, vérifie la compatibilité de ces licences avec ton cas.
