# Page projet « Event Horizon »

Contenu prêt à saisir dans le formulaire d'administration des projets du portfolio
(page Projets, mode admin, « Ajouter un projet »).

## Champs

- **Titre** : Event Horizon
- **Statut** : en cours
- **Tags** : Three.js, WebGL 2, GLSL, TypeScript, React, Web Audio
- **Miniature** : `/event-horizon/01-nemesis.jpg`
- **Lien** : `/games`

**Description (FR)**

Jeu d'exploration spatiale en 3D qui tourne dans le navigateur. Seul à bord d'un vaisseau scientifique, on remonte un signal de détresse jusqu'à un trou noir dont la lentille gravitationnelle est calculée rayon par rayon.

**Description (EN)**

A 3D space exploration game that runs in the browser. Alone aboard a science vessel, you trace a distress signal to a black hole whose gravitational lensing is computed ray by ray.

## Contenu détaillé

À coller tel quel dans le champ « Contenu détaillé » (format `## Titre` puis une ligne par point).

```
## Le projet
Un jeu d'exploration contemplatif et inquiétant, sans combat, intégré à la page Jeux du portfolio.
Un vaisseau à piloter, un trou noir supermassif à l'échelle réelle (530 fois le diamètre d'une géante gazeuse), des épaves, des anomalies.
Une galaxie sans bord : chaque système stellaire est généré à partir d'une seed, et on saute de l'un à l'autre.
Une histoire courte à remonter d'indice en indice, avec une vraie fin.
Aucun fichier externe : modèles, textures, planètes et sons sont tous générés par le code.

## Le trou noir
Chaque pixel lance un rayon de lumière et le suit pendant que la gravité le courbe (géodésiques de Schwarzschild).
L'horizon, l'anneau de photons, le disque d'accrétion vu par-dessus et par-dessous et la déformation des étoiles sortent du même calcul, rien n'est dessiné à la main.
Le ciel est d'abord photographié dans une carte cubique HDR, que les rayons déviés viennent ensuite lire.
L'effet Doppler rend plus lumineux le côté du disque qui tourne vers l'observateur.

## Le moteur
Origine flottante : le vaisseau reste au centre de la scène et l'univers se déplace autour, ce qui évite les tremblements dus à la précision des nombres à grande distance.
Surfaces des planètes calculées par shader (bruit fractal), sans texture.
Un seul appel de dessin pour les 700 astéroïdes, les étoiles et les poussières.
Échelle réelle : 1 unité = 10 km, des distances en unités astronomiques, et une croisière dont la vitesse dépend de la distance à l'astre le plus proche.
Génération déterministe : la même case de la galaxie redonne toujours le même système, sans rien stocker.
Rendu HDR avec halo lumineux, et exposition qui s'adapte comme une pupille près du disque.

## Le son et l'ambiance
Tout le son est synthétisé en direct avec Web Audio : moteurs, scanner, compteur de radiations, coque qui grince près du trou noir.
Dans le vide on n'entend que le vaisseau : pas d'explosion ni de vent.
La peur vient du silence, des enregistrements laissés par une expédition disparue et d'un contact qui suit parfois le vaisseau.

## Deux bugs qui m'ont appris quelque chose
Écran entièrement noir : une seule valeur invalide dans le shader des réacteurs, que le halo lumineux étalait sur toute l'image. J'ai isolé l'objet fautif en masquant les éléments un par un.
Image figée une seconde à l'arrivée près d'une planète : une épave portait une lumière, et son apparition forçait la recompilation de tous les matériaux. J'ai trouvé la cause en comptant les programmes graphiques avant et après.
```

## Ce que j'en retiens

À saisir comme rubrique de type « reflection ».

```
## Ce que j'en retiens
Mesurer avant de corriger : mes deux premières hypothèses sur le blocage d'une seconde étaient fausses, c'est un compteur qui a donné la bonne.
Un rendu physiquement juste peut coûter moins cher qu'un trucage : la lentille gravitationnelle fait apparaître d'elle-même l'anneau de photons et le dessous du disque.
Découper en versions jouables m'a évité de tout construire en même temps.
```

## Galerie

| Fichier | Titre | Description |
| --- | --- | --- |
| `/event-horizon/01-nemesis.jpg` | NEMESIS-01 | Le trou noir, son disque d'accrétion et ses jets |
| `/event-horizon/07-disque.jpg` | Au ras du disque | L'anneau de photons et le dessous du disque, ramené au-dessus par la gravité |
| `/event-horizon/02-thalis.jpg` | Thalis | Planète océanique, surface et nuages calculés par shader |
| `/event-horizon/03-morne.jpg` | Morne | Géante gazeuse, anneaux et ceinture d'astéroïdes |
| `/event-horizon/04-ceinture.jpg` | La ceinture | 700 astéroïdes en un seul appel de dessin |
| `/event-horizon/06-cendre.jpg` | Cendre | Planète volcanique dont les failles luisent |
| `/event-horizon/05-epave.jpg` | L'épave | Un vaisseau identique à celui du joueur, à la dérive près du disque |
| `/event-horizon/08-chute.jpg` | La chute | Séquence de fin, vue de sous le vaisseau |

Les chemins commencent par `/event-horizon/` : les images sont servies par le site lui-même une fois
celui-ci déployé.
