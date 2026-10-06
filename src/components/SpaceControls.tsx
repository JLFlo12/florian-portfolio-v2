import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gamepad2, Globe, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { armSound, sound, useSound } from '@/lib/ambient';
import { handwrite, toPath } from '@/lib/handwriting';
import { prefersReducedMotion } from '@/lib/motion';
import { Callout } from '@/components/Callout';
import type { ControlsScene, ControlsState } from '@/components/three/spaceControls';

/* ───────────────────────────────────────────────────────────────
   Boutons de l'en-tête en objets 3D, sur l'accueil seulement (idée de Florian) : langue = planète,
   mini-jeux = soucoupe volante, musique = pulsar, thème = soleil (éclipse en mode sombre).
   Ils remplacent la pilule en verre liquide tant que les satellites du menu sont dans le ciel
   (attribut data-orbit-nav) et partent avec eux au scroll ; la scène se met alors en pause.
   Au survol, ce que fait le bouton s'écrit à la main au bout d'un trait ; la langue en cours
   reste écrite à côté de la planète.
   La scène 3D (three/spaceControls.ts) se charge une fois la page affichée ; en attendant, sans
   WebGL ou avec les animations réduites, les icônes habituelles la remplacent.
   ─────────────────────────────────────────────────────────────── */

const SPACING = 58;
const CANVAS_H = 110;
const canvasW = (n: number) => n * SPACING + 70;
// Un peu de désordre, comme les satellites : décalage (px), taille, inclinaison
const LAYOUT = [
  { dx: -3, dy: -4, s: 1, rz: 0.06 },
  { dx: 4, dy: 5, s: 0.92, rz: -0.1 },
  { dx: -2, dy: -6, s: 0.95, rz: 0.05 },
  { dx: 3, dy: 3, s: 1, rz: -0.06 },
];

/* Langue en cours, écrite à la main à côté de la planète */
const LangTag = ({ code }: { code: string }) => {
  const g = useMemo(() => {
    const word = handwrite(code, { cap: 7, seed: 11 });
    return { paths: word.strokes.map(toPath), w: word.width + 4, h: word.height + 4 };
  }, [code]);
  return (
    <svg className="ctl-tag" width={g.w} height={g.h} viewBox={`-2 -2 ${g.w} ${g.h}`} fill="none" aria-hidden="true">
      {g.paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
};

const SpaceControls = () => {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { wanted, playing } = useSound();
  const location = useLocation();
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ControlsScene | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(armSound, []);

  const fr = i18n.language === 'fr';
  const dark = theme === 'dark';
  const onGames = location.pathname.startsWith('/games');
  const music: ControlsState['music'] = wanted ? (playing ? 2 : 1) : 0;
  const state = useRef<ControlsState>({ dark, music, games: onGames });
  state.current = { dark, music, games: onGames };

  // Scène 3D : chargée quand le navigateur est libre, seulement sur grand écran et si les animations sont permises
  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia('(min-width: 768px)').matches) return;
    let cancelled = false;
    // En pause quand les boutons sont partis (après leur fondu de sortie), relancée à leur retour
    const root = document.documentElement;
    let pauseTimer = 0;
    const syncPause = () => {
      window.clearTimeout(pauseTimer);
      if (root.hasAttribute('data-orbit-nav')) scene.current?.setPaused(false);
      else pauseTimer = window.setTimeout(() => scene.current?.setPaused(true), 700);
    };
    const watch = new MutationObserver(syncPause);
    watch.observe(root, { attributes: true, attributeFilter: ['data-orbit-nav'] });
    const start = () => {
      import('@/components/three/spaceControls')
        .then(({ createSpaceControls }) => {
          if (cancelled || !canvas.current) return;
          const spots = LAYOUT.map((l, i) => ({ ...l, x: (i - (LAYOUT.length - 1) / 2) * SPACING + l.dx, y: l.dy }));
          scene.current = createSpaceControls(canvas.current, spots, canvasW(LAYOUT.length), CANVAS_H, state.current);
          setReady(true);
          syncPause();
        })
        .catch(() => { /* pas de WebGL : les icônes restent */ });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 600);
    return () => {
      cancelled = true;
      watch.disconnect();
      window.clearTimeout(pauseTimer);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle); else window.clearTimeout(idle);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setState({ dark, music, games: onGames }); }, [dark, music, onGames]);

  // La planète fait un demi-tour quand la langue change
  const lastLanguage = useRef(i18n.language);
  useEffect(() => {
    if (lastLanguage.current === i18n.language) return;
    lastLanguage.current = i18n.language;
    scene.current?.spin(0);
  }, [i18n.language]);

  const switchLanguage = () => {
    const next = fr ? 'en' : 'fr';
    i18n.changeLanguage(next);
    document.documentElement.lang = next;
  };

  const place = (i: number) => {
    const l = LAYOUT[i];
    return {
      className: 'sat-link ctl-link',
      style: { translate: `${l.dx}px ${l.dy}px` } as React.CSSProperties,
      onPointerEnter: () => scene.current?.setHover(i),
      onPointerLeave: () => scene.current?.setHover(-1),
      onFocus: () => scene.current?.setHover(i),
      onBlur: () => scene.current?.setHover(-1),
    };
  };
  const soundLabel = wanted ? t('ui.soundOff') : t('ui.soundOn');

  return (
    <div className={`ctl-nav hidden items-center md:flex ${ready ? 'is-3d' : ''}`}>
      <canvas ref={canvas} className="sat-canvas" style={{ width: canvasW(LAYOUT.length), height: CANVAS_H }} aria-hidden="true" />

      {/* Langue : planète (deux langues, un clic passe à l'autre) */}
      <button type="button" {...place(0)} onClick={switchLanguage} aria-label={`${t('ui.language')} : ${fr ? 'Français' : 'English'}. ${fr ? 'Switch to English' : 'Passer en français'}`}>
        <span className="ctl-icon"><Globe className="h-4 w-4" /></span>
        <LangTag code={fr ? 'FR' : 'EN'} />
        <Callout text={fr ? 'ENGLISH' : 'FRANÇAIS'} dir={-1} drop={18} />
      </button>

      {/* Mini-jeux : soucoupe volante */}
      <Link to="/games" {...place(1)} data-active={onGames} aria-current={onGames ? 'page' : undefined} aria-label={t('ui.games')}>
        <span className="ctl-icon"><Gamepad2 className="h-4 w-4" /></span>
        <Callout text={fr ? 'JEUX' : 'GAMES'} dir={-1} drop={18} />
      </Link>

      {/* Musique d'ambiance : pulsar */}
      <button type="button" {...place(2)} data-sound-toggle onClick={sound.toggle} aria-pressed={wanted} aria-label={soundLabel} title={soundLabel}>
        <span className="ctl-icon">
          <span className={`sound-bars ${playing ? 'is-playing' : ''} ${wanted ? '' : 'is-off'}`} aria-hidden="true"><i /><i /><i /><i /></span>
        </span>
        <Callout text={fr ? 'MUSIQUE' : 'MUSIC'} dir={-1} drop={18} />
      </button>

      {/* Thème : soleil (éclipse en mode sombre) */}
      <button type="button" {...place(3)} onClick={toggleTheme} aria-label={t('ui.theme')}>
        <span className="ctl-icon">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</span>
        <Callout text={dark ? (fr ? 'MODE CLAIR' : 'LIGHT MODE') : (fr ? 'MODE SOMBRE' : 'DARK MODE')} dir={-1} drop={18} />
      </button>
    </div>
  );
};

export default SpaceControls;
