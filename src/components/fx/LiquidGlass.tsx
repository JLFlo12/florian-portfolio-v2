import { useEffect } from 'react';
import { hasFinePointer } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Verre liquide
   Tout élément .liquid (ou [data-liquid]) devient une lentille :
   - sur Chrome / Edge : le contenu derrière est vraiment réfracté, en direct
     (filtre SVG feDisplacementMap dans backdrop-filter) : forte courbure sur
     la tranche, léger effet loupe au centre, aberration chromatique ;
   - ailleurs (Safari, Firefox) : verre transparent en CSS seul (voir index.css).
   Chaque élément a sa propre carte de déplacement, recalculée quand sa taille change.
   Le reflet (::after) suit la souris sur ordinateur ; le liseré brillant est en CSS (::before).
   Profil de réfraction inspiré du shader de liquid-glass-js (dashersw, licence MIT),
   mais appliqué au fond réel : cette bibliothèque réfracte une capture figée de la page.
   ─────────────────────────────────────────────────────────────── */

const SELECTOR = '.liquid, [data-liquid]';
const SVG_NS = 'http://www.w3.org/2000/svg';

// backdrop-filter: url(#filtre) n'est rendu que par les navigateurs Chromium
const isChromium = () => {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => /Chromium/.test(b.brand));
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* Carte de déplacement d'une lentille convexe, calculée pixel par pixel.
   Pour chaque point : distance au bord arrondi et direction vers l'intérieur.
   - Sur une bande le long du bord, le fond est pris plus à l'intérieur, de plus en plus
     fort vers la tranche (courbe du verre) : le contenu s'y tord et s'y comprime.
   - Partout, un léger rapprochement vers le centre : effet loupe.
   Rouge = décalage horizontal, bleu = vertical, 128 = aucun décalage. */
const displacementMap = (w: number, h: number, r: number) => {
  const band = clamp(Math.min(w, h) * 0.34, 8, 28); // largeur de la tranche courbe (px)
  const edgeShift = band * 0.85;                    // décalage maximal sur le bord (px)
  const zoom = Math.min(w, h) >= 36 ? 0.045 : 0;    // grossissement au centre
  const scale = Math.ceil((edgeShift + zoom * Math.max(w, h) / 2) * 2 + 2);
  const hx = w / 2, hy = h / 2;

  const raw = document.createElement('canvas');
  raw.width = w; raw.height = h;
  const image = raw.getContext('2d')!.createImageData(w, h);
  const data = image.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - hx, py = y + 0.5 - hy;
      const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
      const depth = r - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);
      let vx = 0, vy = 0;
      if (depth > 0) {
        let nx: number, ny: number; // direction vers l'intérieur
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); nx = (-Math.sign(px) * qx) / l; ny = (-Math.sign(py) * qy) / l; }
        else if (qx > qy) { nx = -Math.sign(px); ny = 0; }
        else { nx = 0; ny = -Math.sign(py); }
        const t = Math.max(0, 1 - depth / band);
        const bend = edgeShift * Math.pow(t, 2.4); // courbure concentrée sur la tranche
        vx = nx * bend - px * zoom;
        vy = ny * bend - py * zoom;
      }
      const i = (y * w + x) * 4;
      data[i] = 127.5 + (vx / scale) * 255;
      data[i + 1] = 128;
      data[i + 2] = 127.5 + (vy / scale) * 255;
      data[i + 3] = 255;
    }
  }
  raw.getContext('2d')!.putImageData(image, 0, 0);

  // Léger adoucissement : pas d'arête visible là où deux bords se rejoignent
  const map = document.createElement('canvas');
  map.width = w; map.height = h;
  const ctx = map.getContext('2d')!;
  ctx.fillStyle = 'rgb(128,128,128)';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = 'blur(1px)';
  ctx.drawImage(raw, 0, 0);
  return { href: map.toDataURL(), scale };
};

interface Lens { id: string; filter: SVGFilterElement; image: SVGFEImageElement; maps: SVGFEDisplacementMapElement[]; key: string }

// Un canal (rouge, vert ou bleu) déplacé séparément : c'est ce qui crée les franges colorées
const CHANNELS = [
  { matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', factor: 1 },
  { matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', factor: 0.95 },
  { matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', factor: 0.9 },
];

const createLens = (defs: SVGDefsElement, id: string): Lens => {
  const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>) => {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  };
  const filter = el('filter', { id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
  const image = el('feImage', { x: '0', y: '0', preserveAspectRatio: 'none', result: 'map' });
  filter.appendChild(image);
  const maps = CHANNELS.map(({ matrix }, i) => {
    const map = el('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', xChannelSelector: 'R', yChannelSelector: 'B', result: `d${i}` });
    filter.appendChild(map);
    filter.appendChild(el('feColorMatrix', { in: `d${i}`, type: 'matrix', values: matrix, result: `c${i}` }));
    return map;
  });
  filter.appendChild(el('feBlend', { in: 'c0', in2: 'c1', mode: 'screen', result: 'c01' }));
  filter.appendChild(el('feBlend', { in: 'c01', in2: 'c2', mode: 'screen' }));
  defs.appendChild(filter);
  return { id, filter, image, maps, key: '' };
};

const LiquidGlass = () => {
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    /* Reflet qui suit la souris (tous navigateurs) */
    if (hasFinePointer()) {
      let raf = 0, px = -999, py = -999;
      const apply = () => {
        raf = 0;
        document.querySelectorAll<HTMLElement>('.liquid').forEach((node) => {
          const r = node.getBoundingClientRect();
          if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
          node.style.setProperty('--lx', `${clamp(((px - r.left) / r.width) * 100, -30, 130).toFixed(1)}%`);
          node.style.setProperty('--ly', `${clamp(((py - r.top) / r.height) * 100, -80, 180).toFixed(1)}%`);
        });
      };
      const onMove = (e: PointerEvent) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(apply); };
      window.addEventListener('pointermove', onMove, { passive: true });
      cleanups.push(() => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); });
    }

    /* Réfraction (Chromium) */
    if (isChromium()) {
      const root = document.documentElement;
      root.classList.add('has-liquid');
      const host = document.createElementNS(SVG_NS, 'svg');
      host.setAttribute('aria-hidden', 'true');
      host.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none');
      const defs = document.createElementNS(SVG_NS, 'defs');
      host.appendChild(defs);
      document.body.appendChild(host);

      const lenses = new Map<HTMLElement, Lens>();
      let count = 0;

      const update = (node: HTMLElement) => {
        const lens = lenses.get(node);
        const w = node.offsetWidth, h = node.offsetHeight;
        if (!lens || !w || !h) return;
        const r = Math.min(parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0, w / 2, h / 2);
        const key = `${w}x${h}r${r}`;
        if (key === lens.key) return;
        lens.key = key;
        const { href, scale } = displacementMap(w, h, r);
        // La carte est décodée avant d'être branchée : pas d'image vide = pas de saut du fond
        const img = new Image();
        img.src = href;
        img.decode().catch(() => {}).then(() => {
          if (lens.key !== key) return;
          [lens.filter, lens.image].forEach((n) => { n.setAttribute('width', String(w)); n.setAttribute('height', String(h)); });
          lens.filter.setAttribute('x', '0'); lens.filter.setAttribute('y', '0');
          lens.image.setAttribute('href', href);
          lens.maps.forEach((map, i) => map.setAttribute('scale', (scale * CHANNELS[i].factor).toFixed(1)));
          node.style.setProperty('--lg-filter', `url(#${lens.id})`);
        });
      };

      const ro = new ResizeObserver((entries) => entries.forEach((e) => update(e.target as HTMLElement)));

      const scan = () => {
        document.querySelectorAll<HTMLElement>(SELECTOR).forEach((node) => {
          if (lenses.has(node)) return;
          lenses.set(node, createLens(defs, `lg-${count++}`));
          ro.observe(node);
          update(node);
        });
        lenses.forEach((lens, node) => {
          if (node.isConnected) return;
          ro.unobserve(node);
          lens.filter.remove();
          lenses.delete(node);
        });
      };
      scan();

      // Nouvelles pages, menus ouverts… (on ignore les simples changements de texte)
      let pending = 0;
      const mo = new MutationObserver((records) => {
        const structural = records.some((rec) => [...rec.addedNodes, ...rec.removedNodes].some((n) => n.nodeType === 1));
        if (structural && !pending) pending = requestAnimationFrame(() => { pending = 0; scan(); });
      });
      mo.observe(document.body, { childList: true, subtree: true });

      cleanups.push(() => {
        mo.disconnect(); ro.disconnect(); cancelAnimationFrame(pending);
        lenses.forEach((_, node) => node.style.removeProperty('--lg-filter'));
        host.remove(); root.classList.remove('has-liquid');
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
};

export default LiquidGlass;
