import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { prefersReducedMotion } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Sakura (page Jeux)
   - Une branche de cerisier en fleurs sort du coin en haut à droite.
     Elle est générée (graine fixe : toujours la même), dessinée en SVG,
     pousse à l'arrivée puis se balance doucement.
   - Des pétales tombent sur tout l'écran (canvas fixe) : ils tournoient,
     suivent le vent (rafales avec traînées), s'écartent de la souris et
     suivent un peu le défilement. Frôler une fleur en fait tomber des pétales.
   - Couleurs du thème (variables --sakura-* dans index.css).
   - `calm` (un jeu est ouvert) : pétales derrière le contenu, moins nombreux.
   ─────────────────────────────────────────────────────────────── */

const W = 640;
const H = 460;
const PETAL = 'M0 -.1C-.42 -.3-.52-.82-.2-1L0-.9L.2-1C.52-.82.42-.3 0-.1Z'; // pétale échancré, pointe vers le haut
const FALLING = 'M0 .45C-.42 .25-.52-.27-.2-.45L0-.35L.2-.45C.52-.27.42 .25 0 .45Z'; // même pétale, centré
// Classes écrites en entier : Tailwind supprime celles qu'il ne trouve pas dans le code
const TINTS = ['sk-c0', 'sk-c1', 'sk-c2'];

interface Seg { x1: number; y1: number; x2: number; y2: number; w: number; len: number; d: number }
interface Bloom { x: number; y: number; s: number; r: number; c: number; d: number; bud: boolean }

// Générateur pseudo-aléatoire à graine (mulberry32)
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/* Branche : chaque rameau avance par petits segments (qui s'affinent), dévie un peu,
   ploie sous son poids, se divise ; des fleurs poussent le long et au bout. */
function buildBranch() {
  const rnd = seeded(20260919);
  const segs: Seg[] = [];
  const blooms: Bloom[] = [];
  const bloom = (x: number, y: number, d: number, big = 1) => blooms.push({
    x, y, s: (9 + rnd() * 6) * big, r: rnd() * 72, c: Math.floor(rnd() * 3), d: d + 0.15 + rnd() * 0.35, bud: rnd() < 0.16,
  });
  const grow = (x: number, y: number, a: number, len: number, w: number, depth: number, t0: number, span: number) => {
    const steps = Math.max(3, Math.round(len / 26));
    const step = len / steps;
    let px = x, py = y, pw = w;
    for (let i = 1; i <= steps; i++) {
      a += (rnd() - 0.5) * 0.32 + (Math.PI / 2 - a) * (depth ? 0.035 : 0.012);
      const nx = px + Math.cos(a) * step;
      const ny = py + Math.sin(a) * step;
      const nw = w * (1 - 0.62 * (i / steps));
      const d = t0 + span * (i / steps);
      segs.push({ x1: px, y1: py, x2: nx, y2: ny, w: (pw + nw) / 2, len: step + nw, d: t0 + span * ((i - 1) / steps) });
      if (depth < 2 && i > 1 && i < steps && rnd() < [0.4, 0.22][depth]) {
        const side = rnd() < 0.5 ? -1 : 1;
        grow(nx, ny, a + side * (0.5 + rnd() * 0.55), len * (0.3 + rnd() * 0.2), nw * 0.72, depth + 1, d, span * 0.6);
      }
      if (depth >= 1 && rnd() < 0.28) bloom(nx + (rnd() - 0.5) * 12, ny + (rnd() - 0.5) * 12, d);
      px = nx; py = ny; pw = nw;
    }
    const tip = depth === 0 ? 4 : 2 + Math.floor(rnd() * 2);
    for (let k = 0; k < tip; k++) bloom(px + (rnd() - 0.5) * 24, py + (rnd() - 0.5) * 24, t0 + span, 1.1);
  };
  grow(W + 20, -14, 2.72, 560, 17, 0, 0, 1.1);   // branche principale, vers la gauche
  grow(W - 40, -10, 2.25, 330, 11, 1, 0.1, 0.8); // branche qui retombe
  return { segs, blooms };
}

interface Petal { x: number; y: number; vx: number; vy: number; size: number; rot: number; spin: number; flip: number; flipSpeed: number; fall: number; swayAmp: number; swayFreq: number; phase: number; color: number; alpha: number }
interface Gust { y: number; t: number; dur: number; amp: number; freq: number }

const Sakura = ({ calm = false }: { calm?: boolean }) => {
  const { theme } = useTheme();
  const { segs, blooms } = useMemo(buildBranch, []);
  const svg = useRef<SVGSVGElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bloomEls = useRef<(SVGGElement | null)[]>([]);
  const calmRef = useRef(calm);
  calmRef.current = calm;
  const paletteRef = useRef<string[]>([]);

  // Couleurs des pétales, relues quand le thème change
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    paletteRef.current = ['--primary', '--sakura-2', '--sakura-3'].map((v) => `hsl(${css.getPropertyValue(v).trim()})`)
      .concat(`hsl(${css.getPropertyValue('--muted-foreground').trim()})`);
  }, [theme]);

  useEffect(() => {
    const cv = canvas.current;
    const branch = svg.current;
    if (!cv || !branch || prefersReducedMotion()) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const petalPath = new Path2D(FALLING);
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const maxPetals = mobile ? 28 : 64;
    const petals: Petal[] = [];
    const gusts: Gust[] = [];
    const cooldown = new Array(blooms.length).fill(0);
    let w = 0, h = 0, dpr = 1;
    let raf = 0, last = performance.now(), time = 0, spawnAcc = 0;
    let nextGust = 4 + Math.random() * 4, gustT = -1, gustPower = 0;
    const pointer = { x: -9999, y: -9999, moved: false };
    let lastScroll = window.scrollY;
    const start = performance.now() + 900; // les pétales commencent quand la branche a fleuri

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    };
    resize();

    // Position à l'écran d'un point de la branche
    const toScreen = (bx: number, by: number) => {
      const r = branch.getBoundingClientRect();
      return { x: r.left + (bx / W) * r.width, y: r.top + (by / H) * r.height, scale: r.width / W };
    };

    const spawn = (x: number, y: number, burst = false) => {
      if (petals.length >= maxPetals + (burst ? 12 : 0)) return;
      petals.push({
        x, y, vx: burst ? -20 - Math.random() * 40 : -10, vy: burst ? 10 : 20,
        size: 10 + Math.random() * 9, rot: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 2.4,
        flip: Math.random() * Math.PI, flipSpeed: 1.4 + Math.random() * 2.2,
        fall: 24 + Math.random() * 30, swayAmp: 12 + Math.random() * 22, swayFreq: 0.6 + Math.random() * 1.1, phase: Math.random() * 6.28,
        color: Math.floor(Math.random() * 3), alpha: 0.7 + Math.random() * 0.28,
      });
    };

    const spawnAmbient = () => {
      // Surtout depuis tout le haut de l'écran, parfois depuis une fleur visible
      if (Math.random() < 0.4) {
        const b = blooms[Math.floor(Math.random() * blooms.length)];
        const p = toScreen(b.x, b.y);
        if (p.y > -20 && p.y < h) { spawn(p.x, p.y); return; }
      }
      spawn(Math.random() * (w + 200), -20);
    };

    const onMove = (e: PointerEvent) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; };
    const onLeave = () => { pointer.x = pointer.y = -9999; };
    const onScroll = () => {
      const dy = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      for (const p of petals) p.y -= dy * 0.35; // les pétales suivent un peu la page
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);

    // Frôler une fleur : elle frissonne et lâche des pétales
    const brush = () => {
      pointer.moved = false;
      const r = branch.getBoundingClientRect();
      if (pointer.x < r.left - 30 || pointer.y > r.bottom + 30) return;
      const bx = ((pointer.x - r.left) / r.width) * W;
      const by = ((pointer.y - r.top) / r.height) * H;
      const now = performance.now();
      blooms.forEach((b, i) => {
        if (b.bud || now < cooldown[i] || Math.hypot(b.x - bx, b.y - by) > 24) return;
        cooldown[i] = now + 1400;
        const p = toScreen(b.x, b.y);
        for (let k = 0; k < 3; k++) spawn(p.x + (Math.random() - 0.5) * 10, p.y, true);
        bloomEls.current[i]?.animate(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(14deg)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(0deg)' }],
          { duration: 700, easing: 'ease-out' },
        );
      });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      time += dt;
      const palette = paletteRef.current;
      if (pointer.moved) brush();

      // Vent : léger vers la gauche, rafales de temps en temps (avec traînées)
      nextGust -= dt;
      if (nextGust <= 0) {
        nextGust = 7 + Math.random() * 6;
        gustT = 0;
        gustPower = 70 + Math.random() * 60;
        for (let k = 0; k < (mobile ? 1 : 2); k++) {
          gusts.push({ y: h * (0.2 + Math.random() * 0.6), t: -k * 0.35, dur: 2.4 + Math.random(), amp: 10 + Math.random() * 14, freq: 0.012 + Math.random() * 0.01 });
        }
      }
      let wind = -14;
      if (gustT >= 0) {
        gustT += dt;
        wind -= gustPower * Math.sin(Math.min(gustT / 2.6, 1) * Math.PI);
        if (gustT > 2.6) gustT = -1;
      }

      if (now > start) {
        spawnAcc += dt * (calmRef.current ? 2 : mobile ? 3 : 5.5);
        while (spawnAcc >= 1) { spawnAcc -= 1; spawnAmbient(); }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Traînées de vent
      for (let i = gusts.length - 1; i >= 0; i--) {
        const g = gusts[i];
        g.t += dt;
        if (g.t < 0) continue;
        const p = g.t / g.dur;
        if (p >= 1) { gusts.splice(i, 1); continue; }
        const head = w + 80 - (w + 400) * (p * p * (3 - 2 * p));
        const grad = ctx.createLinearGradient(head, 0, head + 300, 0);
        grad.addColorStop(0, palette[3] ?? '#999');
        grad.addColorStop(1, 'transparent');
        ctx.globalAlpha = 0.28 * Math.sin(p * Math.PI);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = head; x <= head + 300; x += 6) {
          const y = g.y + Math.sin(x * g.freq + g.t * 2) * g.amp;
          if (x === head) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Pétales
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i];
        const sway = Math.sin(time * p.swayFreq + p.phase) * p.swayAmp;
        p.vx += (wind + sway - p.vx) * Math.min(1, dt * 1.6);
        p.vy += (p.fall - p.vy) * Math.min(1, dt * 2);
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 110 && dist > 0.1) {
          const f = (1 - dist / 110) * 900 * dt;
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f * 0.6;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        p.flip += p.flipSpeed * dt;
        if (p.y > h + 30 || p.x < -60 || p.x > w + 260 || p.y < -200) { petals.splice(i, 1); continue; }
        const face = Math.cos(p.flip);
        ctx.setTransform(dpr, 0, 0, dpr, p.x * dpr, p.y * dpr);
        ctx.rotate(p.rot);
        ctx.scale(p.size, p.size * (0.18 + 0.82 * Math.abs(face)));
        ctx.globalAlpha = p.alpha * (face < 0 ? 0.78 : 1); // le revers est un peu plus pâle
        ctx.fillStyle = palette[p.color] ?? '#ff6a1f';
        ctx.fill(petalPath);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
    };
  }, [blooms]);

  return (
    <>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMaxYMin meet" className={`sakura-branch ${calm ? 'is-calm' : ''}`} aria-hidden="true">
        <defs>
          <g id="sk-flower">
            {[0, 72, 144, 216, 288].map((r) => <path key={r} d={PETAL} transform={`rotate(${r})`} />)}
            {[36, 108, 180, 252, 324].map((r) => (
              <circle key={r} cx={Math.sin((r * Math.PI) / 180) * 0.42} cy={-Math.cos((r * Math.PI) / 180) * 0.42} r=".06" className="sk-core" />
            ))}
            <circle r=".22" className="sk-core" />
          </g>
        </defs>
        <g className="sakura-sway">
          {segs.map((s, i) => (
            <line
              key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth={s.w} className="sk-seg"
              style={{ '--l': s.len.toFixed(1), '--d': `${s.d.toFixed(2)}s` } as React.CSSProperties}
            />
          ))}
          {blooms.map((b, i) => (
            <g key={i} transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}>
              <g ref={(el) => { bloomEls.current[i] = el; }} className="sk-bloom" style={{ '--d': `${b.d.toFixed(2)}s` } as React.CSSProperties}>
                {b.bud
                  ? <circle r={b.s * 0.32} className={TINTS[b.c]} />
                  : <use href="#sk-flower" transform={`rotate(${b.r.toFixed(0)}) scale(${b.s.toFixed(2)})`} className={TINTS[b.c]} />}
              </g>
            </g>
          ))}
        </g>
      </svg>
      <canvas ref={canvas} className={`sakura-petals ${calm ? 'is-calm' : ''}`} aria-hidden="true" />
    </>
  );
};

export default Sakura;
