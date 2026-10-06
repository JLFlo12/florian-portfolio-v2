import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

export type OrbMode = 'idle' | 'listening' | 'thinking' | 'speaking';

/* ───────────────────────────────────────────────────────────────
   Sphère de Jarvis (d'après sa sphère holographique dans « Avengers : L'Ère d'Ultron ») :
   des centaines d'éclats orange et dorés sur une sphère qui tourne (quelques-uns bleus),
   des anneaux en pointillés et un cœur lumineux (sans les éclairs du film : Florian les trouvait en trop).
   - au repos : elle respire doucement ;
   - quand elle écoute (micro) : elle s'éclaire et un anneau ondule autour d'elle ;
   - quand Jarvis réfléchit : elle tourne plus vite et ses éclats scintillent davantage ;
   - quand il répond (texte ou voix) : elle bat doucement comme un cœur (« poum-poum », 75 par minute) ;
     chaque battement écarte un peu les éclats et envoie une onde légère.
   Thème sombre : mélange additif (lumière). Thème clair : couleurs plus soutenues, sans mélange additif,
   qui disparaîtrait sur un fond clair. Canvas 2D, en pause hors écran ; animations réduites : image fixe.
   ─────────────────────────────────────────────────────────────── */

type Particle = { x: number; y: number; z: number; r: number; size: number; hue: number; light: number; push: number; tw: number; dash: boolean; blue: boolean };

const BEAT = 0.8; // durée d'un battement (s)
const TAU = Math.PI * 2;

/* « Poum-poum » adouci : un battement ample, puis un plus faible juste après */
const heartbeat = (t: number) => {
  const g = (c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));
  return g(0.1, 0.09) + 0.45 * g(0.38, 0.1);
};

const JarvisOrb = ({ mode }: { mode: OrbMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduced = prefersReducedMotion();
    const root = document.documentElement;

    // Éclats répartis sur la sphère (spirale de Fibonacci), dans une coque épaisse ;
    // un tiers sont de petits traits (fragments de données), un sur sept est bleu
    const N = window.innerWidth < 640 ? 750 : 1300;
    const particles: Particle[] = Array.from({ length: N }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / N;
      const ring = Math.sqrt(1 - y * y);
      const phi = i * 2.399963;
      const blue = Math.random() < 0.14;
      return {
        x: ring * Math.cos(phi), y, z: ring * Math.sin(phi),
        r: 0.78 + Math.random() * 0.26,
        size: 0.8 + Math.random() * 1.8,
        hue: blue ? 190 + Math.random() * 12 : 18 + Math.random() * 26,
        light: Math.random(), // nuance, convertie en luminosité selon le thème
        push: 0.35 + Math.random() * 0.65, // part de l'écart reçu à chaque battement
        tw: Math.random() * TAU,           // phase du scintillement
        dash: Math.random() < 0.33,
        blue,
      };
    });
    // Anneaux en pointillés : grands cercles inclinés qui tournent en sens alternés (trois autour, deux à l'intérieur)
    const rings = [[0.3, 1.1], [1.25, 1.1], [2.2, 1.12], [0.8, 0.62], [1.9, 0.5]].map(([inc, size], k) => ({ inc, size, spin: (k % 2 ? -1 : 1) * (0.25 + 0.15 * k), off: k * 1.7 }));
    const waves: { t: number }[] = [];

    let w = 0, h = 0, dpr = 1, raf = 0, last = performance.now();
    let time = 0, energy = 0, think = 0, listen = 0, rot = 0, beatClock = 0, lastBeat = -1, visible = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    const draw = (dt: number) => {
      const m = modeRef.current;
      const light = !root.classList.contains('dark');
      // Passage en douceur d'un état à l'autre
      const ease = Math.min(1, dt * 3);
      energy += ((m === 'speaking' ? 1 : 0) - energy) * ease;
      think += ((m === 'thinking' ? 1 : 0) - think) * ease;
      listen += ((m === 'listening' ? 1 : 0) - listen) * ease;
      time += dt;
      rot += dt * (0.22 + 0.55 * think + 0.25 * energy + 0.15 * listen);

      const cx = w / 2, cy = h / 2;
      // Battements : seulement pendant que Jarvis répond ; le premier part tout de suite
      if (m === 'speaking') beatClock += dt; else { beatClock = 0; lastBeat = -1; }
      const phase = beatClock % BEAT;
      const pulse = energy * heartbeat(phase);
      const R = Math.min(w, h) * 0.27 * (1 + 0.015 * Math.sin(time * 1.7)) * (1 + 0.035 * pulse);
      const beatIndex = Math.floor(beatClock / BEAT);
      if (m === 'speaking' && beatIndex !== lastBeat && phase > 0.06) {
        lastBeat = beatIndex;
        waves.push({ t: 0 });
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';

      // Cœur lumineux (en thème clair : une lueur chaude plus discrète)
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (0.85 + 0.15 * pulse + 0.1 * listen));
      const glow = 0.5 + 0.2 * pulse + 0.1 * think + 0.15 * listen;
      if (light) {
        core.addColorStop(0, `hsla(32, 100%, 60%, ${(glow * 0.45).toFixed(3)})`);
        core.addColorStop(0.35, `hsla(24, 95%, 55%, ${(glow * 0.18).toFixed(3)})`);
      } else {
        core.addColorStop(0, `hsla(38, 100%, 78%, ${glow.toFixed(3)})`);
        core.addColorStop(0.3, `hsla(26, 100%, 56%, ${(0.26 + 0.11 * pulse).toFixed(3)})`);
      }
      core.addColorStop(1, 'hsla(20, 100%, 50%, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.2, 0, TAU);
      ctx.fill();

      // Rotation autour de l'axe vertical, légère inclinaison vers le spectateur, perspective
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const tilt = 0.38 + 0.05 * Math.sin(time * 0.4);
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const project = (x: number, y: number, z: number) => {
        const x1 = x * cr + z * sr, z1 = -x * sr + z * cr;
        const y2 = y * ct - z1 * st, z2 = y * st + z1 * ct;
        const f = 3 / (3 - z2);
        return { x: cx + x1 * R * f, y: cy + y2 * R * f, z: z2, f };
      };

      // Éclats : plus vifs devant, un peu écartés à chaque battement ;
      // les fragments sont de petits traits orientés le long de la sphère
      ctx.lineWidth = 1;
      for (const p of particles) {
        const r = p.r * (1 + 0.08 * pulse * p.push);
        const q = project(p.x * r, p.y * r, p.z * r);
        const depth = (q.z + 1) / 2;
        const twinkle = 0.75 + 0.25 * Math.sin(time * (2 + 4 * think + 2 * listen) + p.tw);
        const alpha = Math.min(1, (0.25 + 0.75 * depth) * twinkle * (1 + 0.3 * pulse + 0.2 * listen));
        const lum = light ? (p.blue ? 38 : 36 + p.light * 18) : (p.blue ? 70 : 55 + p.light * 25);
        const color = `hsla(${p.hue}, ${light ? 90 : 95}%, ${lum}%, ${alpha.toFixed(3)})`;
        if (p.dash) {
          const e = project((p.x - p.z * 0.06) * r, p.y * r, (p.z + p.x * 0.06) * r);
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(e.x, e.y);
          ctx.stroke();
        } else {
          const s = p.size * q.f * (1 + 0.2 * pulse);
          ctx.fillStyle = color;
          ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
        }
      }

      // Anneaux en pointillés
      const ringColor = light ? '24, 90%, 45%' : '30, 100%, 62%';
      for (const ring of rings) {
        const a0 = time * (ring.spin * (1 + listen)) + ring.off;
        const ci = Math.cos(ring.inc) * ring.size, si = Math.sin(ring.inc) * ring.size;
        for (let k = 0; k < 64; k++) {
          if (k % 4 === 3) continue;
          const t0 = a0 + (k / 64) * TAU;
          const t1 = t0 + (TAU / 64) * 0.7;
          const qa = project(Math.cos(t0) * ring.size, Math.sin(t0) * ci, Math.sin(t0) * si);
          const qb = project(Math.cos(t1) * ring.size, Math.sin(t1) * ci, Math.sin(t1) * si);
          ctx.strokeStyle = `hsla(${ringColor}, ${((0.12 + 0.5 * (qa.z + 1) / 2) * (1 + 0.25 * pulse)).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(qa.x, qa.y);
          ctx.lineTo(qb.x, qb.y);
          ctx.stroke();
        }
      }

      // Écoute : un anneau qui ondule autour de la sphère
      if (listen > 0.01) {
        ctx.strokeStyle = `hsla(${ringColor}, ${(0.45 * listen).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let k = 0; k <= 96; k++) {
          const a = (k / 96) * TAU;
          const rr = R * (1.28 + 0.03 * Math.sin(a * 6 + time * 5) * Math.sin(time * 2.3));
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }

      // Onde légère envoyée par chaque battement
      for (let i = waves.length - 1; i >= 0; i--) {
        const wave = waves[i];
        wave.t += dt;
        const k = wave.t / 1.2;
        if (k >= 1) { waves.splice(i, 1); continue; }
        ctx.strokeStyle = `hsla(${ringColor}, ${(0.25 * (1 - k) * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = 1.2 * (1 - k) + 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.08 + 0.55 * k), 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduced) draw(0); });
    ro.observe(canvas);
    if (reduced) { draw(0); return () => ro.disconnect(); }

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(canvas);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible) draw(dt);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  return (
    <div className="jarvis-orb" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default JarvisOrb;
