import { useEffect, useRef, type RefObject } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Fin de l'accueil (compétences) : l'astronaute qui tombait derrière le
   manifeste réapparaît, tout petit, à gauche du titre quand on arrive, puis
   traverse lentement le titre en ondulant, derrière les lettres, jusqu'à
   droite (et revient), en tournant sur lui-même, devant un champ d'étoiles
   discret qui dérive vers la gauche (canvas, en ovale autour du titre).
   Animations réduites : astronaute immobile à gauche du titre, étoiles fixes.
   ─────────────────────────────────────────────────────────────── */

// Générateur pseudo-aléatoire à graine : même ciel à chaque visite
const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Étoile : position 0–1 dans la section, profondeur (les proches dérivent plus vite), scintillement ;
// quelques-unes plus brillantes, avec un halo
interface Star { x: number; y: number; d: number; r: number; a: number; tw: number; ph: number; glow: boolean }

const makeStars = (count: number): Star[] => {
  const rnd = mulberry32(20261005);
  return Array.from({ length: count }, () => {
    const d = [0.35, 0.6, 1][Math.floor(rnd() * 3)];
    const glow = rnd() < 0.03;
    return {
      x: rnd(), y: rnd(), d, glow,
      r: glow ? 1.2 + rnd() * 0.5 : (0.5 + rnd() * 0.8) * (0.6 + d * 0.6),
      a: 0.3 + rnd() * 0.5, tw: 0.2 + rnd() * 0.55, ph: rnd() * Math.PI * 2,
    };
  });
};

// Position d'un élément dans `root`, d'après la mise en page seule (les transformations en cours ne comptent pas)
const offsetIn = (node: HTMLElement, root: HTMLElement) => {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = node; n && n !== root; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
};

// Couleur du texte du thème ; étoiles plus discrètes en mode clair
const TINTS = { dark: { color: 'hsl(36 36% 94%)', alpha: 1 }, light: { color: 'hsl(24 22% 8%)', alpha: 0.5 } };

const SpaceDrift = ({ zone }: { zone: RefObject<HTMLElement> }) => {
  const { theme } = useTheme();
  const canvas = useRef<HTMLCanvasElement>(null);
  const astro = useRef<HTMLDivElement>(null);
  const tint = useRef(TINTS[theme]);
  const redraw = useRef(() => {});

  useEffect(() => {
    tint.current = TINTS[theme];
    redraw.current();
  }, [theme]);

  /* ——— Champ d'étoiles (dessiné seulement quand la section est à l'écran) ——— */
  useEffect(() => {
    const cv = canvas.current;
    const area = zone.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !area || !ctx) return;
    const still = prefersReducedMotion();
    let w = 0, h = 0, dpr = 1, raf = 0, last = 0, time = 0, drift = 0;
    let stars: Star[] = [];

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = tint.current.color;
      const lift = -area.getBoundingClientRect().top * 0.06; // les étoiles défilent un peu moins vite que la page
      for (const s of stars) {
        const x = (((s.x * w - drift * s.d) % w) + w) % w;
        const y = (((s.y * h + lift * (1.2 - s.d)) % h) + h) % h;
        const alpha = s.a * tint.current.alpha * (still ? 1 : 0.65 + 0.35 * Math.sin(time * s.tw + s.ph));
        if (s.glow) {
          ctx.globalAlpha = alpha * 0.12;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = area.clientWidth;
      h = area.clientHeight;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      stars = makeStars(Math.round(Math.min(320, (w * h) / 6000)));
      draw();
    };
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      drift += dt * 3; // dérive très lente vers la gauche (px/s pour les plus proches)
      draw();
      raf = requestAnimationFrame(frame);
    };
    redraw.current = draw;
    const sizes = new ResizeObserver(resize);
    const view = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting && !still) { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
    sizes.observe(area);
    view.observe(area);
    return () => { cancelAnimationFrame(raf); sizes.disconnect(); view.disconnect(); redraw.current = () => {}; };
  }, [zone]);

  /* ——— Astronaute : arrive à gauche du titre, puis flotte en arc jusqu'à droite et revient ——— */
  useEffect(() => {
    const el = astro.current;
    const area = zone.current;
    const head = area?.querySelector('header');
    const title = head?.querySelector<HTMLElement>('h1, h2');
    if (!el || !area || !head || !title) return;
    const pts = { x0: 0, x2: 0, y: 0, amp: 0 };
    const path = { t: 0 };

    // Chemin mesuré dans la section : départ dans la marge à gauche du titre (au bord du titre s'il n'y a pas
    // de marge), puis il traverse le titre en ondulant, derrière les lettres (l'en-tête est au-dessus) :
    // caché par les jambages, visible entre les mots, la tête qui dépasse en haut de la vague.
    // Arrivée juste après la fin du texte (le h2 prend toute la largeur : on mesure son contenu).
    const measure = () => {
      const hd = offsetIn(head, area);
      const ti = offsetIn(title, area);
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const th = title.offsetHeight;
      const text = document.createRange();
      text.selectNodeContents(title);
      const textWidth = text.getBoundingClientRect().right - title.getBoundingClientRect().left;
      pts.x0 = hd.x > w + 24 ? (hd.x - w) / 2 : Math.max(4, hd.x - w * 0.6);
      pts.x2 = ti.x + textWidth + 16;
      pts.y = ti.y + th * 0.42 - h / 2;
      pts.amp = th * 0.32;
      // Ovale d'étoiles centré sur le titre
      canvas.current?.style.setProperty('--sky-y', `${Math.round(ti.y + th / 2)}px`);
      canvas.current?.style.setProperty('--sky-ry', `${Math.round(Math.max(260, th * 2.6))}px`);
    };
    const place = () => {
      const t = path.t;
      gsap.set(el, { x: pts.x0 + (pts.x2 - pts.x0) * t, y: pts.y - pts.amp * Math.sin(Math.PI * 2.5 * t) });
    };
    measure();
    place();
    // La mise en page n'est pas finie au montage (polices, images…) : arc recalculé à chaque changement de taille
    const sizes = new ResizeObserver(() => { measure(); place(); });
    [area, head, el].forEach((node) => sizes.observe(node));

    if (prefersReducedMotion()) {
      gsap.set(el, { opacity: 1 });
      return () => { sizes.disconnect(); gsap.set(el, { clearProps: 'all' }); };
    }

    // Très lent : une minute pour traverser, un tour sur lui-même toutes les 200 s
    const float = gsap.timeline({ paused: true })
      .to(path, { t: 1, duration: 60, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: place }, 0)
      .fromTo(el, { rotation: -20 }, { rotation: 340, duration: 200, ease: 'none', repeat: -1 }, 0);
    let arrived = false;
    // Quand on arrive : il apparaît à sa place, puis se met à flotter
    const arrive = ScrollTrigger.create({
      trigger: head,
      start: 'top 80%',
      once: true,
      onEnter: () => {
        arrived = true;
        measure();
        place();
        gsap.fromTo(el, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 3, ease: 'power1.out' });
        float.play();
      },
    });
    // Section hors de l'écran : flottement en pause ; mise en page changée : arc recalculé
    const view = ScrollTrigger.create({
      trigger: area,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => { if (arrived) float.paused(!self.isActive); },
      onRefresh: () => { measure(); place(); },
    });
    return () => { sizes.disconnect(); arrive.kill(); view.kill(); float.kill(); gsap.killTweensOf(el); };
  }, [zone]);

  return (
    <>
      <canvas ref={canvas} className="starfield" aria-hidden="true" />
      <div ref={astro} className="astronaut astronaut--drift" aria-hidden="true">
        <img src="/astronaut.webp" alt="" width={300} height={461} loading="lazy" decoding="async" />
      </div>
    </>
  );
};

export default SpaceDrift;
