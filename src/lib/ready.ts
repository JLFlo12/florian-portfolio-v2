/* Signal "le site est prêt" : envoyé à la fin de l'écran de chargement.
   Le hero de l'accueil et la planète 3D attendent ce signal pour lancer leur intro. */
let ready = false;
const listeners = new Set<() => void>();

export const markReady = () => {
  if (ready) return;
  ready = true;
  listeners.forEach((fn) => fn());
  listeners.clear();
};

export const onReady = (fn: () => void) => {
  if (ready) { fn(); return () => {}; }
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const isReady = () => ready;
