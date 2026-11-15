import * as THREE from 'three';
import {
  PALETTE, foilMaps, panelMaps, patchEmissive, pcbMaps, rackMaps, screenAtlas, solarMaps, surface, windowTexture,
  type Quality, type StationUniforms,
} from './kit';

/* Matériaux de la station (partagés par tous les modules).
   Les matériaux qui brillent existent en un exemplaire par module (`accents`) :
   leur intensité suit l'activation du module quand la caméra s'en approche. */

export interface ModuleAccents {
  strip: THREE.MeshStandardMaterial;   // filets lumineux orange
  window: THREE.MeshStandardMaterial;  // hublots éclairés
  screen: THREE.MeshStandardMaterial;  // écrans (atlas)
  active: { value: number };
}

export type Materials = Awaited<ReturnType<typeof createMaterials>>;

/** Textures dessinées une par une (await step() entre deux : la page reste fluide pendant la génération). */
export async function createMaterials(q: Quality, uniforms: StationUniforms, step: () => Promise<void>) {
  const size = q === 'high' ? 1024 : 512;
  const gen = async <T>(make: () => T) => { const out = make(); await step(); return out; };
  const hullMaps = await gen(() => panelMaps(11, size, { base: [58, 54, 50], spread: 0.09, light: 0.07, hazard: 0.025 }));
  const midMaps = await gen(() => panelMaps(23, size, { base: [84, 79, 73], spread: 0.08, light: 0.05, hazard: 0.02 }));
  const paintMaps = await gen(() => panelMaps(37, size / 2, { base: [190, 84, 26], spread: 0.08, light: 0, hazard: 0 }));
  const foil = await gen(() => foilMaps(5, size / 2));
  const rack = rackMaps(7);
  const pcb = await gen(() => pcbMaps(9));
  const solar = solarMaps(13);
  const windows = windowTexture(17, 16, 1, 0.74);
  const screens = await gen(() => screenAtlas(19));
  const textures = [hullMaps, midMaps, paintMaps, foil].flatMap((m) => [m.map, m.normalMap, m.ormMap])
    .concat([rack.map, rack.emissiveMap, pcb.map, pcb.emissiveMap, solar.map, solar.normalMap, windows, screens]);

  const normalScale = new THREE.Vector2(0.9, 0.9);
  const hull = surface(hullMaps, { normalScale, envMapIntensity: 0.9 });
  const mid = surface(midMaps, { normalScale, envMapIntensity: 0.85 });
  const paint = surface(paintMaps, { metalness: 0.25, normalScale, envMapIntensity: 0.6 });
  const foilMat = surface(foil, { normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 1.2 });

  const frame = new THREE.MeshStandardMaterial({ color: 0x3d3935, metalness: 0.78, roughness: 0.56, envMapIntensity: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1916, metalness: 0.7, roughness: 0.55 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0x8f877e, metalness: 1, roughness: 0.32 });
  const white = new THREE.MeshStandardMaterial({ color: 0x6b655f, metalness: 0.2, roughness: 0.6 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x1d1a17, metalness: 0.35, roughness: 0.75 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x24201c, metalness: 0.6, roughness: 0.6, map: hullMaps.map, normalMap: hullMaps.normalMap });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, metalness: 0.9, roughness: 0.16, transparent: true, opacity: 0.2, depthWrite: false, envMapIntensity: 1.2 });
  const glassDark = new THREE.MeshStandardMaterial({ color: 0x090807, metalness: 0.95, roughness: 0.16, envMapIntensity: 1.3 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd9b0, emissiveIntensity: 2.2 });
  const solarFront = new THREE.MeshStandardMaterial({ map: solar.map, normalMap: solar.normalMap, metalness: 0.55, roughness: 0.3, envMapIntensity: 1.2 });
  const solarBack = surface(foil, { color: 0xd08848, envMapIntensity: 1 });
  const dish = new THREE.MeshStandardMaterial({ color: 0x8c857d, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.6 });

  // Façades de baies serveurs : voyants qui clignotent chacun à leur rythme
  const rackMat = patchEmissive(
    new THREE.MeshStandardMaterial({ map: rack.map, emissiveMap: rack.emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.4, metalness: 0.6, roughness: 0.5 }),
    'station-rack', { uTime: uniforms.uTime },
    'uniform float uTime;\nfloat stHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    `{ vec2 cell = floor(vEmissiveMapUv * vec2(40.0, 160.0));
       float h = stHash(cell);
       float on = step(0.32, fract(h * 7.0 + uTime * (0.3 + h * 2.4)));
       totalEmissiveRadiance *= mix(0.15, 1.0, on); }`,
  );
  // Circuit imprimé : pistes qui pulsent lentement
  const pcbMat = patchEmissive(
    new THREE.MeshStandardMaterial({ map: pcb.map, emissiveMap: pcb.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.8, metalness: 0.5, roughness: 0.45 }),
    'station-pcb', { uTime: uniforms.uTime },
    'uniform float uTime;',
    `totalEmissiveRadiance *= 0.65 + 0.35 * sin(uTime * 1.4 + vEmissiveMapUv.x * 9.0 + vEmissiveMapUv.y * 5.0);`,
  );
  // Cœur du réacteur : lumière qui ondule le long du cylindre
  const core = patchEmissive(
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: PALETTE.orangeHot, emissiveIntensity: 3.2, roughness: 1, metalness: 0 }),
    'station-core', { uTime: uniforms.uTime },
    'uniform float uTime;',
    `totalEmissiveRadiance *= 0.75 + 0.25 * sin(uTime * 2.2) + 0.3 * pow(0.5 + 0.5 * sin(vNormal.y * 3.0 + uTime * 3.0), 6.0);`,
  );

  /** Matériaux lumineux propres à un module (leur intensité suit l'activation). */
  const accents = (): ModuleAccents => {
    const active = { value: 0 };
    const boost = 'uniform float uActive;';
    const strip = patchEmissive(
      new THREE.MeshStandardMaterial({ color: 0x0a0604, emissive: PALETTE.orange, emissiveIntensity: 1.7, metalness: 0.2, roughness: 0.6 }),
      'station-strip', { uActive: active }, boost, 'totalEmissiveRadiance *= 0.6 + 0.75 * uActive;',
    );
    const win = patchEmissive(
      new THREE.MeshStandardMaterial({ color: 0x090807, emissiveMap: windows, emissive: 0xffffff, emissiveIntensity: 1.9, metalness: 0.9, roughness: 0.12, envMapIntensity: 1.2 }),
      'station-window', { uActive: active }, boost, 'totalEmissiveRadiance *= 0.7 + 0.6 * uActive;',
    );
    const screen = patchEmissive(
      new THREE.MeshStandardMaterial({ color: 0x000000, emissiveMap: screens, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0 }),
      'station-screen', { uActive: active, uTime: uniforms.uTime }, 'uniform float uActive;\nuniform float uTime;',
      'totalEmissiveRadiance *= (0.5 + 0.9 * uActive) * (0.94 + 0.06 * sin(uTime * 40.0 + vEmissiveMapUv.y * 300.0));',
    );
    for (const m of [strip, win, screen]) m.userData.noShadow = true;
    list.push(strip, win, screen);
    return { strip, window: win, screen, active };
  };
  const list: THREE.Material[] = [];

  for (const m of [lamp, glass, glassDark, interior, floor, rackMat, pcbMat, core]) m.userData.noShadow = true;
  const all: THREE.Material[] = [hull, mid, paint, foilMat, frame, dark, chrome, white, interior, floor, glass, glassDark, lamp, solarFront, solarBack, dish, rackMat, pcbMat, core];
  return {
    hull, mid, paint, foil: foilMat, frame, dark, chrome, white, interior, floor, glass, glassDark, lamp,
    solarFront, solarBack, dish, rack: rackMat, pcb: pcbMat, core,
    windows, screens,
    accents,
    dispose() {
      all.concat(list).forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
