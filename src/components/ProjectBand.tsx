import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

// Les projets (Supabase) et la scène 3D ne sont chargés qu'à l'approche de la bande :
// ils restent hors du premier chargement de l'accueil.
const ProjectBandBody = lazy(() => import('./ProjectBandBody'));

/* Bande de projets en 3D (entre les Outils et les Compétences) : garde sa place à l'écran
   et charge son contenu quand elle arrive à environ un écran et demi. */
const ProjectBand = () => {
  const spot = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = spot.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '150% 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const placeholder = <div ref={spot} className={prefersReducedMotion() ? 'project-band' : 'project-band project-band--3d'} aria-hidden="true" />;
  return near ? <Suspense fallback={placeholder}><ProjectBandBody /></Suspense> : placeholder;
};

export default ProjectBand;
