// Mini dictionnaire de test, même format que dict/fr.txt (voir README).
// f lemme cat forme:traits,traits ...   s lemme cat syn,syn   r lemme proche,proche
export const FIXTURE = `
f marcher v marche:P1s,P3s marchait:I3s marchaient:I3p marchons:P1p
f déambuler v déambule:P1s,P3s déambulait:I3s déambulaient:I3p déambulons:P1p
f flâner v flâne:P1s,P3s flânait:I3s
f chemin nc chemin:ms chemins:mp
f route nc route:fs routes:fp
f sentier nc sentier:ms sentiers:mp
f beau adj beau:ms belle:fs beaux:mp belles:fp
f joli adj joli:ms jolie:fs jolis:mp jolies:fp
f chanter v chante:P1s,P3s chantait:I3s
f chanteur nc chanteur:ms chanteurs:mp
f chant nc chant:ms chants:mp
f porter v porte:P1s,P3s
f porte nc porte:fs portes:fp
s marcher v déambuler,flâner
s déambuler v marcher
s flâner v marcher
s chemin nc route,sentier
s route nc chemin
s sentier nc chemin
s beau adj joli
s joli adj beau
r chanter chanteur,chant
r chanteur chanter,chant
r chant chanter,chanteur
`
