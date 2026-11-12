import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from '@/lib/motion';
import { markReady } from '@/lib/ready';
import { introLoaded, introSeen, introWanted } from '@/lib/intro';
import { sound } from '@/lib/ambient';
import { introAudio } from '@/lib/introAudio';
import type { Intro as IntroScene } from '@/components/three/intro';

/* ═══════════════════════════════════════════════════════════════
   INTRO CINÉMATIQUE DU PORTFOLIO : PROMETHEUS / LE CONTACT
   Format Cinemascope 2.39:1, audio spatialisé procédural (Web Audio),
   repères optiques de cadrage, flashs d'exposition, aberration chromatique,
   caméra steadycam et transition en iris vers l'univers du portfolio.
   ═══════════════════════════════════════════════════════════════ */
const Intro = () => {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flashEl = useRef<HTMLDivElement>(null);
  const chromaEl = useRef<HTMLDivElement>(null);

  const [on, setOn] = useState(introWanted);
  const [armed, setArmed] = useState(false);   // L'écran de chargement s'est ouvert : prêt à démarrer
  const [playing, setPlaying] = useState(false);
  const [timecode, setTimecode] = useState('00:00:00:00');
  const api = useRef<{ play: () => void; finish: () => void } | null>(null);

  // Maintient en pause la musique d'ambiance générale pendant la cinématique
  useEffect(() => {
    if (on) sound.hold(true);
    return () => { sound.hold(false); };
  }, [on]);

  // Horloge de timecode 24 FPS pendant la lecture
  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    let frameId: number;
    const tick = () => {
      const ms = performance.now() - start;
      const totalFrames = Math.floor((ms / 1000) * 24);
      const ff = String(totalFrames % 24).padStart(2, '0');
      const ss = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
      const mm = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
      setTimecode(`00:${mm}:${ss}:${ff}`);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

  useEffect(() => {
    const el = root.current;
    if (!on || !el || !canvas.current) return;
    const html = document.documentElement;
    let scene: IntroScene | null = null;
    let gone = false;
    let done = false;
    let out: gsap.core.Timeline | undefined;
    html.classList.add('is-intro');

    const close = () => {
      html.classList.remove('is-intro');
      scene?.dispose();
      scene = null;
      introAudio.dispose();
      setOn(false);
    };

    // Fin : l'iris s'ouvre depuis le centre, le site démarre avec résolution audio
    const finish = () => {
      if (done) return;
      done = true;
      introSeen();
      introAudio.portalReveal();

      const radius = Math.hypot(window.innerWidth, window.innerHeight) / 2 + 30;
      const ring = el.querySelector('.intro__ring');
      out = gsap.timeline({ onComplete: close })
        .set(el, { pointerEvents: 'none' })
        .to(el.querySelectorAll('[data-intro-ui]'), { opacity: 0, duration: 0.25 }, 0)
        .set(ring, { opacity: 1 }, 0.08)
        .to(el, { '--hole': `${radius}px`, duration: 1.15, ease: 'expo.inOut' }, 0.08)
        .to(ring, { opacity: 0, duration: 0.7, ease: 'power1.in' }, 0.42)
        .call(() => {
          sound.hold(false);
          markReady();
        }, [], 0.38)
        .call(() => html.classList.remove('is-intro'), [], 0.5);
    };

    const handleSceneEvent = (event: string) => {
      if (event === 'flash' && flashEl.current) {
        gsap.killTweensOf(flashEl.current);
        gsap.timeline()
          .set(flashEl.current, { opacity: 0.9 })
          .to(flashEl.current, { opacity: 0, duration: 0.55, ease: 'power2.out' });
      } else if (event === 'split' && chromaEl.current) {
        gsap.killTweensOf(chromaEl.current);
        gsap.timeline()
          .set(chromaEl.current, { opacity: 0.85 })
          .to(chromaEl.current, { opacity: 0, duration: 0.75, ease: 'power2.out' });
      } else if (event === 'dive' && chromaEl.current) {
        gsap.killTweensOf(chromaEl.current);
        gsap.timeline()
          .to(chromaEl.current, { opacity: 0.95, duration: 0.95, ease: 'power3.in' });
      }
    };

    api.current = {
      play: () => {
        if (scene && !done) {
          scene.play();
          setPlaying(true);
        }
      },
      finish,
    };

    import('@/components/three/intro')
      .then((mod) => {
        if (gone || !canvas.current) return;
        scene = mod.createIntro(canvas.current, finish, handleSceneEvent);
        return scene.loaded.then(() => {
          if (gone) return;
          // Si le chargement ne nous a pas attendus, le site est déjà ouvert : on s'efface
          if (!introLoaded(true, () => setArmed(true))) close();
        });
      })
      .catch((error) => {
        console.error('Intro :', error);
        if (!gone) {
          introLoaded(false);
          close();
        }
      });

    return () => {
      gone = true;
      out?.kill();
      html.classList.remove('is-intro');
      scene?.dispose();
      introAudio.dispose();
      api.current = null;
    };
  }, [on]);

  // Clavier : Entrée ou Espace pour commencer, Échap pour passer
  useEffect(() => {
    if (!on || !armed) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') api.current?.finish();
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        api.current?.play();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [on, armed]);

  if (!on) return null;

  return (
    <div
      ref={root}
      className={`intro${armed ? ' is-armed' : ''}${playing ? ' is-playing' : ''}`}
      data-lenis-prevent
      onClick={() => { if (armed) api.current?.play(); }}
    >
      <canvas ref={canvas} className="intro__canvas" aria-hidden="true" />

      {/* Couches d'effets visuels cinématographiques */}
      <div ref={flashEl} className="intro__flash" aria-hidden="true" />
      <div ref={chromaEl} className="intro__chroma" aria-hidden="true" />
      <div className="intro__vignette" aria-hidden="true" />
      <div className="intro__film-grain" aria-hidden="true" />

      {/* Métadonnées bas — timecode + passer */}
      <div className="intro__overlay-bottom" data-intro-ui>
        <span className="intro__meta-timecode font-mono">
          {timecode}
        </span>
        <button
          type="button"
          className="intro__skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            api.current?.finish();
          }}
        >
          {t('ui.introSkip')} <span className="intro__kbd">ESC</span>
        </button>
      </div>

      {/* Invite d'interaction centrale — texte seul, sans bulle */}
      <p className="intro__prompt-text" data-intro-ui>
        <span className="intro__dot" aria-hidden="true" />
        {t('ui.introStart')}
      </p>

      <div className="intro__ring" aria-hidden="true" />
    </div>
  );
};

export default Intro;
