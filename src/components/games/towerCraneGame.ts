/* ───────────────────────────────────────────────────────────────
   Tower Crane : moteur et dessin (sans React, testable seul).
   La grue balance un étage au bout de son câble ; on le lâche pour monter la tour.
   - Gravité : l'étage pendule sous le chariot (à-coups du chariot, vent), garde son élan
     quand on le lâche, tombe en accélérant ; s'il dépasse de plus de la moitié dans le vide,
     il bascule autour du bord de l'étage du dessous et tombe (3 ratés = fin).
   - Infini : la vue suit la tour, la grue « grimpe » avec elle ; le ciel passe du jour
     au crépuscule, à la nuit puis à l'espace, et le vent forcit avec l'altitude.
   - La tour se balance d'autant plus qu'elle est haute et mal alignée.
   Unités : pixels et « pas » de simulation (60 par seconde, quel que soit l'écran).
   Coordonnées « monde » : y vers le bas comme le canvas ; à l'écran, y + cam.
   ─────────────────────────────────────────────────────────────── */

export const W = 480;
export const H = 680;
export const STEP_MS = 1000 / 60;
export const MAX_MISSED = 3;
export const LS_KEY = 'tower-crane-best';

const G = 0.55;                     // gravité (px / pas²)
export const FLOOR_W = 112;
export const FLOOR_H = 38;
const SLAB_W = 180;                 // dalle de fondation
export const GROUND_Y = 600;        // haut du sol (monde)
const TOWER_X = W / 2;
const ARM_Y = 70;                   // flèche de la grue (écran)
const MAST_X = 46;
const CABLE = 92;
export const HANG = CABLE + FLOOR_H / 2 + 4; // du chariot au centre de l'étage suspendu
const TOP_ON_SCREEN = 380;          // hauteur d'écran où la caméra garde le haut de la tour
const PERFECT_PX = 5;               // écart maximal pour un « parfait »
const KEEP = 0.6;                   // part de l'élan du chariot gardée par l'étage lâché

type Style = { wall: string; shade: string; trim: string; glass: string };
const STYLES: Style[] = [
  { wall: '#ece6d8', shade: '#cdc3ae', trim: '#f97316', glass: '#33414f' }, // béton clair, liseré orange
  { wall: '#b5573c', shade: '#8e412c', trim: '#ecd9b8', glass: '#2a3440' }, // brique
  { wall: '#41536a', shade: '#2f3e51', trim: '#a9c1d9', glass: '#86c8f2' }, // verre
  { wall: '#dbab4a', shade: '#b48735', trim: '#5c4120', glass: '#2e2b27' }, // ocre
];

export type Floor = { x: number; style: number; lights: boolean[] }; // x : bord gauche, sans le balancement
export type Body = {
  x: number; y: number; vx: number; vy: number; rot: number; vrot: number; style: number; lights: boolean[];
  pivot?: { x: number; y: number; ox: number; oy: number }; // étage qui bascule autour d'un bord
};
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number };
type Popup = { text: string; x: number; y: number; life: number; color: string };
export type Events = { score?: boolean; missed?: boolean; over?: boolean };

const newLights = () => [0, 1, 2].map(() => Math.random() < 0.55);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const fresh = (best: number) => ({
  floors: [] as Floor[],
  cam: 0,
  t: 0,
  phase: 0,
  trolleyX: TOWER_X,
  trolleyV: 118 * 0.022, // déjà à sa vitesse de départ : pas d'à-coup qui lancerait le pendule au premier pas
  th: 0.1,            // angle du câble (rad)
  om: 0,              // vitesse angulaire du câble
  hanging: true,
  respawn: 0,
  nextStyle: 0,
  nextLights: newLights(),
  drop: null as Body | null,
  loose: [] as Body[],
  score: 0,
  best,
  missed: 0,
  combo: 0,
  imbalance: 0,
  swayAmp: 0,
  particles: [] as Particle[],
  popups: [] as Popup[],
  started: false,
  over: false,
  overIn: 0,
  shake: 0,
  flash: 0,
});
export type State = ReturnType<typeof fresh>;

/* Balancement de l'étage i (le dernier bouge le plus) */
export const swayOffset = (s: State, i: number) =>
  s.floors.length ? s.swayAmp * Math.sin(s.t * 0.03) * ((i + 1) / s.floors.length) : 0;

/* Vent : apparaît à partir du 8e étage, change lentement de sens */
export const windAt = (s: State) => {
  const n = s.floors.length;
  return n < 8 ? 0 : Math.min(0.05, (n - 8) * 0.0025) * Math.sin(s.t * 0.004 + 1);
};

const burst = (s: State, x: number, y: number, color: string, count: number, power = 3) => {
  for (let i = 0; i < count; i++) {
    const max = 28 + Math.random() * 22;
    s.particles.push({ x, y, vx: (Math.random() - 0.5) * power * 2, vy: -Math.random() * power - 0.5, life: max, max, color, size: 2 + Math.random() * 3 });
  }
};

/* Lâcher l'étage suspendu : il garde une partie de l'élan du chariot et du balancement */
export const drop = (s: State) => {
  if (s.over || !s.hanging) return false;
  s.started = true;
  s.hanging = false;
  const cx = s.trolleyX + HANG * Math.sin(s.th);
  const cy = ARM_Y + 10 + HANG * Math.cos(s.th);
  s.drop = {
    x: cx, y: cy - s.cam,
    vx: (s.trolleyV + HANG * s.om * Math.cos(s.th)) * KEEP,
    vy: -HANG * s.om * Math.sin(s.th),
    rot: s.th, vrot: 0, style: s.nextStyle, lights: s.nextLights,
  };
  return true;
};

const miss = (s: State, ev: Events) => {
  s.missed++;
  s.combo = 0;
  s.shake = 12;
  s.hanging = false;
  s.respawn = 34;
  ev.missed = true;
  if (s.missed >= MAX_MISSED) s.overIn = 70;
};

const land = (s: State, d: Body, top: number, ev: Events) => {
  const n = s.floors.length;
  const off = n ? swayOffset(s, n - 1) : 0;
  const sl = n ? s.floors[n - 1].x + off : TOWER_X - SLAB_W / 2;
  const sw = n ? FLOOR_W : SLAB_W;
  const left = d.x - FLOOR_W / 2;
  const overlap = Math.min(left + FLOOR_W, sl + sw) - Math.max(left, sl);
  s.drop = null;

  if (overlap <= 0) { // à côté : il continue sa chute le long de la tour
    d.vrot = (Math.random() - 0.5) * 0.1;
    s.loose.push(d);
    miss(s, ev);
    return;
  }
  const center = sl + sw / 2;
  let dx = d.x - center;
  if (Math.abs(dx) > sw / 2) { // centre de gravité dans le vide : il bascule autour du bord
    const px = dx > 0 ? sl + sw : sl;
    d.y = top - FLOOR_H / 2;
    d.rot = 0;
    d.pivot = { x: px, y: top, ox: d.x - px, oy: -FLOOR_H / 2 };
    d.vrot = Math.sign(dx) * 0.012;
    s.loose.push(d);
    burst(s, px, top, '#c8b89a', 6, 2);
    miss(s, ev);
    return;
  }

  // Posé : un « parfait » se recale exactement au centre
  const perfect = Math.abs(dx) <= PERFECT_PX;
  if (perfect) dx = 0;
  const landedLeft = center + dx - FLOOR_W / 2;
  s.floors.push({ x: landedLeft - s.swayAmp * Math.sin(s.t * 0.03), style: d.style, lights: d.lights });
  s.imbalance = s.imbalance * 0.7 + Math.abs(dx) * 0.3;
  s.combo = perfect ? s.combo + 1 : 0;
  const gain = 1 + (perfect ? Math.min(s.combo, 5) : 0); // bonus de série plafonné à +5
  s.score += gain;
  s.hanging = false;
  s.respawn = 22;
  s.shake = perfect ? 3 : 5;
  if (perfect) s.flash = 18;
  burst(s, center + dx, top, '#c8b89a', 10);
  if (perfect) burst(s, center + dx, top - FLOOR_H / 2, '#ffd166', 16, 4);
  s.popups.push({
    text: perfect ? (s.combo > 1 ? `Parfait ×${s.combo}  +${gain}` : `Parfait !  +${gain}`) : '+1',
    x: center + dx, y: top - FLOOR_H - 8, life: 55, color: perfect ? '#ffd166' : '#ffffff',
  });
  ev.score = true;
};

/* Un pas de simulation (1/60 s) */
export const step = (s: State, ev: Events) => {
  s.t++;
  const n = s.floors.length;
  const top = GROUND_Y - n * FLOOR_H; // haut de la tour (monde)
  s.cam += (Math.max(0, TOP_ON_SCREEN - top) - s.cam) * 0.05;
  const wind = windAt(s);
  // Balancement : plus la tour est haute et mal alignée, plus elle oscille
  s.swayAmp += (Math.min(20, n * 0.12 + s.imbalance * 0.5) - s.swayAmp) * 0.02;

  // Chariot : va-et-vient en douceur, un peu plus ample et rapide à mesure que la tour monte
  const amp = Math.min(140, 118 + n * 0.8);
  const omega = Math.min(0.03, 0.022 + n * 0.0003);
  if (!s.over) s.phase += omega;
  const x = TOWER_X + amp * Math.sin(s.phase);
  const v = x - s.trolleyX;
  const a = v - s.trolleyV;
  s.trolleyX = x;
  s.trolleyV = v;
  // Pendule : gravité, à-coups du chariot et vent sur la charge
  s.om += -(G / HANG) * Math.sin(s.th) - (a / HANG) * Math.cos(s.th) + wind / HANG;
  s.om *= 0.996;
  s.th += s.om;

  // Nouvel étage accroché au crochet, lancé avec un petit balancement (plus fort en altitude)
  if (!s.hanging && !s.drop && !s.over && s.overIn === 0) {
    if (s.respawn > 0) s.respawn--;
    else {
      s.hanging = true;
      s.th = (Math.random() < 0.5 ? -1 : 1) * Math.min(0.2, 0.08 + n * 0.004);
      s.om = 0;
      s.nextStyle = Math.floor(n / 8) % STYLES.length;
      s.nextLights = newLights();
    }
  }

  // Étage en chute
  const d = s.drop;
  if (d) {
    const before = d.y + FLOOR_H / 2;
    d.vy += G;
    d.vx = d.vx * 0.995 + wind * 0.6;
    d.x += d.vx;
    d.y += d.vy;
    d.rot *= 0.88;
    if (before <= top && d.y + FLOOR_H / 2 >= top) land(s, d, top, ev);
  }

  // Étages qui basculent ou tombent dans le vide
  for (const b of s.loose) {
    if (b.pivot) {
      const p = b.pivot;
      b.vrot += Math.sign(p.ox) * 0.0035 * (1 + Math.abs(p.ox) / FLOOR_W);
      b.rot += b.vrot;
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      b.x = p.x + p.ox * c - p.oy * sn;
      b.y = p.y + p.ox * sn + p.oy * c;
      if (Math.abs(b.rot) > 0.7) { // il glisse du bord : chute libre
        b.vx = Math.sign(p.ox) * 1.8;
        b.vy = 1.5;
        b.pivot = undefined;
      }
    } else {
      b.vy += G;
      b.vx += wind * 0.6;
      b.x += b.vx;
      b.y += b.vy;
      b.rot += b.vrot;
    }
  }
  s.loose = s.loose.filter((b) => {
    if (!b.pivot && b.y + FLOOR_H / 2 >= GROUND_Y) { // s'écrase au sol (tour encore basse)
      burst(s, b.x, GROUND_Y, '#9b8f7a', 18, 4);
      s.shake = Math.max(s.shake, 8);
      return false;
    }
    return b.y + s.cam < H + 300;
  });

  for (const p of s.particles) { p.vy += 0.15; p.x += p.vx; p.y += p.vy; p.life--; }
  s.particles = s.particles.filter((p) => p.life > 0);
  for (const p of s.popups) { p.y -= 0.8; p.life--; }
  s.popups = s.popups.filter((p) => p.life > 0);
  if (s.shake > 0) s.shake--;
  if (s.flash > 0) s.flash--;
  if (s.overIn > 0 && --s.overIn === 0) { s.over = true; ev.over = true; }
};

/* ——————————————————————————— Dessin ——————————————————————————— */

// Décor généré avec une graine fixe : identique à chaque partie
const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rnd = seeded(42);
const FAR = Array.from({ length: 15 }, (_, i) => ({ x: i * 36 - 14, w: 26 + rnd() * 24, h: 60 + rnd() * 120, lit: rnd() }));
const NEAR = Array.from({ length: 10 }, (_, i) => ({ x: i * 52 - 24, w: 38 + rnd() * 28, h: 30 + rnd() * 80, lit: rnd() }));
const CLOUDS = Array.from({ length: 14 }, (_, i) => ({ x: rnd() * (W + 240), y: -60 - i * 230 - rnd() * 120, s: 0.6 + rnd() * 0.9, v: 0.1 + rnd() * 0.25 }));
const STARS = Array.from({ length: 110 }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.5 + rnd() * 1.3, tw: rnd() * 6 }));

// Ciel selon l'altitude (en étages) : jour, coucher de soleil, nuit, espace
const SKY: [number, string, string][] = [
  [0, '#5b9bd5', '#cfe8f7'],
  [18, '#4a5fa8', '#f4b183'],
  [40, '#151b3d', '#3e4179'],
  [70, '#03040c', '#0e1333'],
];
const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
const skyAt = (alt: number): [string, string] => {
  for (let i = 1; i < SKY.length; i++) {
    if (alt <= SKY[i][0]) {
      const [a0, t0, b0] = SKY[i - 1];
      const [a1, t1, b1] = SKY[i];
      const k = (alt - a0) / (a1 - a0);
      return [mix(t0, t1, k), mix(b0, b1, k)];
    }
  }
  return [SKY[SKY.length - 1][1], SKY[SKY.length - 1][2]];
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/* Un étage : façade ombrée, dalle, trois fenêtres (allumées la nuit), porte au rez-de-chaussée */
const drawFloor = (ctx: CanvasRenderingContext2D, x: number, y: number, styleIndex: number, lights: boolean[], night: number, ground: boolean, flash = 0) => {
  const st = STYLES[styleIndex];
  const g = ctx.createLinearGradient(x, 0, x + FLOOR_W, 0);
  g.addColorStop(0, st.wall);
  g.addColorStop(1, st.shade);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, FLOOR_W, FLOOR_H);
  if (night > 0) { ctx.fillStyle = `rgba(8, 12, 36, ${0.45 * night})`; ctx.fillRect(x, y, FLOOR_W, FLOOR_H); }
  ctx.fillStyle = st.trim;
  ctx.fillRect(x - 2, y, FLOOR_W + 4, 4);
  for (let k = 0; k < 3; k++) {
    if (ground && k === 1) continue;
    const wx = x + 12 + k * 33, wy = y + 11;
    const lit = lights[k] && night > 0.2;
    if (lit) { ctx.fillStyle = `rgba(255, 210, 122, ${0.25 * night})`; ctx.fillRect(wx - 3, wy - 3, 28, 23); }
    ctx.fillStyle = lit ? '#ffd27a' : st.glass;
    ctx.fillRect(wx, wy, 22, 17);
    if (!lit) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.beginPath();
      ctx.moveTo(wx, wy); ctx.lineTo(wx + 10, wy); ctx.lineTo(wx, wy + 9);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(wx, wy + 15, 22, 2); // appui de fenêtre
  }
  if (ground) {
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(x + FLOOR_W / 2 - 10, y + 11, 20, FLOOR_H - 11);
    ctx.fillStyle = '#d9b26a';
    ctx.fillRect(x + FLOOR_W / 2 + 5, y + 25, 2, 3);
  }
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, FLOOR_W - 1, FLOOR_H - 1);
  if (flash > 0) {
    ctx.strokeStyle = `rgba(255, 209, 102, ${flash})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 2, y - 2, FLOOR_W + 4, FLOOR_H + 4);
  }
};

const drawBody = (ctx: CanvasRenderingContext2D, b: Body, cam: number, night: number) => {
  ctx.save();
  ctx.translate(b.x, b.y + cam);
  ctx.rotate(b.rot);
  drawFloor(ctx, -FLOOR_W / 2, -FLOOR_H / 2, b.style, b.lights, night, false);
  ctx.restore();
};

const drawSkyline = (ctx: CanvasRenderingContext2D, list: typeof FAR, base: number, color: string, night: number) => {
  if (base - 200 > H) return;
  ctx.fillStyle = color;
  for (const b of list) ctx.fillRect(b.x, base - b.h, b.w, b.h + 400);
  if (night > 0.2) { // quelques fenêtres allumées dans la ville
    ctx.fillStyle = `rgba(255, 214, 140, ${0.55 * night})`;
    for (const b of list) {
      // Motif propre à chaque immeuble (rang, colonne) : il ne change pas quand la vue défile
      for (let row = 0, wy = base - b.h + 8; wy < base - 6; row++, wy += 11) {
        for (let col = 0, wx = b.x + 5; wx < b.x + b.w - 5; col++, wx += 8) {
          if ((row * 7 + col * 13 + Math.floor(b.lit * 100)) % 5 === 0) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }
};

const drawCloud = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, night: number) => {
  ctx.fillStyle = night > 0.5 ? `rgba(140, 150, 190, ${0.35 * (1 - night) + 0.12})` : `rgba(255, 255, 255, ${0.85 - 0.5 * night})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 46 * size, 15 * size, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 24 * size, y + 3 * size, 26 * size, 12 * size, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 20 * size, y - 7 * size, 28 * size, 16 * size, 0, 0, Math.PI * 2);
  ctx.fill();
};

/* La grue : mât en treillis (qui « grimpe » avec la tour), flèche, contre-flèche, cabine, chariot, câble */
const drawCrane = (ctx: CanvasRenderingContext2D, s: State, night: number) => {
  const yellow = '#f5b819', dark = '#b8860b';
  // Mât
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(MAST_X - 9, ARM_Y); ctx.lineTo(MAST_X - 9, H);
  ctx.moveTo(MAST_X + 9, ARM_Y); ctx.lineTo(MAST_X + 9, H);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = dark;
  ctx.beginPath();
  const off = (s.cam % 22 + 22) % 22; // le treillis défile avec la montée
  for (let y = ARM_Y - 22 + off; y < H; y += 22) {
    ctx.moveTo(MAST_X - 9, y); ctx.lineTo(MAST_X + 9, y + 11); ctx.lineTo(MAST_X - 9, y + 22);
  }
  ctx.stroke();
  // Pointe du mât et tirants
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MAST_X - 9, ARM_Y - 12); ctx.lineTo(MAST_X, ARM_Y - 50); ctx.lineTo(MAST_X + 9, ARM_Y - 12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MAST_X, ARM_Y - 50); ctx.lineTo(W - 14, ARM_Y - 12);
  ctx.moveTo(MAST_X, ARM_Y - 50); ctx.lineTo(MAST_X - 44, ARM_Y - 12);
  ctx.stroke();
  // Flèche (deux membrures + treillis triangulé)
  ctx.strokeStyle = yellow;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(MAST_X - 46, ARM_Y - 12); ctx.lineTo(W - 10, ARM_Y - 12);
  ctx.moveTo(MAST_X - 46, ARM_Y); ctx.lineTo(W - 10, ARM_Y);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = MAST_X - 46; x < W - 10; x += 16) {
    ctx.moveTo(x, ARM_Y); ctx.lineTo(x + 8, ARM_Y - 12); ctx.lineTo(x + 16, ARM_Y);
  }
  ctx.stroke();
  // Contrepoids et cabine
  ctx.fillStyle = '#8a8478';
  ctx.fillRect(MAST_X - 46, ARM_Y - 2, 26, 20);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(MAST_X - 46, ARM_Y + 6, 26, 2);
  ctx.fillRect(MAST_X - 46, ARM_Y + 12, 26, 2);
  ctx.fillStyle = yellow;
  roundRect(ctx, MAST_X + 10, ARM_Y + 2, 24, 20, 3);
  ctx.fill();
  ctx.fillStyle = night > 0.3 ? '#ffe08a' : '#9fd4f5';
  ctx.fillRect(MAST_X + 14, ARM_Y + 6, 16, 8);
  // Feu rouge au bout de la flèche
  if (Math.floor(s.t / 30) % 2 === 0) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(W - 12, ARM_Y - 14, 3, 0, Math.PI * 2);
    ctx.fill();
    if (night > 0) {
      ctx.fillStyle = `rgba(255, 59, 48, ${0.3 * night})`;
      ctx.beginPath();
      ctx.arc(W - 12, ARM_Y - 14, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Chariot
  ctx.fillStyle = '#d4d4d4';
  roundRect(ctx, s.trolleyX - 11, ARM_Y - 3, 22, 9, 2);
  ctx.fill();
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(s.trolleyX - 6, ARM_Y + 6, 2.2, 0, Math.PI * 2);
  ctx.arc(s.trolleyX + 6, ARM_Y + 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Câble, crochet et étage suspendu
  const len = s.hanging ? CABLE : 34;
  const th = s.hanging ? s.th : s.th * 0.3;
  const hx = s.trolleyX + len * Math.sin(th);
  const hy = ARM_Y + 10 + len * Math.cos(th);
  ctx.strokeStyle = night > 0.5 ? '#9aa0b5' : '#4a4a4a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.trolleyX, ARM_Y + 6); ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.fillStyle = '#e0a106';
  roundRect(ctx, hx - 5, hy - 2, 10, 7, 2);
  ctx.fill();
  if (s.hanging) {
    // Élingues jusqu'aux coins de l'étage
    const bx = s.trolleyX + HANG * Math.sin(s.th), by = ARM_Y + 10 + HANG * Math.cos(s.th);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(s.th);
    ctx.strokeStyle = night > 0.5 ? '#9aa0b5' : '#4a4a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-FLOOR_W / 2 + 6, -FLOOR_H / 2); ctx.lineTo(0, -FLOOR_H / 2 - 4);
    ctx.lineTo(FLOOR_W / 2 - 6, -FLOOR_H / 2);
    ctx.stroke();
    drawFloor(ctx, -FLOOR_W / 2, -FLOOR_H / 2, s.nextStyle, s.nextLights, night, s.floors.length === 0);
    ctx.restore();
  } else {
    ctx.strokeStyle = '#e0a106';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy + 9, 4, 0, Math.PI);
    ctx.stroke();
  }
};

const helmet = (ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean) => {
  ctx.fillStyle = on ? '#f5b819' : 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(x, y, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 11, y - 1, 22, 3);
};

export const draw = (ctx: CanvasRenderingContext2D, s: State, dpr: number) => {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const alt = s.cam / FLOOR_H;
  const night = clamp((alt - 22) / 20, 0, 1);
  const day = 1 - clamp(alt / 28, 0, 1);
  ctx.save();
  if (s.shake) ctx.translate((Math.random() - 0.5) * s.shake * 0.7, (Math.random() - 0.5) * s.shake * 0.7);

  // Ciel
  const [skyTop, skyBottom] = skyAt(alt);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(1, skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(-12, -12, W + 24, H + 24);

  // Étoiles, soleil, lune
  if (night > 0) {
    ctx.fillStyle = '#ffffff';
    for (const st of STARS) {
      ctx.globalAlpha = night * (0.55 + 0.45 * Math.sin(s.t * 0.05 + st.tw));
      ctx.fillRect(st.x, (st.y + s.cam * 0.03) % H, st.r, st.r);
    }
    ctx.globalAlpha = 1;
  }
  if (day > 0) {
    const sy = 150 + alt * 6;
    const sun = ctx.createRadialGradient(390, sy, 4, 390, sy, 70);
    sun.addColorStop(0, `rgba(255, 244, 214, ${day})`);
    sun.addColorStop(0.35, `rgba(255, 214, 140, ${0.55 * day})`);
    sun.addColorStop(1, 'rgba(255, 200, 120, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(300, sy - 80, 180, 160);
  }
  if (night > 0) { // pleine lune et ses cratères
    const moon = ctx.createRadialGradient(392, 140, 14, 392, 140, 46);
    moon.addColorStop(0, `rgba(244, 241, 230, ${0.25 * night})`);
    moon.addColorStop(1, 'rgba(244, 241, 230, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(340, 90, 104, 100);
    ctx.fillStyle = `rgba(244, 241, 230, ${night})`;
    ctx.beginPath();
    ctx.arc(392, 140, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(120, 115, 100, ${0.25 * night})`;
    for (const [cx, cy, r] of [[386, 134, 4], [398, 146, 3], [396, 132, 2]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ville au loin : deux plans qui défilent moins vite que la tour (profondeur)
  drawSkyline(ctx, FAR, GROUND_Y + s.cam * 0.25, mix('#8aa0c0', '#1c2246', clamp(night + (1 - day) * 0.3, 0, 1)), night);
  drawSkyline(ctx, NEAR, GROUND_Y + s.cam * 0.5, mix('#62779a', '#121735', clamp(night + (1 - day) * 0.3, 0, 1)), night);

  // Nuages
  for (const c of CLOUDS) {
    const y = c.y + s.cam * 0.75;
    if (y < -60 || y > H + 60) continue;
    const x = ((c.x + s.t * c.v * (1 + Math.abs(windAt(s)) * 40)) % (W + 240)) - 120;
    drawCloud(ctx, x, y, c.s, night);
  }

  // Sol et chantier
  const gy = GROUND_Y + s.cam;
  if (gy < H + 10) {
    ctx.fillStyle = mix('#6f9150', '#26341f', night);
    ctx.fillRect(-12, gy, W + 24, H - gy + 24);
    ctx.fillStyle = mix('#5d5a52', '#2a2925', night);
    ctx.fillRect(-12, gy + 26, W + 24, 30); // route
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let x = -10; x < W; x += 40) ctx.fillRect(x, gy + 40, 20, 2);
    // Dalle de fondation avec bandes de sécurité
    const sx = TOWER_X - SLAB_W / 2;
    ctx.fillStyle = '#a3a199';
    ctx.fillRect(sx, gy - 2, SLAB_W, 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, gy + 6, SLAB_W, 5);
    ctx.clip();
    for (let x = sx - 10; x < sx + SLAB_W; x += 12) {
      ctx.fillStyle = '#f5b819';
      ctx.beginPath();
      ctx.moveTo(x, gy + 11); ctx.lineTo(x + 6, gy + 6); ctx.lineTo(x + 12, gy + 6); ctx.lineTo(x + 6, gy + 11);
      ctx.fill();
    }
    ctx.restore();
    // Cônes
    for (const cx of [sx - 18, sx + SLAB_W + 18]) {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(cx - 6, gy + 10); ctx.lineTo(cx, gy - 8); ctx.lineTo(cx + 6, gy + 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 3, gy, 6, 2);
    }
  }

  // Tour
  for (let i = 0; i < s.floors.length; i++) {
    const y = GROUND_Y - (i + 1) * FLOOR_H + s.cam;
    if (y > H || y + FLOOR_H < -20) continue;
    const f = s.floors[i];
    const top = i === s.floors.length - 1;
    // Ombre portée légère à droite
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(f.x + swayOffset(s, i) + FLOOR_W, y + 4, 5, FLOOR_H);
    drawFloor(ctx, f.x + swayOffset(s, i), y, f.style, f.lights, night, i === 0, top ? s.flash / 18 : 0);
  }

  // Étages qui tombent ou basculent
  for (const b of s.loose) drawBody(ctx, b, s.cam, night);
  if (s.drop) drawBody(ctx, s.drop, s.cam, night);

  drawCrane(ctx, s, night);

  // Poussière, étincelles, textes
  for (const p of s.particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y + s.cam - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = '700 16px "Hubot Sans", system-ui, sans-serif';
  for (const p of s.popups) {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillText(p.text, p.x + 1, p.y + s.cam + 1);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y + s.cam);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Tableau de bord (sans tremblement)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 4;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px "Hubot Sans", system-ui, sans-serif';
  ctx.fillText(String(s.score), 84, 122);
  ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(`${s.floors.length} ÉTAGES · ${s.floors.length * 3} M`, 84, 140);
  const wind = windAt(s);
  if (Math.abs(wind) > 0.004) ctx.fillText(`VENT ${wind > 0 ? '→' : '←'} ${Math.round(Math.abs(wind) * 600)} km/h`, 84, 156);
  ctx.shadowBlur = 0;
  for (let i = 0; i < MAX_MISSED; i++) helmet(ctx, W - 24 - i * 26, 122, i < MAX_MISSED - s.missed);

  // Consigne de départ
  if (!s.started && !s.over) {
    ctx.fillStyle = 'rgba(10, 12, 24, 0.55)';
    roundRect(ctx, W / 2 - 170, 300, 340, 70, 14);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px "Hubot Sans", system-ui, sans-serif';
    ctx.fillText('Touchez ou Espace pour lâcher l\'étage', W / 2, 328);
    ctx.font = '500 11px "Geist Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('À moitié dans le vide, il bascule · 3 ratés = fin', W / 2, 350);
  }

  // Fin de partie
  if (s.over) {
    ctx.fillStyle = 'rgba(6, 8, 18, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f5b819';
    ctx.font = '800 34px "Hubot Sans", system-ui, sans-serif';
    ctx.fillText('CHANTIER TERMINÉ', W / 2, H / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px "Hubot Sans", system-ui, sans-serif';
    ctx.fillText(`Score : ${s.score}`, W / 2, H / 2 + 2);
    ctx.font = '500 13px "Geist Mono", ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(`${s.floors.length} étages · ${s.floors.length * 3} m · meilleur : ${Math.max(s.best, s.score)}`, W / 2, H / 2 + 30);
  }
};
