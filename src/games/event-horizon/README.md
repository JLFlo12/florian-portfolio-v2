# EVENT HORIZON

Jeu d'exploration spatiale en 3D, jouable dans le navigateur. Le joueur pilote le vaisseau
scientifique AETHER-01 dans le système de l'étoile Hélice et s'approche du trou noir NEMESIS-01.
Aucun combat : on vole, on observe, on scanne.

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

## Commandes

| Touche | Action |
| --- | --- |
| Z / W | Accélérer |
| S | Ralentir, puis marche arrière |
| Q / A, D | Tourner à gauche, à droite |
| Flèches haut / bas | Cabrer, piquer |
| Espace | Freiner |
| Maj (avec Z) | Surrégime, consomme l'énergie |
| C | Basculer entre impulsion et croisière |
| Souris (glisser) | Tourner la caméra autour du vaisseau |
| Molette | Zoom |
| T | Cible suivante |
| F | Scanner la cible, ou fermer la fiche |
| J | Journal des découvertes |
| H | Afficher ou masquer les commandes |
| Échap | Pause |

Les touches de déplacement suivent la position physique des touches : ZQSD sur un clavier
AZERTY, WASD sur un QWERTY.

## Ce que contient la version 0.1

- Vaisseau AETHER-01 modélisé par code : poutre, anneau d'habitation tournant, laboratoires,
  antennes, radiateurs, réservoirs, six moteurs avec panaches animés. Matériaux PBR, ombres.
- Pilotage avec inertie, assistance de vol, deux régimes (impulsion et croisière), surrégime.
- Caméra extérieure : orbite à la souris, zoom, retard dans les virages, champ élargi à haute vitesse.
- Ciel procédural (voie lactée, nébuleuse, étoiles) et poussières qui s'étirent avec la vitesse.
- Thalis (planète océanique : continents, relief, nuages, atmosphère), sa lune Ostra (cratères),
  Morne (géante gazeuse à bandes animées et anneaux, avec l'ombre de la planète sur les anneaux).
- NEMESIS-01 : chaque pixel suit un rayon lumineux courbé par la gravité (géodésiques de
  Schwarzschild). L'horizon noir, l'anneau de photons, le disque vu par-dessus et par-dessous et la
  déformation des étoiles d'arrière-plan sortent de ce même calcul. Effet Doppler sur le disque.
- Gravité du trou noir, dilatation temporelle affichée, perte du vaisseau si l'horizon est franchi.
- Scanner et fiches scientifiques pour les cinq objets du système, journal conservé entre les sessions.
- Menu principal, pause, quatre niveaux de qualité graphique, HUD.
- Origine flottante : le vaisseau reste à l'origine de la scène, l'univers se déplace autour de lui.

## Ce qui n'y est pas encore

Ces points du cahier des charges ne sont pas faits ; ils correspondent aux versions suivantes.

- **0.2** : génération procédurale par seed (UniverseGenerator, SectorGenerator…), plusieurs systèmes,
  carte galactique (la touche M affiche seulement un message), orbites.
- **0.3** : streaming spatial par secteurs, niveaux de détail, catalogue scientifique complet.
- **0.4** : améliorations du vaisseau, anomalies, épaves et stations, sauvegarde IndexedDB versionnée
  (pour l'instant seuls le journal et la qualité graphique sont gardés, dans le stockage local ;
  la position du vaisseau n'est pas sauvegardée).
- **0.5** : jets relativistes, audio, réglages graphiques détaillés (résolution, distance d'affichage).

Autres limites connues :

- Aucun asset externe (modèle, texture, son) : tout est généré par code. Voir `ASSET_CREDITS.md`.
- Pas de son.
- Le système de départ est écrit à la main dans `universe/bodies.ts`.
- Les collisions sont de simples sphères ; Rapier n'est pas utilisé.
- Le bord de la zone de lentille gravitationnelle peut se deviner sur le fond étoilé quand on
  regarde le trou noir de loin.
- Pas jouable sur écran tactile.

## Organisation du code

```
core/         boucle de jeu, entrées clavier/souris, état partagé avec l'interface
engine/       ciel, poussières, niveaux de qualité
universe/     données du système stellaire, échelle, seed
astronomy/    trou noir, planètes, anneaux
ship/         modèle 3D, pilotage, caméra
exploration/  scanner et découvertes
shaders/      bruit GLSL partagé
ui/           menus, HUD, fiches (React)
utils/        générateur aléatoire déterministe
```

Le rendu passe par `EffectComposer` (cible HDR, bloom, conversion écran). Le moteur n'utilise que
WebGL 2 ; les shaders sont isolés par objet pour faciliter un passage ultérieur à WebGPU.

## Performances mesurées

Chrome, 1600 × 900, qualité « Élevée », carte Intel Arc intégrée : 62 à 87 images/s selon la scène
(le plus lourd est le trou noir vu de près).
