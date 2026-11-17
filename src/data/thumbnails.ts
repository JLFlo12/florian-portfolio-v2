/* ───────────────────────────────────────────────────────────────
   Miniatures optimisées servies par le site (public/thumbs, WebP 800 et 1600 px)
   à la place des originaux du stockage Supabase (PNG de 2,75 Mo pour Torii).
   Clé = nom du fichier d'origine dans le bucket : si une miniature est changée
   depuis le mode admin, la nouvelle image s'affiche (elle n'est plus dans la liste).
   « hygiene » est une nouvelle couverture (l'ancienne capture montrait Pepe the Frog).
   ─────────────────────────────────────────────────────────────── */

const LOCAL: Record<string, string> = {
  '1774980992084-IMG_3319.png': 'torii',
  '1791127016284-hygiene-cover.jpg': 'hygiene',
  '1791127016284-led-cover.jpg': 'led',
  '1791127016284-wifi-cover.jpg': 'wifi',
  '1791127016284-signal-cover.jpg': 'signal',
  '1791127016284-integratif-cover.jpg': 'integratif',
  '1791127016284-suivi-cover.jpg': 'suivi',
  '1791127016284-jeux-cover.jpg': 'jeux',
  '1791127016284-supervision-cover.jpg': 'supervision',
  '1791127016284-cns-cover.jpg': 'cns',
  '1791116477655-unifi-ap-esiroi.jpg': 'unifi',
};

const LARGE = '-1600.webp';

/** Grande version locale si elle existe (couverture de la page projet), sinon l'URL d'origine */
export const optimizeThumb = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const key = LOCAL[url.split('/').pop() ?? ''];
  return key ? `/thumbs/${key}${LARGE}` : url;
};

/** Petite version (cartes, bandeau de l'accueil) */
export const thumbSmall = (url: string | null | undefined) =>
  url?.startsWith('/thumbs/') ? url.replace(LARGE, '-800.webp') : url ?? null;

/** srcset 800 / 1600 pour les cartes */
export const thumbSrcSet = (url: string | null | undefined) =>
  url?.startsWith('/thumbs/') ? `${thumbSmall(url)} 800w, ${url} 1600w` : undefined;
