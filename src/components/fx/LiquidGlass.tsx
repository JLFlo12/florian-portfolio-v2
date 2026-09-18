import { useEffect } from 'react';
import { hasFinePointer } from '@/lib/motion';

/* ───────────────────────────────────────────────────────────────
   Verre liquide
   Tout élément .liquid (ou [data-liquid]) devient une lentille :
   - sur Chrome / Edge : le contenu derrière est vraiment réfracté sur les
     bords (filtre SVG feDisplacementMap dans backdrop-filter), avec une
     légère aberration chromatique (rouge, vert et bleu décalés) ;
   - ailleurs (Safari, Firefox) : verre transparent en CSS seul (voir index.css).
   Chaque élément a son propre filtre, recalculé quand sa taille change.
   Le reflet (::after) suit la souris sur ordinateur.
   ─────────────────────────────────────────────────────────────── */

const SELECTOR = '.liquid, [data-liquid]';
const SVG_NS = 'http://www.w3.org/2000/svg';

// backdrop-filter: url(#filtre) n'est rendu que par les navigateurs Chromium
const isChromium = () => {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => /Chromium/.test(b.brand));
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/* Carte de déplacement : gris neutre au centre (aucun décalage),
   dégradés rouge (axe X) et bleu (axe Y) sur une bande le long des bords. */
const displacementMap = (w: number, h: number, r: number, edge: number) => {
  const inner = Math.max(r - edge, 0);
  const svg = `<svg xmlns="${SVG_NS}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + '<defs>'
    + '<linearGradient id="x"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>'
    + '<linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>'
    + `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(edge / 2.4).toFixed(1)}"/></filter>`
    + '</defs>'
    + `<rect width="${w}" height="${h}" fill="#000"/>`
    + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>`
    + `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:screen"/>`
    + `<rect x="${edge}" y="${edge}" width="${Math.max(w - edge * 2, 0)}" height="${Math.max(h - edge * 2, 0)}" rx="${inner}" fill="#808080" filter="url(#b)"/>`
    + '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

interface Lens { id: string; filter: SVGFilterElement; image: SVGFEImageElement; maps: SVGFEDisplacementMapElement[]; key: string }

// Un canal (rouge, vert ou bleu) déplacé séparément : c'est ce qui crée les franges colorées
const CHANNELS = [
  { matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', factor: 1 },
  { matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', factor: 0.93 },
  { matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', factor: 0.86 },
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
        const edge = clamp(Math.min(w, h) * 0.24, 6, 22); // largeur de la bande qui réfracte
        const scale = -edge * 2.4;                        // force de la déviation
        const href = displacementMap(w, h, r, edge);
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
