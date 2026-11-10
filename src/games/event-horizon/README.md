# EVENT HORIZON

Jeu d'exploration spatiale en 3D, jouable dans le navigateur. Seul à bord du vaisseau scientifique
AETHER-01, le joueur capte un signal de détresse dans le système de l'étoile Hélice et le remonte
jusqu'au trou noir NEMESIS-01. Aucun combat : on vole, on observe, on scanne, et on s'inquiète.

Le jeu fait partie du portfolio (page **Jeux**, carte « Event Horizon ») et n'est téléchargé
que lorsqu'on le lance.

## Lancer

```bash
npm install
npm run dev        # puis ouvrir http://localhost:8080/games
npm run build      # version de production dans dist/
```

Aucune dépendance propre au jeu : il utilise React, TypeScript, Vite et Three.js, déjà présents
dans le portfolio. Il faut un navigateur de bureau avec WebGL 2, un clavier et une souris.
Le son compte beaucoup dans l'ambiance : un casque est conseillé.

## Commandes

| Touche | Action |
| --- | --- |
| Z / W | Accélérer |
| S | Ralentir, puis marche arrière |
| Q / A, D | Tourner à gauche, à droite |
| Flèches haut / bas | Cabrer, piquer |
| Espace | Freiner |
| Maj (avec Z) | Surrégime, consomme l'énergie |
| C | Basculer entre impulsion et croisière (la croisière va d'autant plus vite qu'on est loin de toute masse) |
| Souris (glisser) | Tourner la caméra autour du vaisseau |
| Molette | Zoom |
| T | Cible suivante |
| N | Navigation : liste des objets connus, du plus proche au plus lointain |
| F | Scanner la cible, ou fermer la fiche |
| J | Journal des découvertes |
| U | Améliorations du vaisseau |
| M | Carte galactique : choisir un système voisin et y sauter |
| E | Quitter le poste de pilotage et marcher dans le vaisseau (E pour y revenir) |
| P | Mode photo (Entrée enregistre l'image) |
| H | Afficher ou masquer les commandes |
| Échap | Pause |

Les touches de déplacement suivent la position physique des touches : ZQSD sur un clavier
AZERTY, WASD sur un QWERTY.

À pied : ZQSD pour marcher, Maj pour courir, la souris pour regarder (un clic la capture, Échap la
libère), F pour examiner ce qu'on regarde.

## Ce que contient le jeu

**Une échelle réelle.** Les tailles et les distances sont celles des fiches scientifiques : 1 unité = 10 km.
NEMESIS-01 a un horizon de 25,4 millions de km de diamètre, soit 530 fois Morne et 18 fois son étoile.
Thalis est à 1 unité astronomique de Hélice, Morne à 4,7, Givre à 13. Le trou noir est à 3,8 UA du point
de départ (45 fois son rayon). Pour que ces distances restent jouables, la vitesse maximale de croisière
vaut 30 % de la distance à l'astre le plus proche, par seconde : on file en espace profond, et le vaisseau
ralentit seul à l'approche. Un trajet entre planètes prend 20 à 40 secondes. Les vitesses affichées
dépassent celle de la lumière : c'est la seule part de fiction de l'échelle.

**Un univers sans bord.** La galaxie est une grille de cases de 6 années-lumière, chacune avec un système
stellaire. Tout sort d'une seed et de la case : type d'étoile (naine rouge, géante, naine blanche…),
nombre et orbites des planètes, type de chaque monde selon sa température, lunes, anneaux, ceintures,
et parfois une sonde, une épave ou une anomalie. La même case redonne toujours le même système, sans rien
stocker. La carte galactique (M) montre les voisins ; un saut y mène, et de là on en voit d'autres.
La plupart des systèmes sont vides de toute trace, c'est voulu.

**Le vaisseau.** AETHER-01 est modélisé par code : poutre, anneau d'habitation tournant, laboratoires,
antennes, radiateurs, réservoirs, six moteurs avec panaches animés. Pilotage avec inertie, assistance
de vol, deux régimes (impulsion et croisière), surrégime. Caméra extérieure avec orbite, zoom et retard
dans les virages.

**Le système de Hélice.** Cinq planètes et lunes aux surfaces calculées par shader : Thalis (océanique),
sa lune Ostra, Morne (géante gazeuse à anneaux, entourée d'une ceinture d'astéroïdes), Cendre (volcanique,
dont les failles luisent côté nuit) et Givre (glacée).

**NEMESIS-01.** Chaque pixel suit un rayon lumineux courbé par la gravité (géodésiques de Schwarzschild).
L'horizon noir, l'anneau de photons, le disque vu par-dessus et par-dessous, les jets relativistes et la
déformation des étoiles sortent de ce même calcul. Gravité, zone de radiations qui vide l'énergie de bord,
dilatation temporelle affichée.

**L'intérieur du vaisseau.** La touche E fait quitter le poste de pilotage : on marche à la première
personne sur le pont d'AETHER-01. Neuf lieux : passerelle, coursive, quartiers, cryogénie, laboratoire,
salle commune, sas, soute, salle des machines. Douze choses à examiner, dont les textes changent quand
l'enquête avance. Les hublots sont de vrais trous dans les cloisons : on y voit l'espace réel, le trou
noir ou la planète devant laquelle le vaisseau se trouve, et la lumière de l'étoile entre par là.
Pendant ce temps le vaisseau continue sur sa lancée, et une alarme se déclenche s'il dérive vers l'horizon.

**Une histoire à remonter.** Un signal de détresse mène de la balise Écho-1 à l'épave de l'expédition
ORPHÉE, puis à une anomalie dans la ceinture de Morne, puis à une épave près du trou noir. Chaque analyse
rend un enregistrement et révèle la piste suivante. D'autres objets, hors catalogue, ne se révèlent que
lorsqu'on passe à proximité : une sonde, une capsule de survie, une seconde anomalie, un astéroïde géant
et une structure artificielle de 18 000 km, le Témoin.

**Une fin.** Sous 1,36 rayon de Schwarzschild, la chute est irréversible : la caméra passe sous le
vaisseau, le reste de l'univers se referme en un cercle, le temps extérieur s'emballe. L'écran de fin
dépend de ce qui a été découvert.

**L'ambiance.** Tout le son est synthétisé en direct (Web Audio) : moteurs, scanner, compteur de
radiations, coque qui travaille près du trou noir, nappe grave qui s'affaisse à mesure qu'on descend.
Les bords de l'image se referment à l'approche de l'horizon. L'ordinateur de bord rappelle de temps en
temps qu'il n'y a personne. Et quelque chose suit parfois le vaisseau.

**La progression.** Chaque analyse rapporte des points de recherche, à dépenser dans quatre
améliorations : scanner, moteurs, réserve d'énergie, blindage antiradiation.

**Le reste.** Mode photo, navigation, repère de cible avec flèche de direction hors champ, menu principal,
pause, quatre niveaux de qualité graphique, réglage du son. Origine flottante : le vaisseau reste à
l'origine de la scène et l'univers se déplace autour de lui.

## Ce qui n'y est pas encore

Par rapport au cahier des charges :

- **Génération procédurale** : faite pour les systèmes (`universe/generator.ts`), mais le système de départ
  reste écrit à la main (`universe/bodies.ts`), et il n'y a ni nébuleuses à traverser ni second trou noir.
  Les surfaces réutilisent les cinq types de planètes existants, variés par seed et par teinte.
- **Streaming spatial et niveaux de détail** : un seul système est chargé à la fois, remplacé à chaque saut.
  On ne voyage pas d'une étoile à l'autre en continu.
- **Sauvegarde** : découvertes, objets détectés, améliorations, qualité et son sont gardés dans le
  stockage local du navigateur, ainsi que le système où l'on se trouve et ceux déjà visités. La position
  exacte du vaisseau n'est pas sauvegardée, et il n'y a pas encore de sauvegarde IndexedDB avec versions.
- **Assets externes** : aucun modèle, texture ni son téléchargé. Voir `ASSET_CREDITS.md`.
- **Réglages graphiques détaillés** (résolution, distance d'affichage, ombres) : seuls les quatre
  niveaux globaux existent.

Autres limites connues :

- Intérieur : un seul pont, construit en volumes simples (pas de modèles détaillés ni de portes animées).
  Il ne correspond pas à la forme extérieure du vaisseau, et on ne peut pas sortir en scaphandre.
- Collisions : sphères simples pour les planètes, aucune pour les astéroïdes, les épaves et le Témoin,
  qu'on traverse. Rapier n'est pas utilisé.
- Le bord de la zone de lentille gravitationnelle peut se deviner sur le fond étoilé quand on regarde
  le trou noir de loin, et les jets s'arrêtent à ce bord.
- Les astéroïdes sont volontairement à facettes ; ils manquent de détail vus de très près.
- L'étoile est un halo lumineux, pas une sphère : de très près, elle éblouit tout l'écran.
- Sous 3 rayons de l'horizon il n'existe plus d'orbite stable : le jeu le traduit par une dérive vers le
  centre, pas par une vraie mécanique orbitale.
- Pas jouable sur écran tactile. Testé dans Chrome uniquement.

## Organisation du code

```
core/         boucle de jeu, entrées clavier/souris, état partagé avec l'interface
engine/       ciel, poussières, niveaux de qualité
universe/     système de départ, histoire, échelle, générateur de systèmes
astronomy/    trou noir, planètes, anneaux, ceinture, épaves, anomalies, structures
ship/         modèle 3D, pilotage, caméra, intérieur à parcourir à pied
exploration/  scanner, découvertes, détection
progression/  points de recherche et améliorations
audio/        synthèse sonore
shaders/      bruit GLSL partagé
ui/           menus, HUD, panneaux, fin (React)
utils/        générateur aléatoire déterministe
```

Le rendu passe par `EffectComposer` (cible HDR, bloom, conversion écran). Le moteur n'utilise que
WebGL 2 ; les shaders sont isolés par objet pour faciliter un passage ultérieur à WebGPU.

Deux pièges rencontrés, à connaître avant de modifier le rendu :

- Une valeur invalide dans un shader (`pow` d'une base négative, `smoothstep` aux bornes inversées)
  rend toute l'image noire, parce que le bloom la propage.
- Ajouter ou retirer une lumière de la scène en cours de jeu force three.js à recompiler tous les
  matériaux éclairés, ce qui fige l'image près d'une seconde. Le nombre de lumières reste donc fixe.

## Performances mesurées

Chrome, 1600 × 900, qualité « Élevée », carte Intel Arc intégrée, sans limite d'images/s :
environ 130 à 150 images/s au départ et près de Morne, 100 à 170 près du trou noir (les mesures
varient beaucoup sur cette carte). Avant optimisation : 70 à 90. Aucun à-coup à l'arrivée sur un
nouvel objet.

Ce qui a été optimisé, à rendu identique (écart mesuré : 4/255 au maximum sur le ciel) :

- **Vaisseau** : ses ~150 pièces sont fusionnées par matériau au chargement, ce qui divise par
  plus de dix les appels de dessin, dans le rendu normal comme dans celui des ombres.
- **Ciel** : les lueurs de la galaxie et de la nébuleuse, qui varient lentement, sont calculées
  une fois dans une carte cubique. Seule la poussière d'étoiles reste calculée au pixel.
- **Trou noir** : les rayons trop éloignés pour être déviés ne sont plus intégrés, et l'intégration
  s'arrête dès que le disque devient opaque devant le rayon.

## Page projet du portfolio

`PROJECT_PAGE.md` contient le texte prêt à coller dans le formulaire d'administration des projets,
et `public/event-horizon/` les captures d'écran à utiliser dans la galerie.
