import * as THREE from 'three';
import { hashSeed, makeRng } from '../utils/rng';
import { ShipModel } from '../ship/ShipModel';

/** Objet isolé dans l'espace (épave, balise, structure…) : placé et animé par la boucle de jeu. */
export interface SpaceObject {
  group: THREE.Group;
  /** Distance au-delà de laquelle l'objet n'est plus dessiné. */
  drawDistance: number;
  update(dt: number, time: number): void;
  dispose(): void;
}

/** Petit utilitaire : suit ce qui doit être libéré et fabrique les meshes. */
class Kit {
  readonly group = new THREE.Group();
  private disposables: { dispose: () => void }[] = [];

  keep<T extends { dispose: () => void }>(item: T) { this.disposables.push(item); return item; }

  metal(color: number, roughness = 0.7, metalness = 0.8) {
    return this.keep(new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide }));
  }

  add(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.group) {
    this.keep(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /** Halo lumineux visible de loin (feu de balise, voyant d'épave). */
  light(color: number, size: number, x = 0, y = 0, z = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = this.keep(new THREE.CanvasTexture(canvas));
    const material = this.keep(new THREE.SpriteMaterial({
      map: texture, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(size);
    sprite.position.set(x, y, z);
    this.group.add(sprite);
    return material;
  }

  dispose() { this.disposables.forEach((d) => d.dispose()); }
}

const tumble = (group: THREE.Group, dt: number, x: number, y: number) => {
  group.rotation.x += dt * x;
  group.rotation.y += dt * y;
};

/** Balise de détresse : petite, mais son feu à éclats se voit de très loin. */
export const makeBeacon = (): SpaceObject => {
  const kit = new Kit();
  const body = kit.metal(0x8a8f98, 0.55);
  const dark = kit.metal(0x2b2f36);
  kit.add(new THREE.OctahedronGeometry(4, 0), body);
  kit.add(new THREE.CylinderGeometry(1.6, 1.6, 5, 8), dark);
  kit.add(new THREE.CylinderGeometry(0.08, 0.08, 16, 5), dark, 0, 9, 0);
  kit.add(new THREE.CylinderGeometry(0.08, 0.08, 9, 5), dark, 2.4, -6, 0).rotation.z = 0.5;
  kit.add(new THREE.BoxGeometry(11, 0.15, 3.5), kit.metal(0x12243a, 0.3, 0.6), 0, -1, 0);
  const lamp = kit.light(0xff9a3c, 110, 0, 17, 0);
  return {
    group: kit.group,
    drawDistance: 30000,
    update(dt, time) {
      tumble(kit.group, dt, 0.05, 0.08);
      // Deux éclats brefs, puis un long silence
      const t = time % 3.05;
      lamp.opacity = t < 0.09 || (t > 0.3 && t < 0.39) ? 1 : 0.04;
    },
    dispose: () => kit.dispose(),
  };
};

/** Épave : tronçons de coque arrachés, poutre tordue, nuage de tôles. Un voyant y clignote encore. */
export const makeWreck = (seed: string): SpaceObject => {
  const kit = new Kit();
  const rng = makeRng(hashSeed(seed));
  const hull = kit.metal(0x565b63, 0.75);
  const burnt = kit.metal(0x17181b, 0.9, 0.5);
  for (let i = 0; i < 4; i++) {
    const length = 14 + rng() * 16;
    const shell = kit.add(
      new THREE.CylinderGeometry(9, 9, length, 20, 1, true, rng() * 6, 2.6 + rng() * 2.6),
      i % 2 ? hull : burnt,
      (rng() - 0.5) * 26, (rng() - 0.5) * 14, -30 + i * 19,
    );
    shell.rotation.set(Math.PI / 2 + (rng() - 0.5) * 0.7, rng() * 6, (rng() - 0.5) * 0.7);
  }
  kit.add(new THREE.BoxGeometry(2, 2, 70), burnt).rotation.set(0.05, 0.12, 0);
  kit.add(new THREE.BoxGeometry(1.2, 1.2, 34), hull, 6, 3, 14).rotation.set(0.5, 0.4, 0.2);
  kit.add(new THREE.SphereGeometry(5.5, 14, 10, 0, 4.4), hull, -8, 5, 8).rotation.set(1, 0.5, 0);
  kit.add(new THREE.BoxGeometry(22, 0.2, 9), kit.metal(0x0d1a2a, 0.35, 0.6), 18, -6, -12).rotation.set(0.3, 0.2, 0.9);
  // Nuage de débris, un seul appel de dessin
  const plate = kit.keep(new THREE.BoxGeometry(1, 0.12, 1));
  const debris = new THREE.InstancedMesh(plate, hull, 70);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < 70; i++) {
    const r = 12 + Math.pow(rng(), 0.6) * 60;
    const a = rng() * Math.PI * 2, b = (rng() - 0.5) * 2;
    e.set(rng() * 6, rng() * 6, rng() * 6);
    m.compose(
      new THREE.Vector3(Math.cos(a) * r, b * r * 0.5, Math.sin(a) * r),
      q.setFromEuler(e),
      new THREE.Vector3(0.6 + rng() * 4, 1, 0.6 + rng() * 3),
    );
    debris.setMatrixAt(i, m);
  }
  kit.group.add(debris);
  const lamp = kit.light(0xff5a2a, 55, -3, 4, -6);
  return {
    group: kit.group,
    drawDistance: 26000,
    update(dt, time) {
      tumble(kit.group, dt, 0.021, 0.034);
      // Voyant de secours à bout de souffle : il hésite, s'éteint, repart
      const flicker = Math.sin(time * 1.3) * Math.sin(time * 7.1 + 1) * Math.sin(time * 0.37);
      lamp.opacity = flicker > 0.25 ? 0.9 : 0.02;
    },
    dispose: () => kit.dispose(),
  };
};

/** Capsule de survie, sas ouvert. */
export const makePod = (): SpaceObject => {
  const kit = new Kit();
  const shell = kit.metal(0xb9b4a8, 0.6, 0.5);
  const dark = kit.metal(0x08090b, 1, 0.2);
  kit.add(new THREE.CapsuleGeometry(2.6, 3.2, 6, 14), shell);
  kit.add(new THREE.CylinderGeometry(2.7, 2.7, 0.5, 14), kit.metal(0xc8742a, 0.6, 0.3), 0, -1.2, 0);
  kit.add(new THREE.CircleGeometry(1.25, 16), dark, 0, 0.6, 2.62);
  const hatch = kit.add(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 16), shell, 2.3, 0.6, 3.3);
  hatch.rotation.set(Math.PI / 2, 0, 1.1);
  return {
    group: kit.group,
    drawDistance: 12000,
    update(dt) { tumble(kit.group, dt, 0.03, 0.05); },
    dispose: () => kit.dispose(),
  };
};

/** Vieille sonde automatique, panneaux brûlés. */
export const makeProbe = (): SpaceObject => {
  const kit = new Kit();
  const body = kit.metal(0x9a8a62, 0.5, 0.9);
  const dark = kit.metal(0x202328);
  const cells = kit.metal(0x0b1420, 0.4, 0.6);
  kit.add(new THREE.BoxGeometry(5, 4, 6), body);
  kit.add(new THREE.BoxGeometry(13, 0.15, 4), cells, -9.2, 0, 0);
  kit.add(new THREE.BoxGeometry(9, 0.15, 4), cells, 7.2, 0.9, 0).rotation.z = 0.35;
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) { const r = (i / 8) * 3.4; profile.push(new THREE.Vector2(r, (r * r) / 7)); }
  kit.add(new THREE.LatheGeometry(profile, 20), kit.metal(0xb9bdc4, 0.5, 0.6), 0, 2.2, 0);
  kit.add(new THREE.CylinderGeometry(0.1, 0.1, 9, 5), dark, 0, -6, 0);
  kit.add(new THREE.CylinderGeometry(0.7, 0.9, 1.6, 10), dark, 0, 0, 3.6).rotation.x = Math.PI / 2;
  return {
    group: kit.group,
    drawDistance: 12000,
    update(dt) { kit.group.rotation.y += dt * 0.012; },
    dispose: () => kit.dispose(),
  };
};

/** Jumeau mort d'AETHER-01 : le même modèle, sans lumière, à la dérive. */
export const makeTwin = (): SpaceObject => {
  const model = new ShipModel(true);
  const group = new THREE.Group();
  group.add(model.group);
  group.rotation.set(0.7, 2.1, 0.4);
  return {
    group,
    drawDistance: 26000,
    update(dt) { tumble(group, dt, 0.006, 0.011); },
    dispose: () => model.dispose(),
  };
};

/**
 * Le Témoin : un anneau noir de 18 000 km qui ne renvoie presque aucune lumière.
 * On le devine d'abord parce qu'il cache les étoiles. Son axe vise le trou noir.
 */
export const makeMegastructure = (radius: number, axis: THREE.Vector3): SpaceObject => {
  const kit = new Kit();
  const dark = kit.keep(new THREE.MeshStandardMaterial({ color: 0x030304, metalness: 1, roughness: 0.2, envMapIntensity: 0.6 }));
  kit.add(new THREE.TorusGeometry(radius, radius * 0.04, 4, 160), dark);
  const inner = kit.add(new THREE.TorusGeometry(radius * 0.6, radius * 0.016, 4, 120), dark);
  const core = kit.add(new THREE.TorusGeometry(radius * 0.3, radius * 0.01, 4, 90), dark);
  kit.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis.clone().normalize());
  return {
    group: kit.group,
    drawDistance: 120000,
    update(_dt, time) {
      // Mouvement presque imperceptible : on doute de l'avoir vu bouger
      inner.rotation.x = time * 0.004;
      core.rotation.y = time * 0.007;
    },
    dispose: () => kit.dispose(),
  };
};

/** Point de lumière sans source : le « contact » qui suit le vaisseau. */
export const makeGhost = (): SpaceObject => {
  const kit = new Kit();
  const lamp = kit.light(0xbfd4ee, 70);
  return {
    group: kit.group,
    drawDistance: 40000,
    update(_dt, time) { lamp.opacity = 0.35 + 0.25 * Math.sin(time * 2.3); },
    dispose: () => kit.dispose(),
  };
};
