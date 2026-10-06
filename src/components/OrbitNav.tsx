import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Callout } from '@/components/Callout';
import { planetState } from '@/components/three/planetState';
import { useNavItems } from '@/lib/nav';

/* ───────────────────────────────────────────────────────────────
   Menu en orbite (accueil, ordinateur) : en haut de page, les satellites du menu flottent dans le
   ciel autour de la planète (scène 3D : three/Planet.tsx). Ici, les liens : posés sur chaque
   satellite par la scène, ils le suivent quand il tourne au scroll et disparaissent quand il passe
   derrière la planète. Au survol, le nom s'écrit à la main au bout d'un trait, comme dans l'en-tête.
   Tant que ces satellites sont visibles (attribut data-orbit-nav), la pilule en verre liquide de l'en-tête
   s'efface et les boutons 3D (SpaceControls) la remplacent ; ils partent ensemble au scroll.
   ─────────────────────────────────────────────────────────────── */

// Côté où s'écrit chaque nom : vers l'extérieur de la planète (Contact, au bord de l'écran, vers la gauche)
const DIRS: (1 | -1)[] = [-1, -1, 1, -1, 1];

const OrbitNav = () => {
  const items = useNavItems();

  useEffect(() => {
    document.documentElement.toggleAttribute('data-orbit-nav', true);
    return () => {
      document.documentElement.removeAttribute('data-orbit-nav');
      planetState.sats = [];
      planetState.satHover = -1;
    };
  }, []);

  const hover = (i: number) => () => { planetState.satHover = i; };

  return (
    <nav className="sat-orbit pointer-events-none absolute inset-0 z-[2] hidden overflow-hidden md:block" aria-label="Menu">
      {items.map((item, i) => {
        const active = item.path === '/';
        return (
          <Link
            key={item.path}
            ref={(el) => { planetState.sats[i] = el; }}
            to={item.path}
            className="sat-link sat-orbit-link"
            data-active={active}
            data-hidden="true"
            aria-current={active ? 'page' : undefined}
            onPointerEnter={hover(i)}
            onPointerLeave={hover(-1)}
            onFocus={hover(i)}
            onBlur={hover(-1)}
          >
            <span className="sr-only">{item.label}</span>
            <Callout text={item.label.toLocaleUpperCase('fr')} dir={DIRS[i % DIRS.length]} drop={24} cap={11} />
          </Link>
        );
      })}
    </nav>
  );
};

export default OrbitNav;
