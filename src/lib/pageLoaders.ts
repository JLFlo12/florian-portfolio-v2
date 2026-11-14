/* Pages chargées à la demande. Un seul endroit : App.tsx s'en sert pour ses routes, et la transition DeLorean
   (components/fx/TimeTravel.tsx) pour précharger la page visée pendant que la voiture démarre. */
export const pageLoaders = {
  projects: () => import('@/pages/Projects'),
  project: () => import('@/pages/ProjectGallery'),
  about: () => import('@/pages/About'),
  contact: () => import('@/pages/Contact'),
  cv: () => import('@/pages/Cv'),
  chatbot: () => import('@/pages/Chatbot'),
  games: () => import('@/pages/Games'),
  legal: () => import('@/pages/Legal'),
  notFound: () => import('@/pages/NotFound'),
};

/** Précharge le code de la page qui répond à ce chemin (sans effet pour l'accueil, déjà chargé). */
export const preloadPage = (path: string) => {
  const loader = path === '/projects' ? pageLoaders.projects
    : path.startsWith('/projects/') ? pageLoaders.project
    : path === '/about' ? pageLoaders.about
    : path === '/contact' ? pageLoaders.contact
    : path === '/cv' ? pageLoaders.cv
    : path === '/chatbot' ? pageLoaders.chatbot
    : path === '/games' ? pageLoaders.games
    : path === '/legal' || path === '/mentions-legales' ? pageLoaders.legal
    : null;
  loader?.().catch(() => { /* hors ligne : la page se chargera au changement de route */ });
};
