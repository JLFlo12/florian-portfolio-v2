import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hashSeed, makeRng } from '../utils/rng';

const ORANGE = 0xe58a32;
const ORANGE_BRIGHT = 0xffb45b;

/** Texture de tôles : panneaux de teintes légèrement différentes et joints sombres. */
const makePanelTexture = (seed: string, base: [number, number, number]) => {
  const rng = makeRng(hashSeed(seed));
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const tone = (k: number) => `rgb(${base.map((c) => Math.round(Math.min(255, c * k))).join(',')})`;
  ctx.fillStyle = tone(1);
  ctx.fillRect(0, 0, size, size);
  const cell = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (rng() < 0.25) continue;
      const w = rng() < 0.3 ? 2 : 1;
      const h = rng() < 0.3 ? 2 : 1;
      ctx.fillStyle = tone(0.82 + rng() * 0.3);
      ctx.fillRect(x * cell, y * cell, w * cell, h * cell);
      ctx.strokeStyle = 'rgba(8,10,14,.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cell + 1, y * cell + 1, w * cell - 2, h * cell - 2);
      if (rng() < 0.35) {
        // Trappe ou grille technique
        ctx.fillStyle = 'rgba(10,12,16,.55)';
        ctx.fillRect(x * cell + cell * 0.2, y * cell + cell * 0.25, cell * (0.2 + rng() * 0.4), cell * (0.12 + rng() * 0.2));
      }
    }
  }
  // Usure : fines rayures claires
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 90; i++) {
    const x = rng() * size, y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rng() - 0.5) * 60, y + (rng() - 0.5) * 8);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const plumeVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const plumeFragment = /* glsl */ `
uniform float uPower;
uniform float uTime;
uniform float uPhase;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  float along = clamp(1.0 - vUv.y, 0.0, 1.0); // 1 à la tuyère, 0 à la pointe
  float flicker = 0.88 + 0.12 * sin(uTime * 38.0 + uPhase + vUv.y * 22.0) * sin(uTime * 17.0 + uPhase * 2.0);
  // Plus dense vu de face que sur la tranche : donne du volume au cône
  float facing = pow(abs(dot(normalize(vNormalV), vViewDir)), 1.4);
  float body = pow(along, 1.8) * (0.35 + 0.65 * facing);
  vec3 col = mix(vec3(0.9, 0.36, 0.08), vec3(1.0, 0.86, 0.66), pow(along, 3.0));
  gl_FragColor = vec4(col * body * flicker * uPower * 1.5, 1.0);
}`;

/**
 * AETHER-01 : vaisseau scientifique, modèle original construit par code (aucun asset externe).
 * L'avant pointe vers -Z. Longueur totale ≈ 81 unités.
 */
export class ShipModel {
  readonly group = new THREE.Group();
  /** Partie qui s'incline visuellement dans les virages, sans toucher à la physique. */
  private model = new THREE.Group();
  private habitat = new THREE.Group();
  private dish = new THREE.Group();
  private plumes: { mesh: THREE.Mesh; material: THREE.ShaderMaterial; main: boolean }[] = [];
  private glow: THREE.MeshStandardMaterial;
  private engineLight: THREE.PointLight;
  private beacons: THREE.MeshStandardMaterial;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private bank = 0;
  private pitchLean = 0;
  private power = 0;

  /** @param dead épave : plus aucune lumière, moteurs éteints, coque ternie */
  constructor(private dead = false) {
    this.group.add(this.model);
    const hullMap = makePanelTexture('hull', [176, 181, 190]);
    const darkMap = makePanelTexture('dark', [66, 71, 82]);
    const cellMap = makePanelTexture('cells', [40, 62, 96]);
    hullMap.repeat.set(3, 3);
    darkMap.repeat.set(2, 2);
    cellMap.repeat.set(3, 2);
    this.textures.push(hullMap, darkMap, cellMap);

    const mat = <T extends THREE.Material>(m: T) => { this.materials.push(m); return m; };
    const hull = mat(new THREE.MeshStandardMaterial({ map: hullMap, roughnessMap: hullMap, metalness: 0.82, roughness: 0.6 }));
    const dark = mat(new THREE.MeshStandardMaterial({ map: darkMap, roughnessMap: darkMap, metalness: 0.9, roughness: 0.75 }));
    const foil = mat(new THREE.MeshStandardMaterial({ color: 0xa8824a, metalness: 1, roughness: 0.38 }));
    const paint = mat(new THREE.MeshStandardMaterial({ color: ORANGE, metalness: 0.35, roughness: 0.5 }));
    const cells = mat(new THREE.MeshStandardMaterial({ map: cellMap, metalness: 0.7, roughness: 0.3 }));
    const windows = mat(new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xffd9a0, emissiveIntensity: 2.4 }));
    const strip = mat(new THREE.MeshStandardMaterial({ color: 0x1a0f05, emissive: ORANGE, emissiveIntensity: 3 }));
    this.beacons = mat(new THREE.MeshStandardMaterial({ color: 0x1a0f05, emissive: ORANGE_BRIGHT, emissiveIntensity: 4 }));
    this.glow = mat(new THREE.MeshStandardMaterial({ color: 0x120a04, emissive: ORANGE_BRIGHT, emissiveIntensity: 0.4 }));
    const bell = mat(new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.95, roughness: 0.4, side: THREE.DoubleSide }));

    const geo = <T extends THREE.BufferGeometry>(g: T) => { this.geometries.push(g); return g; };
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = this.model) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    /** Cylindre couché le long de l'axe Z. */
    const tube = (r1: number, r2: number, length: number, sides = 24) =>
      geo(new THREE.CylinderGeometry(r1, r2, length, sides).rotateX(Math.PI / 2));

    // ── Poutre centrale et cadres de structure ──
    add(tube(1.5, 1.5, 50, 8), hull);
    const frame = geo(new THREE.TorusGeometry(2.0, 0.2, 6, 8));
    const frames = new THREE.InstancedMesh(frame, dark, 12);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) frames.setMatrixAt(i, m4.makeTranslation(0, 0, -22 + i * 4));
    frames.castShadow = frames.receiveShadow = true;
    this.model.add(frames);
    // Longerons extérieurs
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      add(tube(0.14, 0.14, 46, 6), dark, Math.cos(a) * 2.0, Math.sin(a) * 2.0, 0);
    }

    // ── Module de commandement (avant) ──
    const noseProfile = [[0, 0], [1.2, 0.5], [2.3, 2.0], [3.0, 4.2], [3.3, 7.2], [3.3, 11], [2.7, 12.4], [1.6, 13]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    add(geo(new THREE.LatheGeometry(noseProfile, 32).rotateX(Math.PI / 2)), hull, 0, 0, -38);
    add(tube(3.34, 3.34, 0.32, 32), windows, 0, 0, -31.6);
    add(tube(3.34, 3.34, 0.2, 32), windows, 0, 0, -30.4);
    add(tube(3.35, 3.35, 0.9, 32), paint, 0, 0, -28.2);
    add(geo(new THREE.BoxGeometry(2.2, 0.9, 3.2)), dark, 0, 3.2, -30.5);
    add(geo(new THREE.BoxGeometry(1.7, 0.25, 0.1)), windows, 0, 3.3, -32.12);

    // Perche de capteurs
    add(tube(0.13, 0.2, 9, 8), dark, 0, 0, -42.5);
    add(geo(new THREE.IcosahedronGeometry(0.5, 1)), foil, 0, 0, -47);
    for (let i = 0; i < 3; i++) {
      const whisker = add(geo(new THREE.CylinderGeometry(0.035, 0.035, 3.4, 5)), dark, 0, 0, -44.5 + i * 1.3);
      whisker.rotation.z = (i * Math.PI) / 3;
    }

    // ── Anneau d'habitation en rotation (gravité artificielle) ──
    this.habitat.position.z = -13;
    this.model.add(this.habitat);
    add(geo(new THREE.TorusGeometry(9.5, 1.25, 14, 56)), hull, 0, 0, 0, this.habitat);
    add(geo(new THREE.TorusGeometry(9.5, 1.3, 6, 56).scale(1, 1, 0.22)), paint, 0, 0, 0, this.habitat);
    const spoke = geo(new THREE.CylinderGeometry(0.42, 0.42, 17, 8));
    add(spoke, dark, 0, 0, 0, this.habitat);
    add(spoke, dark, 0, 0, 0, this.habitat).rotation.z = Math.PI / 2;
    const pane = geo(new THREE.BoxGeometry(0.7, 0.16, 0.3));
    const panes = new THREE.InstancedMesh(pane, windows, 40);
    const q = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const side = i % 2 ? 0.55 : -0.55;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * 10.63, Math.sin(a) * 10.63, side),
        q.setFromAxisAngle(zAxis, a + Math.PI / 2),
        new THREE.Vector3(1, 1, 1),
      );
      panes.setMatrixAt(i, m4);
    }
    this.habitat.add(panes);
    add(tube(2.4, 2.4, 3.4, 16), dark, 0, 0, -13);

    // ── Laboratoires ──
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const x = Math.cos(a) * 3.5, y = Math.sin(a) * 3.5;
      add(tube(1.65, 1.65, 8, 16), i % 2 ? foil : hull, x, y, 1);
      add(tube(1.2, 1.65, 0.9, 16), dark, x, y, -3.45);
      add(tube(1.65, 1.2, 0.9, 16), dark, x, y, 5.45);
      add(tube(1.68, 1.68, 0.14, 16), strip, x, y, -1.2);
    }

    // ── Antenne principale ──
    this.dish.position.set(0, 2, -20.5);
    this.model.add(this.dish);
    add(geo(new THREE.CylinderGeometry(0.2, 0.28, 5, 8)), dark, 0, 2.5, 0, this.dish);
    const dishProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const r = (i / 12) * 3.8; dishProfile.push(new THREE.Vector2(r, (r * r) / 8)); }
    const bowlMaterial = mat(new THREE.MeshStandardMaterial({ color: 0xc9cdd3, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide }));
    const bowl = new THREE.Group();
    bowl.position.y = 5.2;
    bowl.rotation.set(-0.55, 0, 0.25);
    this.dish.add(bowl);
    add(geo(new THREE.LatheGeometry(dishProfile, 32)), bowlMaterial, 0, 0, 0, bowl);
    add(geo(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6)), dark, 0, 1.3, 0, bowl);
    add(geo(new THREE.SphereGeometry(0.28, 10, 8)), foil, 0, 2.6, 0, bowl);
    // Antenne secondaire, sous la coque
    const small = new THREE.Group();
    small.position.set(0, -3.6, 9);
    small.rotation.set(Math.PI - 0.4, 0, 0);
    this.model.add(small);
    add(geo(new THREE.LatheGeometry(dishProfile.slice(0, 7), 24)), bowlMaterial, 0, 0, 0, small);
    add(geo(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6)), dark, 0, -2.5, 9);

    // ── Radiateurs et panneaux ──
    const panel = geo(new THREE.BoxGeometry(15, 0.16, 11));
    const edge = geo(new THREE.BoxGeometry(0.18, 0.2, 11));
    const boom = geo(new THREE.CylinderGeometry(0.22, 0.22, 17.5, 6).rotateZ(Math.PI / 2));
    for (const side of [-1, 1]) {
      add(panel, cells, side * 11.2, 0, 13.5);
      add(edge, strip, side * 18.75, 0, 13.5);
      add(boom, dark, side * 10, 0.3, 13.5);
      add(geo(new THREE.BoxGeometry(15, 0.1, 0.3)), dark, side * 11.2, 0.14, 13.5);
      // Ailettes verticales de refroidissement
      const fin = add(geo(new THREE.BoxGeometry(0.14, 6.5, 7)), cells, side * 4.2, 0, 20.5);
      fin.rotation.z = side * 0.5;
    }

    // ── Réservoirs ──
    const tank = geo(new THREE.CapsuleGeometry(1.5, 4.4, 6, 14).rotateX(Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      add(tank, i % 3 === 0 ? foil : hull, Math.cos(a) * 3.3, Math.sin(a) * 3.3, 10.5);
    }
    add(tube(4.9, 4.9, 0.3, 24), dark, 0, 0, 7.4);
    add(tube(4.9, 4.9, 0.3, 24), dark, 0, 0, 13.6);

    // ── Bloc propulsion ──
    add(tube(3.4, 4.8, 3, 12), dark, 0, 0, 24.5);
    add(tube(4.8, 5.1, 4.5, 12), hull, 0, 0, 28.2);
    add(tube(5.14, 5.14, 0.5, 12), paint, 0, 0, 27);
    add(geo(new THREE.BoxGeometry(12.6, 1.5, 3.2)), dark, 0, 0, 28.4);
    const bellProfile = [[0.95, 0], [1.15, 0.7], [1.65, 2.1], [2.1, 3.7], [2.35, 5.2]].map(([r, y]) => new THREE.Vector2(r, y));
    const bellGeometry = geo(new THREE.LatheGeometry(bellProfile, 28).rotateX(Math.PI / 2));
    const smallBell = geo(new THREE.LatheGeometry(bellProfile, 20).rotateX(Math.PI / 2).scale(0.5, 0.5, 0.55));
    const throat = geo(new THREE.CircleGeometry(1.15, 24));
    const plumeGeometry = geo(new THREE.CylinderGeometry(0.12, 1, 1, 24, 12, true).translate(0, 0.5, 0).rotateX(Math.PI / 2));

    const engine = (x: number, y: number, z: number, main: boolean) => {
      const s = main ? 1 : 0.5;
      add(main ? bellGeometry : smallBell, bell, x, y, z);
      add(tube(1.2 * s, 1.5 * s, 1.4 * s, 16), dark, x, y, z - 0.5 * s);
      const disc = add(throat, this.glow, x, y, z + 0.9 * s);
      disc.scale.setScalar(s);
      disc.castShadow = false;
      const material = mat(new THREE.ShaderMaterial({
        uniforms: { uPower: { value: 0 }, uTime: { value: 0 }, uPhase: { value: x * 1.7 + y * 3.1 } },
        vertexShader: plumeVertex,
        fragmentShader: plumeFragment,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })) as THREE.ShaderMaterial;
      const plume = new THREE.Mesh(plumeGeometry, material);
      plume.position.set(x, y, z + 3.4 * s);
      plume.scale.set(2.0 * s, 2.0 * s, 1);
      this.model.add(plume);
      this.plumes.push({ mesh: plume, material, main });
    };
    for (const x of [-2.5, 2.5]) for (const y of [-2.5, 2.5]) engine(x, y, 30.4, true);
    engine(-6.0, 0, 30, false);
    engine(6.0, 0, 30, false);

    // ── Détails mécaniques (un seul appel de dessin par matériau) ──
    const rng = makeRng(hashSeed('aether-01'));
    const box = geo(new THREE.BoxGeometry(1, 1, 1));
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    for (const material of [dark, hull]) {
      const greebles = new THREE.InstancedMesh(box, material, 80);
      for (let i = 0; i < 80; i++) {
        const a = Math.floor(rng() * 8) * (Math.PI / 4) + Math.PI / 8;
        const radial = 1.45 + rng() * 0.25;
        position.set(Math.cos(a) * radial, Math.sin(a) * radial, -23 + rng() * 45);
        scale.set(0.35 + rng() * 0.5, 0.3 + rng() * 0.9, 0.5 + rng() * 2.2);
        m4.compose(position, q.setFromAxisAngle(zAxis, a - Math.PI / 2), scale);
        greebles.setMatrixAt(i, m4);
      }
      greebles.castShadow = greebles.receiveShadow = true;
      this.model.add(greebles);
    }
    // Propulseurs d'attitude
    const rcs = geo(new THREE.BoxGeometry(0.8, 0.8, 1.1));
    for (const z of [-24.5, 22.5]) for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      add(rcs, dark, Math.cos(a) * 2.4, Math.sin(a) * 2.4, z);
    }

    // ── Feux de position ──
    const lamp = geo(new THREE.SphereGeometry(0.22, 8, 6));
    for (const [x, y, z] of [[-18.8, 0.3, 8.2], [18.8, 0.3, 8.2], [0, 3.9, -30.5], [0, -5.3, 28.4], [0, 5.3, 28.4]]) {
      add(lamp, this.beacons, x, y, z).castShadow = false;
    }

    this.engineLight = new THREE.PointLight(ORANGE_BRIGHT, 0, 90, 2);
    this.engineLight.position.set(0, 0, 37);
    // L'épave n'a pas de lumière : en ajouter une changerait le nombre de lumières de la scène
    // à chaque fois qu'elle entre ou sort du champ, et forcerait à recompiler tous les matériaux.
    if (!dead) this.model.add(this.engineLight);

    // Les ~150 pièces sont regroupées par matériau : même rendu, mais une dizaine d'appels
    // de dessin au lieu de 150, et autant d'économisés dans le rendu des ombres.
    this.mergeStatic(this.model);
    const used = new Set<THREE.BufferGeometry>();
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) used.add(o.geometry); });
    this.geometries.forEach((g) => { if (!used.has(g)) g.dispose(); });
    this.geometries = [...used];

    if (dead) {
      for (const material of this.materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.emissiveIntensity = 0;
          material.color.multiplyScalar(0.55);
          material.roughness = Math.min(1, material.roughness + 0.25);
        }
      }
      this.plumes.forEach((plume) => { plume.mesh.visible = false; });
      this.model.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    }
  }

  /**
   * Fusionne les meshes fixes d'un groupe qui partagent un matériau. Les sous-groupes animés
   * (anneau, antenne) sont traités séparément ; panaches et instances ne sont pas touchés.
   */
  private mergeStatic(group: THREE.Object3D) {
    const buckets = new Map<string, { material: THREE.Material; shadow: boolean; meshes: THREE.Mesh[] }>();
    for (const child of [...group.children]) {
      if (child instanceof THREE.InstancedMesh || child instanceof THREE.Light) continue;
      if (child instanceof THREE.Mesh && !(child.material instanceof THREE.ShaderMaterial) && !Array.isArray(child.material)) {
        const key = `${child.material.uuid}:${child.castShadow}`;
        const bucket = buckets.get(key) ?? { material: child.material, shadow: child.castShadow, meshes: [] };
        bucket.meshes.push(child);
        buckets.set(key, bucket);
      } else if (!(child instanceof THREE.Mesh)) {
        this.mergeStatic(child);
      }
    }
    for (const { material, shadow, meshes } of buckets.values()) {
      if (meshes.length < 2) continue;
      // Les polyèdres n'ont pas d'index : si le groupe en contient, tout passe en non indexé
      const mixed = meshes.some((mesh) => !mesh.geometry.index);
      const parts = meshes.map((mesh) => {
        mesh.updateMatrix();
        const g = mixed && mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        return g.applyMatrix4(mesh.matrix);
      });
      const merged = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (!merged) continue;
      meshes.forEach((mesh) => group.remove(mesh));
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      this.geometries.push(merged);
    }
  }

  /**
   * @param power poussée affichée, de 0 (arrêt) à 1 (pleine poussée), jusqu'à 1.5 en surrégime
   * @param turn vitesse de lacet, pour l'inclinaison dans les virages
   * @param pitch vitesse de tangage
   * @param surge accélération longitudinale normalisée (-1 à 1)
   */
  update(dt: number, time: number, power: number, turn: number, pitch: number, surge: number) {
    if (this.dead) return;
    const ease = 1 - Math.exp(-dt * 4);
    this.power += (power - this.power) * (1 - Math.exp(-dt * 3));
    this.bank += (-turn * 0.42 - this.bank) * ease;
    this.pitchLean += (pitch * 0.12 + surge * 0.035 - this.pitchLean) * ease;
    this.model.rotation.set(this.pitchLean, 0, this.bank);
    this.habitat.rotation.z = time * 0.22;
    this.dish.rotation.y = Math.sin(time * 0.1) * 0.5;

    const p = this.power;
    for (const plume of this.plumes) {
      const level = plume.main ? p : Math.min(1, 0.25 + p * 0.5) * Math.min(1, p * 6);
      plume.material.uniforms.uPower.value = level;
      plume.material.uniforms.uTime.value = time;
      plume.mesh.scale.z = (plume.main ? 5 + 26 * level : 3 + 9 * level);
      plume.mesh.visible = level > 0.01;
    }
    this.glow.emissiveIntensity = 0.4 + p * 4;
    this.engineLight.intensity = p * 450;
    // Feux à éclats, un bref éclair toutes les 2 s
    this.beacons.emissiveIntensity = 1.2 + (time % 2 < 0.09 ? 9 : 0);
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
