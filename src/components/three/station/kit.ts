import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ───────────────────────────────────────────────────────────────
   Kit de construction de la station : tout est généré par le code.
   - textures dessinées dans des canvas (tôles, isolant doré, fenêtres,
     écrans, baies de serveurs, circuit imprimé, cellules solaires),
     avec leurs cartes de relief (normal maps calculées depuis une carte de hauteur) ;
   - géométries : coques usinées (profil de révolution à arêtes vives),
     caissons à bords arrondis, poutres et rambardes instanciées ;
   - "Bucket" : regroupe les pièces par matériau et les fusionne (peu d'appels de rendu).
   ─────────────────────────────────────────────────────────────── */

export const PALETTE = {
  black: 0x080706,
  black2: 0x100c09,
  orange: 0xff7518,
  orangeHot: 0xff8a32,
  metal: 0x24211f,
  text: 0xe8e1d9,
};

export type Quality = 'high' | 'low';

/* ——— Hasard reproductible ——— */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas2d = (w: number, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d', { willReadFrequently: true })! };
};

const texture = (c: HTMLCanvasElement, srgb: boolean, repeat = true) => {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
};

/** Carte de relief depuis une carte de hauteur (gris), par différences de Sobel, avec bords qui se raccordent. */
function normalFromHeight(height: HTMLCanvasElement, strength: number) {
  const w = height.width;
  const h = height.height;
  const src = height.getContext('2d')!.getImageData(0, 0, w, h).data;
  const { c, g } = canvas2d(w, h);
  const out = g.createImageData(w, h);
  const H = (x: number, y: number) => src[((((y + h) % h) * w + ((x + w) % w)) << 2)] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) << 2;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return c;
}

/* Bruit de valeur (taches, usure, froissé) */
function valueNoise(rng: () => number, cells: number) {
  const grid = Array.from({ length: cells * cells }, () => rng());
  const at = (x: number, y: number) => grid[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
  return (u: number, v: number) => {
    const x = u * cells;
    const y = v * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * sx;
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export interface SurfaceMaps { map: THREE.Texture; normalMap: THREE.Texture; ormMap: THREE.Texture }

/**
 * Tôles de coque : panneaux découpés récursivement, joints creusés, trappes vissées,
 * grilles d'aération, rivets, rares bandes de danger et marquages, usure.
 * Une tuile = 8 unités monde (les UV des pièces sont en mètres / 8).
 */
export function panelMaps(seed: number, size: number, opts: { base: [number, number, number]; spread?: number; hazard?: number; light?: number }): SurfaceMaps {
  const rng = makeRng(seed);
  const albedo = canvas2d(size);
  const height = canvas2d(size);
  const orm = canvas2d(size);
  const A = albedo.g;
  const Hh = height.g;
  const O = orm.g;
  const s = size / 1024;
  const spread = opts.spread ?? 0.16;
  const tone = (k: number) => `rgb(${opts.base.map((c) => Math.round(Math.min(255, c * k))).join(',')})`;
  const grey = (v: number) => `rgb(${v},${v},${v})`;
  const rough = (r: number, m: number) => `rgb(0,${Math.round(r * 255)},${Math.round(m * 255)})`;

  A.fillStyle = tone(1); A.fillRect(0, 0, size, size);
  Hh.fillStyle = grey(128); Hh.fillRect(0, 0, size, size);
  O.fillStyle = rough(0.58, 0.75); O.fillRect(0, 0, size, size);

  const panels: [number, number, number, number][] = [];
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    const min = 96 * s;
    if (depth > 5 || (w < min * 2 && h < min * 2) || (depth > 1 && rng() < 0.16)) { panels.push([x, y, w, h]); return; }
    const vertical = w > h ? rng() < 0.8 : rng() < 0.2;
    const cut = 0.3 + rng() * 0.4;
    if (vertical && w >= min * 2) {
      const a = Math.round((w * cut) / (16 * s)) * 16 * s;
      split(x, y, a, h, depth + 1); split(x + a, y, w - a, h, depth + 1);
    } else if (h >= min * 2) {
      const a = Math.round((h * cut) / (16 * s)) * 16 * s;
      split(x, y, w, a, depth + 1); split(x, y + a, w, h - a, depth + 1);
    } else panels.push([x, y, w, h]);
  };
  split(0, 0, size, size, 0);

  const lightP = opts.light ?? 0.18;
  for (const [x, y, w, h] of panels) {
    const k = 1 + (rng() - 0.5) * 2 * spread + (rng() < lightP ? 0.55 + rng() * 0.4 : 0);
    A.fillStyle = tone(k); A.fillRect(x, y, w, h);
    const lift = 128 + Math.round((rng() - 0.5) * 18);
    Hh.fillStyle = grey(lift); Hh.fillRect(x, y, w, h);
    O.fillStyle = rough(0.42 + rng() * 0.32, 0.6 + rng() * 0.3); O.fillRect(x, y, w, h);
    // Joint creusé et liseré clair d'usure
    const j = Math.max(1, 3 * s);
    A.strokeStyle = 'rgba(4,3,3,.85)'; A.lineWidth = j * 1.4; A.strokeRect(x + j / 2, y + j / 2, w - j, h - j);
    A.strokeStyle = 'rgba(255,240,225,.07)'; A.lineWidth = 1; A.strokeRect(x + j * 1.6, y + j * 1.6, w - j * 3.2, h - j * 3.2);
    Hh.strokeStyle = grey(40); Hh.lineWidth = j * 2; Hh.strokeRect(x + j, y + j, w - j * 2, h - j * 2);
    const r = rng();
    if (r < 0.22 && w > 120 * s && h > 90 * s) {
      // Trappe vissée
      const hw = w * (0.35 + rng() * 0.35);
      const hh = h * (0.3 + rng() * 0.35);
      const hx = x + (w - hw) * (0.2 + rng() * 0.6);
      const hy = y + (h - hh) * (0.2 + rng() * 0.6);
      A.fillStyle = tone(k * 0.78); A.fillRect(hx, hy, hw, hh);
      A.strokeStyle = 'rgba(0,0,0,.7)'; A.lineWidth = 2 * s; A.strokeRect(hx, hy, hw, hh);
      Hh.fillStyle = grey(lift - 26); Hh.fillRect(hx, hy, hw, hh);
      Hh.strokeStyle = grey(30); Hh.lineWidth = 3 * s; Hh.strokeRect(hx, hy, hw, hh);
      for (const [cx, cy] of [[hx + 7 * s, hy + 7 * s], [hx + hw - 7 * s, hy + 7 * s], [hx + 7 * s, hy + hh - 7 * s], [hx + hw - 7 * s, hy + hh - 7 * s]]) {
        Hh.fillStyle = grey(210); Hh.beginPath(); Hh.arc(cx, cy, 3.2 * s, 0, 7); Hh.fill();
        A.fillStyle = 'rgba(200,190,180,.35)'; A.beginPath(); A.arc(cx, cy, 2.4 * s, 0, 7); A.fill();
      }
    } else if (r < 0.36 && w > 110 * s) {
      // Grille d'aération
      const n = 5 + Math.floor(rng() * 8);
      const gx = x + w * 0.15;
      const gw = w * 0.7;
      const gy = y + h * (0.2 + rng() * 0.4);
      for (let i = 0; i < n; i++) {
        const yy = gy + i * 9 * s;
        if (yy > y + h - 10 * s) break;
        A.fillStyle = 'rgba(0,0,0,.75)'; A.fillRect(gx, yy, gw, 4 * s);
        Hh.fillStyle = grey(30); Hh.fillRect(gx, yy, gw, 4 * s);
        Hh.fillStyle = grey(170); Hh.fillRect(gx, yy + 4 * s, gw, 2 * s);
      }
      O.fillStyle = rough(0.8, 0.4); O.fillRect(gx, gy, gw, n * 9 * s);
    } else if (r < 0.5) {
      // Rivets le long des bords
      const step = 18 * s;
      for (let px = x + 10 * s; px < x + w - 8 * s; px += step) {
        for (const py of [y + 8 * s, y + h - 8 * s]) {
          Hh.fillStyle = grey(190); Hh.beginPath(); Hh.arc(px, py, 2.2 * s, 0, 7); Hh.fill();
          A.fillStyle = 'rgba(0,0,0,.4)'; A.beginPath(); A.arc(px + 0.8 * s, py + 0.8 * s, 2 * s, 0, 7); A.fill();
        }
      }
    } else if (r < 0.5 + (opts.hazard ?? 0.03) && w > 80 * s && h > 40 * s) {
      // Bande de danger orange et noir
      const bh = Math.min(h * 0.4, 34 * s);
      const by = y + h - bh - 8 * s;
      A.save(); A.beginPath(); A.rect(x + 8 * s, by, w - 16 * s, bh); A.clip();
      A.fillStyle = '#c95a14'; A.fillRect(x, by, w, bh);
      A.fillStyle = '#100c09';
      for (let px = x - bh; px < x + w + bh; px += 24 * s) { A.beginPath(); A.moveTo(px, by + bh); A.lineTo(px + 12 * s, by + bh); A.lineTo(px + 12 * s + bh, by); A.lineTo(px + bh, by); A.fill(); }
      A.restore();
      O.fillStyle = rough(0.5, 0.1); O.fillRect(x + 8 * s, by, w - 16 * s, bh);
    } else if (r < 0.6 && w > 100 * s && h > 50 * s) {
      // Marquage au pochoir
      A.fillStyle = 'rgba(232,225,217,.22)';
      A.font = `600 ${Math.round(15 * s)}px monospace`;
      const code = `${String.fromCharCode(65 + Math.floor(rng() * 6))}${Math.floor(rng() * 9)}-${String(Math.floor(rng() * 99)).padStart(2, '0')}`;
      A.fillText(code, x + 12 * s, y + 26 * s);
    }
  }

  // Usure : taches et rayures
  const noise = valueNoise(rng, 16);
  const img = A.getImageData(0, 0, size, size);
  const ormImg = O.getImageData(0, 0, size, size);
  for (let i = 0, p = 0; i < size * size; i++, p += 4) {
    const u = (i % size) / size;
    const v = Math.floor(i / size) / size;
    const n = noise(u, v) * 0.6 + noise(u * 3.1 + 0.3, v * 3.1 + 0.7) * 0.4;
    const grime = 0.86 + n * 0.22 + (rng() - 0.5) * 0.05;
    img.data[p] *= grime; img.data[p + 1] *= grime; img.data[p + 2] *= grime;
    ormImg.data[p + 1] = Math.min(255, ormImg.data[p + 1] * (0.9 + n * 0.25));
  }
  A.putImageData(img, 0, 0);
  O.putImageData(ormImg, 0, 0);
  A.strokeStyle = 'rgba(255,245,235,.045)'; A.lineWidth = 1;
  for (let i = 0; i < 160; i++) {
    const x = rng() * size;
    const y = rng() * size;
    A.beginPath(); A.moveTo(x, y); A.lineTo(x + (rng() - 0.5) * 80 * s, y + (rng() - 0.5) * 10 * s); A.stroke();
  }

  return {
    map: texture(albedo.c, true),
    normalMap: texture(normalFromHeight(height.c, 2.4), false),
    ormMap: texture(orm.c, false),
  };
}

/** Isolant multicouche doré, froissé (couvertures thermiques). */
export function foilMaps(seed: number, size: number): SurfaceMaps {
  const rng = makeRng(seed);
  const albedo = canvas2d(size);
  const height = canvas2d(size);
  const orm = canvas2d(size);
  const n1 = valueNoise(rng, 12);
  const n2 = valueNoise(rng, 37);
  const n3 = valueNoise(rng, 90);
  const a = albedo.g.createImageData(size, size);
  const h = height.g.createImageData(size, size);
  const o = orm.g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const f = n1(u, v) * 0.5 + n2(u, v) * 0.33 + n3(u, v) * 0.17;
      const crease = Math.abs(Math.sin((n2(u, v) * 6 + n3(u, v) * 2) * Math.PI)) ;
      const hv = (f * 0.7 + (1 - crease) * 0.3) * 255;
      const i = (y * size + x) << 2;
      const k = 0.72 + f * 0.45;
      a.data[i] = 190 * k; a.data[i + 1] = 128 * k; a.data[i + 2] = 52 * k; a.data[i + 3] = 255;
      h.data[i] = h.data[i + 1] = h.data[i + 2] = hv; h.data[i + 3] = 255;
      o.data[i] = 0; o.data[i + 1] = (0.24 + crease * 0.2) * 255; o.data[i + 2] = 255; o.data[i + 3] = 255;
    }
  }
  albedo.g.putImageData(a, 0, 0);
  height.g.putImageData(h, 0, 0);
  orm.g.putImageData(o, 0, 0);
  // Coutures des couvertures
  for (const g of [albedo.g, height.g]) {
    g.strokeStyle = g === albedo.g ? 'rgba(60,35,10,.8)' : 'rgb(40,40,40)';
    g.lineWidth = 3;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (size * i) / 4); g.lineTo(size, (size * i) / 4); g.stroke(); }
  }
  return { map: texture(albedo.c, true), normalMap: texture(normalFromHeight(height.c, 3), false), ormMap: texture(orm.c, false) };
}

/** Bande de hublots éclairés (carte d'émission) : cadres sombres, cabines plus ou moins allumées. */
export function windowTexture(seed: number, cols: number, rows: number, lit = 0.72) {
  const rng = makeRng(seed);
  const cw = 64;
  const ch = 64;
  const { c, g } = canvas2d(cols * cw, rows * ch);
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = rng() < lit;
      const warm = rng();
      const b = on ? 0.45 + rng() * 0.55 : 0.03 + rng() * 0.05;
      const col = warm < 0.7 ? [255, 176, 110] : warm < 0.9 ? [255, 138, 50] : [255, 222, 190];
      const grad = g.createLinearGradient(0, y * ch, 0, (y + 1) * ch);
      grad.addColorStop(0, `rgba(${col.map((v) => Math.round(v * b * 0.75)).join(',')},1)`);
      grad.addColorStop(1, `rgba(${col.map((v) => Math.round(v * b)).join(',')},1)`);
      g.fillStyle = grad;
      g.beginPath();
      g.roundRect(x * cw + 12, y * ch + 14, cw - 24, ch - 28, 9);
      g.fill();
      if (on && rng() < 0.35) {
        // Silhouette ou meuble dans la cabine
        g.fillStyle = `rgba(0,0,0,${0.3 + rng() * 0.4})`;
        g.fillRect(x * cw + 16 + rng() * 20, y * ch + 26 + rng() * 8, 6 + rng() * 10, 18);
      }
    }
  }
  return texture(c, true);
}

/* ——— Écrans (atlas 4 × 2) : interfaces monochromes orange ——— */
export const SCREEN_COLS = 4;
export const SCREEN_ROWS = 2;
export function screenAtlas(seed: number) {
  const rng = makeRng(seed);
  const W = 256;
  const H = 160;
  const { c, g } = canvas2d(W * SCREEN_COLS, H * SCREEN_ROWS);
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  const ink = (a: number) => `rgba(255,${Math.round(122 + a * 60)},${Math.round(40 + a * 40)},${a})`;
  for (let k = 0; k < SCREEN_COLS * SCREEN_ROWS; k++) {
    const ox = (k % SCREEN_COLS) * W;
    const oy = Math.floor(k / SCREEN_COLS) * H;
    g.save();
    g.translate(ox, oy);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, 'rgb(34,14,4)'); bg.addColorStop(1, 'rgb(16,7,2)');
    g.fillStyle = bg; g.fillRect(4, 4, W - 8, H - 8);
    g.strokeStyle = ink(0.5); g.lineWidth = 1.5; g.strokeRect(6, 6, W - 12, H - 12);
    const kind = k % 4;
    if (kind === 0) {
      // Lignes de code
      for (let i = 0; i < 12; i++) {
        let x = 16 + (rng() < 0.4 ? 14 : 0) + (rng() < 0.2 ? 14 : 0);
        while (x < W - 30 && rng() < 0.85) {
          const w = 8 + rng() * 34;
          g.fillStyle = ink(rng() < 0.25 ? 0.95 : 0.5);
          g.fillRect(x, 16 + i * 11, w, 4);
          x += w + 6;
        }
      }
    } else if (kind === 1) {
      // Courbes de supervision
      for (let l = 0; l < 3; l++) {
        g.strokeStyle = ink(0.9 - l * 0.25); g.lineWidth = 2;
        g.beginPath();
        let y = 40 + l * 34;
        for (let x = 14; x < W - 14; x += 6) { y += (rng() - 0.5) * 12; y = Math.max(16, Math.min(H - 16, y)); if (x === 14) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
      g.fillStyle = ink(0.35);
      for (let x = 14; x < W - 14; x += 24) g.fillRect(x, H - 20, 1, 6);
    } else if (kind === 2) {
      // Spectre / radio
      g.fillStyle = ink(0.8);
      for (let x = 14; x < W - 14; x += 4) {
        const d = Math.abs(x - W / 2) / (W / 2);
        const v = (1 - d) * (0.3 + rng() * 0.7) * (H - 40) * (rng() < 0.05 ? 1.3 : 0.6);
        g.fillRect(x, H - 16 - v, 2.5, v);
      }
    } else {
      // Carte du réseau : nœuds reliés
      const nodes = Array.from({ length: 12 }, () => [20 + rng() * (W - 40), 18 + rng() * (H - 36)]);
      g.strokeStyle = ink(0.4); g.lineWidth = 1;
      nodes.forEach(([x, y], i) => { const [x2, y2] = nodes[(i * 5 + 3) % nodes.length]; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke(); });
      nodes.forEach(([x, y], i) => { g.fillStyle = ink(i % 4 === 0 ? 1 : 0.7); g.beginPath(); g.arc(x, y, i % 4 === 0 ? 4 : 2.5, 0, 7); g.fill(); });
    }
    // Lignes de balayage
    g.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 4; y < H - 4; y += 3) g.fillRect(4, y, W - 8, 1);
    g.restore();
  }
  const t = texture(c, true, false);
  return t;
}

/** Façade de baie serveur : unités 1U/2U, grilles, voyants (la carte d'émission ne garde que les voyants). */
export function rackMaps(seed: number) {
  const rng = makeRng(seed);
  const W = 128;
  const H = 512;
  const base = canvas2d(W, H);
  const glow = canvas2d(W, H);
  const B = base.g;
  const G = glow.g;
  B.fillStyle = '#121010'; B.fillRect(0, 0, W, H);
  G.fillStyle = '#000'; G.fillRect(0, 0, W, H);
  let y = 10;
  while (y < H - 14) {
    const u = rng() < 0.6 ? 1 : rng() < 0.7 ? 2 : 4;
    const h = u * 14;
    if (y + h > H - 10) break;
    B.fillStyle = `rgb(${30 + rng() * 14},${28 + rng() * 12},${27 + rng() * 10})`;
    B.fillRect(8, y, W - 16, h - 2);
    B.fillStyle = 'rgba(0,0,0,.55)';
    for (let x = 30; x < W - 16; x += 4) B.fillRect(x, y + 3, 2, h - 8);
    const leds = 1 + Math.floor(rng() * 4);
    for (let i = 0; i < leds; i++) {
      const lx = 12 + i * 5;
      const ly = y + 4 + rng() * (h - 10);
      const warm = rng() < 0.8;
      G.fillStyle = warm ? '#ff8a32' : '#ffe2c4';
      G.fillRect(lx, ly, 3, 3);
      B.fillStyle = warm ? '#5a2a0c' : '#5a5048';
      B.fillRect(lx, ly, 3, 3);
    }
    y += h;
  }
  return { map: texture(base.c, true), emissiveMap: texture(glow.c, true) };
}

/** Circuit imprimé géant (module d'ingénierie) : pistes orthogonales et à 45°, puces, broches. */
export function pcbMaps(seed: number) {
  const rng = makeRng(seed);
  const S = 1024;
  const base = canvas2d(S);
  const glow = canvas2d(S);
  const B = base.g;
  const G = glow.g;
  B.fillStyle = '#16120f'; B.fillRect(0, 0, S, S);
  G.fillStyle = '#000'; G.fillRect(0, 0, S, S);
  const chips: [number, number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const w = 60 + rng() * 160;
    const h = 60 + rng() * 140;
    chips.push([rng() * (S - w), rng() * (S - h), w, h]);
  }
  for (let i = 0; i < 220; i++) {
    let x = Math.round(rng() * 64) * 16;
    let yy = Math.round(rng() * 64) * 16;
    const path: [number, number][] = [[x, yy]];
    for (let s = 0; s < 4 + rng() * 6; s++) {
      const dir = Math.floor(rng() * 8);
      const len = (2 + Math.floor(rng() * 8)) * 16;
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][dir];
      const dy = [0, 1, 1, 1, 0, -1, -1, -1][dir];
      x += dx * len; yy += dy * len;
      path.push([x, yy]);
    }
    const bright = rng() < 0.3;
    for (const [g, col, w] of [[B, '#5b3416', 3], [G, bright ? 'rgba(255,128,40,.95)' : 'rgba(255,110,30,.28)', bright ? 2.5 : 2]] as const) {
      g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round';
      g.beginPath(); path.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
    }
    const [ex, ey] = path[path.length - 1];
    B.fillStyle = '#9a6a3a'; B.beginPath(); B.arc(ex, ey, 4, 0, 7); B.fill();
  }
  for (const [x, y, w, h] of chips) {
    B.fillStyle = '#0b0a0a'; B.fillRect(x, y, w, h);
    B.strokeStyle = '#2c2622'; B.lineWidth = 2; B.strokeRect(x + 4, y + 4, w - 8, h - 8);
    B.fillStyle = '#8f8172';
    for (let px = x + 8; px < x + w - 8; px += 10) { B.fillRect(px, y - 6, 4, 6); B.fillRect(px, y + h, 4, 6); }
    G.fillStyle = 'rgba(255,140,50,.9)'; G.fillRect(x + w - 16, y + 10, 5, 5);
  }
  return { map: texture(base.c, true), emissiveMap: texture(glow.c, true) };
}

/** Panneau solaire : cellules sombres, fils de cuivre, bus ; le revers est traité à part (matériau doré). */
export function solarMaps(seed: number) {
  const rng = makeRng(seed);
  const S = 512;
  const albedo = canvas2d(S);
  const height = canvas2d(S);
  const A = albedo.g;
  const Hh = height.g;
  A.fillStyle = '#0d0b0a'; A.fillRect(0, 0, S, S);
  Hh.fillStyle = 'rgb(128,128,128)'; Hh.fillRect(0, 0, S, S);
  const n = 8;
  const cell = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const k = 0.85 + rng() * 0.3;
      A.fillStyle = `rgb(${Math.round(26 * k)},${Math.round(22 * k)},${Math.round(24 * k)})`;
      A.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
      A.fillStyle = 'rgba(176,112,52,.55)';
      for (let i = 1; i < 6; i++) A.fillRect(x * cell + 3, y * cell + (i * cell) / 6, cell - 6, 1);
      A.fillRect(x * cell + cell / 2 - 1, y * cell + 3, 2, cell - 6);
      Hh.fillStyle = 'rgb(60,60,60)'; Hh.fillRect(x * cell, y * cell, cell, 3); Hh.fillRect(x * cell, y * cell, 3, cell);
    }
  }
  return { map: texture(albedo.c, true), normalMap: texture(normalFromHeight(height.c, 1.6), false) };
}

/* ═══════════════ Géométrie ═══════════════ */

export type Profile = [number, number][]; // [rayon, hauteur], du bas vers le haut

/**
 * Coque de révolution autour de Y, à arêtes vives : chaque segment du profil a sa propre normale
 * (les nervures et chanfreins restent nets), lisse dans le sens de la rotation.
 * UV en mètres / 8 (une tuile de tôle = 8 m), v par longueur d'arc.
 */
export function lathe(profile: Profile, radial = 48, phi0 = 0, phiLen = Math.PI * 2, uvScale = 8, uScale = uvScale) {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const rRef = Math.max(...profile.map(([r]) => r));
  let arc = 0;
  for (let j = 0; j < profile.length - 1; j++) {
    const [r0, y0] = profile[j];
    const [r1, y1] = profile[j + 1];
    const dr = r1 - r0;
    const dy = y1 - y0;
    const len = Math.hypot(dr, dy);
    if (len < 1e-6) continue;
    const nr = dy / len;
    const ny = -dr / len;
    const base = pos.length / 3;
    for (let i = 0; i <= radial; i++) {
      const phi = phi0 + (i / radial) * phiLen;
      const sx = Math.sin(phi);
      const cz = Math.cos(phi);
      const u = (phi * rRef) / uScale;
      pos.push(r0 * sx, y0, r0 * cz, r1 * sx, y1, r1 * cz);
      nor.push(nr * sx, ny, nr * cz, nr * sx, ny, nr * cz);
      uv.push(u, arc / uvScale, u, (arc + len) / uvScale);
    }
    for (let i = 0; i < radial; i++) {
      const a = base + i * 2;
      const b = a + 2;
      const c = a + 1;
      const d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    arc += len;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Profil de module cylindrique : collerettes d'amarrage, cônes, nervures régulières. */
export function moduleProfile(radius: number, length: number, opts: { ribEvery?: number; collar?: number; endR?: number } = {}): Profile {
  const rib = opts.ribEvery ?? 4.2;
  const collar = opts.collar ?? radius * 0.42;
  const endR = opts.endR ?? radius * 0.66;
  const half = length / 2;
  const p: Profile = [];
  const end = Math.min(2.2, length * 0.12);
  // Collerette du bas
  p.push([0.01, -half - 1.2], [collar, -half - 1.2], [collar, -half - 0.4], [collar * 1.18, -half - 0.4], [collar * 1.18, -half], [endR, -half], [radius, -half + end]);
  // Corps nervuré
  const y0 = -half + end + 0.6;
  const y1 = half - end - 0.6;
  const n = Math.max(1, Math.round((y1 - y0) / rib));
  p.push([radius, y0]);
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n;
    if (i > 0) p.push([radius, y - 0.28]);
    p.push([radius + 0.14, y - 0.18], [radius + 0.14, y + 0.18]);
    if (i < n) p.push([radius, y + 0.28]);
  }
  p.push([radius, y1], [radius, half - end], [endR, half], [collar * 1.18, half], [collar * 1.18, half + 0.4], [collar, half + 0.4], [collar, half + 1.2], [0.01, half + 1.2]);
  return p;
}

/** UV par projection selon l'axe dominant de la normale (pour caissons et pièces fusionnées). */
export function boxUV(g: THREE.BufferGeometry, scale = 8) {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    let u: number;
    let v: number;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u / scale;
    uv[i * 2 + 1] = v / scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export const roundedBox = (w: number, h: number, d: number, r = 0.3, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2.01, h / 2.01, d / 2.01));

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpE = new THREE.Euler();

export const mat4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** Matrice qui oriente l'axe Y d'une pièce de a vers b (et l'étire à la bonne longueur si stretch). */
export function alongY(a: THREE.Vector3, b: THREE.Vector3, stretch = true, sx = 1) {
  const dir = tmpP.copy(b).sub(a);
  const len = dir.length();
  tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), tmpQ.clone(), new THREE.Vector3(sx, stretch ? len : 1, sx));
}

/** Pièces regroupées par matériau puis fusionnées en un seul maillage par matériau. */
export class Bucket {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geometry: THREE.BufferGeometry, material: THREE.Material, matrix?: THREE.Matrix4) {
    const g = geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    if (!g.getAttribute('uv')) boxUV(g);
    if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
    if (matrix) g.applyMatrix4(matrix);
    const list = this.parts.get(material) ?? [];
    list.push(g);
    this.parts.set(material, list);
    return this;
  }
  build(target: THREE.Object3D, shadows: boolean) {
    const out: THREE.Mesh[] = [];
    for (const [material, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      // Écrans, vitres, intérieurs, voyants : pas d'ombre projetée (carte d'ombre plus légère à recalculer)
      mesh.castShadow = shadows && !material.userData.noShadow;
      mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      target.add(mesh);
      out.push(mesh);
    }
    this.parts.clear();
    return out;
  }
}

/** Petites pièces répétées (poutres, rambardes, boîtiers) : une instance par pièce, un seul appel de rendu. */
export class Instances {
  private matrices: THREE.Matrix4[] = [];
  constructor(private geometry: THREE.BufferGeometry, private material: THREE.Material) {}
  push(m: THREE.Matrix4) { this.matrices.push(m); }
  /** Poutre de section carrée de a à b. */
  beam(a: THREE.Vector3, b: THREE.Vector3, t: number) {
    const dir = tmpP.copy(b).sub(a);
    const len = dir.length();
    if (len < 1e-4) return;
    tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
    this.matrices.push(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), tmpQ, tmpS.set(t, t, len)));
  }
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0) {
    tmpQ.setFromEuler(tmpE.set(rx, ry, rz));
    this.matrices.push(new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ, tmpS.set(sx, sy, sz)));
  }
  get count() { return this.matrices.length; }
  build(target: THREE.Object3D, shadows: boolean) {
    if (!this.matrices.length) return null;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.matrices.length);
    this.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    mesh.computeBoundingSphere();
    target.add(mesh);
    this.matrices = [];
    return mesh;
  }
}

/** Treillis de section carrée (poutre principale, mâts) : 4 longerons, cadres et diagonales en zigzag. */
export function truss(beams: Instances, a: THREE.Vector3, b: THREE.Vector3, width: number, bay: number, t = 0.32, up = new THREE.Vector3(0, 1, 0)) {
  const axis = b.clone().sub(a);
  const len = axis.length();
  axis.normalize();
  const side = new THREE.Vector3().crossVectors(axis, Math.abs(axis.dot(up)) > 0.95 ? new THREE.Vector3(1, 0, 0) : up).normalize();
  const top = new THREE.Vector3().crossVectors(side, axis).normalize();
  const h = width / 2;
  const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, u]) => side.clone().multiplyScalar(s * h).add(top.clone().multiplyScalar(u * h)));
  const n = Math.max(1, Math.round(len / bay));
  const at = (i: number, c: number) => a.clone().addScaledVector(axis, (len * i) / n).add(corners[c]);
  for (let c = 0; c < 4; c++) beams.beam(at(0, c), at(n, c), t * 1.5);
  for (let i = 0; i <= n; i++) for (let c = 0; c < 4; c++) beams.beam(at(i, c), at(i, (c + 1) % 4), t);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) {
      const flip = (i + c) % 2 === 0;
      beams.beam(at(i + (flip ? 0 : 1), c), at(i + (flip ? 1 : 0), (c + 1) % 4), t * 0.8);
    }
  }
}

/* ═══════════════ Matériaux ═══════════════ */

export interface StationUniforms { uTime: { value: number } }

/** Ajoute du code à la fin du calcul d'émission d'un matériau standard (voyants qui clignotent, activation des modules). */
export function patchEmissive(material: THREE.MeshStandardMaterial, key: string, uniforms: Record<string, { value: unknown }>, declarations: string, code: string) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${declarations}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${code}`);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/** Matériau métallique standard à partir d'un jeu de cartes. */
export const surface = (maps: SurfaceMaps, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    roughnessMap: maps.ormMap,
    metalnessMap: maps.ormMap,
    roughness: 1,
    metalness: 1,
    ...extra,
  });
