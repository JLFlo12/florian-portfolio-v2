/* État partagé entre la page (souris, scroll, intro) et la scène 3D de la planète.
   Fichier volontairement sans three.js pour ne pas l'embarquer dans le bundle principal. */
export const planetState = {
  px: 0,        // souris horizontale (-1 → 1)
  py: 0,        // souris verticale (-1 → 1)
  scroll: 0,    // sortie du hero (0 → 1)
  ready: false, // intro lancée (fin de l'écran de chargement)
};
