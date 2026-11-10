# Crédits des ressources

La version 0.1 d'EVENT HORIZON n'utilise **aucune ressource externe** : aucun modèle 3D, aucune
texture, aucune image, aucun son téléchargé.

| Élément | Origine | Licence |
| --- | --- | --- |
| Vaisseau AETHER-01 | Modèle original, géométrie construite par code (`ship/ShipModel.ts`) | Celle du dépôt |
| Textures de coque | Générées à l'exécution dans un canvas (`ship/ShipModel.ts`) | Celle du dépôt |
| Planètes, lune, anneaux | Shaders procéduraux (`astronomy/Planet.ts`) | Celle du dépôt |
| Trou noir NEMESIS-01 | Shader de tracé de rayons original (`astronomy/BlackHole.ts`) | Celle du dépôt |
| Ciel, étoiles, nébuleuse | Shaders procéduraux (`engine/Sky.ts`) | Celle du dépôt |

## Bibliothèques

| Bibliothèque | Usage | Licence |
| --- | --- | --- |
| [three.js](https://threejs.org/) | Rendu WebGL, post-traitement | MIT |
| [React](https://react.dev/) | Interface | MIT |

## Polices

L'interface réutilise les polices déjà chargées par le portfolio (Hubot Sans, Mona Sans, Geist Mono).

## Pour la suite

Le cahier des charges prévoit des ressources venant de Sketchfab, Poly Haven, ambientCG, Kenney ou
de la NASA. Chaque ressource ajoutée devra être inscrite ici avec son auteur, sa licence et son lien,
après vérification que la licence autorise l'usage dans un jeu.
