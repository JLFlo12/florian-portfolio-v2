import { markReady } from '@/lib/ready';
import { hasWebGL } from '@/components/three/webgl';

/* Intro du site (components/fx/Intro.tsx) : passage de relais avec l'écran de chargement.
   L'intro ne joue qu'à la première arrivée de la session, sur l'accueil, si le navigateur sait
   afficher du WebGL et que les animations ne sont pas réduites. L'écran de chargement attend
   que ses modèles 3D soient prêts (un temps limité : sinon on s'en passe), puis lui laisse la main.
   C'est l'intro qui annonce alors que le site est prêt (markReady), à la fin de sa plongée. */

const KEY = 'florian-intro';
let wanted: boolean | null = null;
let dropped = false;
let start: (() => void) | null = null;
let settle: (ok: boolean) => void = () => {};
const loaded = new Promise<boolean>((resolve) => { settle = resolve; });

/** Vrai si l'intro doit jouer pour ce chargement de page (décidé une fois). */
export const introWanted = () => {
  if (wanted === null) {
    try {
      const forceReplay = typeof window !== 'undefined' && window.location.search.includes('intro');
      wanted = (window.location.pathname === '/' || forceReplay)
        && (document.documentElement.classList.contains('is-loading') || forceReplay)
        && (sessionStorage.getItem(KEY) !== '1' || forceReplay)
        && hasWebGL();
    } catch { wanted = false; }
  }
  return wanted;
};

/** L'intro annonce que sa scène est prête (ou qu'elle a échoué). Renvoie faux si on ne l'a pas attendue. */
export const introLoaded = (ok: boolean, begin?: () => void) => {
  if (dropped) return false;
  start = ok && begin ? begin : null;
  settle(ok);
  return ok;
};

/** Écran de chargement : attend l'intro au plus `maxMs`. Passé ce délai, le site s'ouvre sans elle. */
export const waitIntro = (maxMs: number) => {
  if (!introWanted()) return Promise.resolve();
  return Promise.race([loaded, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), maxMs))])
    .then((ok) => { if (!ok) { dropped = true; start = null; } });
};

/** Écran de chargement ouvert : l'intro prend la main si elle est là, sinon le site démarre. */
export const afterLoader = () => { if (start) start(); else markReady(); };

/** L'intro a été vue (ou passée) : elle ne rejoue pas pendant cette session. */
export const introSeen = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* stockage indisponible */ } };
