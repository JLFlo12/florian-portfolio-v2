import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ═══════════════════════════════════════════════════════════════
   INTRO : L'ASTRONAUTE DÉCHU (chute à la manière de Lucifer)
   Le corps : « Animated Floating Astronaut in Space Suit Loop » par LasquetiSpice (Sketchfab, CC BY 4.0),
   combinaison de sortie extravéhiculaire avec son sac dorsal ; reposé dans Blender (public/intro/angel.glb :
   son squelette d'origine, clip « fall » qui passe en boucle entre trois poses de chute sur le dos :
   l'air pousse bras et jambes vers le ciel, le tronc se plie en U).
   La combinaison est repeinte dans la palette du site : graphite chaud, liserés qui rougeoient orange.
   Les ailes sont faites ici : ~100 plumes par aile (rémiges, secondaires, couvertures), chacune un
   plan découpé dans le shader (vexille, rachis, barbes séparées), posées sur un squelette d'aile
   accroché au dos ; l'air les arrache vers le ciel le long de ses flancs, elles battent sans le porter
   et perdent des plumes, qui remontent.
   ═══════════════════════════════════════════════════════════════ */

const NOISE = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x), mix(hash21(i + vec2(0., 1.)), hash21(i + vec2(1., 1.)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
`;

/* ——— Plume : un plan (x en travers, y le long, de 0 au calamus à 1 à la pointe) courbé et agité par l'air ——— */
const FEATHER_VERT = /* glsl */ `
  attribute float aSeed, aBend, aAsym;
  uniform float uT, uFlutter;
  varying vec2 vUv; varying vec3 vN, vW; varying float vAsym, vSeed;
  void main() {
    vUv = uv; vAsym = aAsym; vSeed = aSeed;
    vec3 p = position;
    float v = uv.y;
    float ph = uT * (4. + aSeed * 3.) + aSeed * 31. + v * 3.5;
    p.z += aBend * v * v + sin(ph) * uFlutter * v * v;
    float dz = 2. * aBend * v + uFlutter * (2. * v * sin(ph) + v * v * 3.5 * cos(ph));
    mat4 m = modelMatrix * instanceMatrix;
    mat3 m3 = mat3(m);
    vec3 s2 = vec3(dot(m3[0], m3[0]), dot(m3[1], m3[1]), dot(m3[2], m3[2]));
    vN = normalize(m3 * (vec3(0., -dz, 1.) / s2));   // normale (inverse transposée d'une échelle non uniforme)
    vec4 w = m * vec4(p, 1.);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

/* Noir chaud ; la lumière d'en haut glisse sur les barbes et traverse les bords fins ; liseré orange d'en bas */
const FEATHER_FRAG = /* glsl */ `
  uniform vec3 uL1, uL2;
  uniform float uK1, uK2;
  varying vec2 vUv; varying vec3 vN, vW; varying float vAsym, vSeed;
  float h1(float n) { return fract(sin(n) * 43758.5453); }
  float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i), h1(i + 1.), f); }
  void main() {
    float v = vUv.y, x = vUv.x - .5, ax = abs(x);
    float w = .5 * smoothstep(0., .2, v) * sqrt(max(1. - pow(max(v - .3, 0.) / .7, 2.), 0.));
    w *= 1. - max(sign(x) * vAsym, 0.) * .55;                                 // vexille externe plus étroite
    float notch = n1(v * 24. + vSeed * 57. + step(0., x) * 19.);
    w *= 1. - .3 * smoothstep(.6, .95, notch) * smoothstep(.15, .45, v);        // barbes séparées
    float vane = smoothstep(w + .012, w - .012, ax);
    float rach = smoothstep(.02, .008, ax) * smoothstep(1., .9, v) * smoothstep(.16, .28, v);   // pas de calamus visible
    float a = max(vane, rach);
    if (a < .02) discard;
    vec3 N = normalize(vN) * (gl_FrontFacing ? 1. : -1.);
    vec3 V = normalize(cameraPosition - vW);
    float barbArg = (v * 1.3 + ax * 1.1) * 110. + vSeed * 7.;
    float barb = .6 + .4 * sin(barbArg) * clamp(1.5 - fwidth(barbArg) * .6, 0., 1.);   // les barbes s'effacent au loin (pas de moiré)
    float thin = ax / max(w, .001);
    float d1 = max(dot(N, uL1), 0.), b1 = max(-dot(N, uL1), 0.), d2 = max(dot(N, uL2), 0.);
    float rim = pow(1. - abs(dot(N, V)), 3.);
    vec3 col = vec3(.009, .008, .008) * (.7 + .5 * barb);                    // noir
    col += vec3(.55, .56, .6) * pow(d1, 10.) * uK1 * barb * .7;                // reflet net et froid, comme un plumage de corbeau
    col += vec3(1., .62, .32) * b1 * uK1 * .08 * (.3 + thin);
    col += vec3(1., .42, .12) * (d2 * .02 + rim * .12) * uK2 * (.5 + .5 * barb);
    col += vec3(1., .45, .15) * pow(thin, 12.) * uK2 * .12;   // un liseré très fin seulement               // bords des plumes en contre-jour orange : la silhouette se lit sur le noir
    col = mix(col, vec3(.03, .025, .022), rach * .5);
    gl_FragColor = vec4(col, a);
  }
`;

type Feather = { seg: number; u: number; ang: number; len: number; wid: number; z: number; bend: number; asym: number; twist: number; tear: boolean };

/* Squelette d'aile (unités du modèle : l'astronaute mesure 1,93) : bras, avant-bras, main */
const SEG = [0.42, 0.6, 0.5];
/* Recul des ailes dans le tampon de profondeur, en unités de polygonOffset (pas du tampon, 24 bits). L'astronaute est à
   8,5 unités de la caméra (plans 0,02 et 80) : une unité du monde y vaut environ 4 600 pas ; 3 600 pas, c'est 0,78 unité,
   plus que la portée de ses bras (0,4 à son échelle). */
const WING_BACK = 3600;

function featherLayout(): Feather[] {
  const f: Feather[] = [];
  const add = (o: Pick<Feather, 'seg' | 'u' | 'ang' | 'len' | 'wid' | 'z'> & Partial<Feather>) =>
    f.push({ bend: -0.07 * o.len, asym: 0, twist: 0, tear: false, ...o });
  const along = (t: number) => { const seg = Math.min(2, Math.floor(t)); return { seg, u: t - seg }; };
  // rémiges primaires : sur la main, en éventail jusqu'à la pointe
  for (let i = 0; i < 11; i++) {
    const u = (i + 0.5) / 11;
    add({ seg: 2, u, ang: -Math.PI / 2 + 1.3 * Math.pow(u, 1.4), len: 1.0 + 0.5 * u, wid: 0.27, z: 0.0015 * i, asym: 0.8, twist: 0.14 });
  }
  // secondaires : le long de l'avant-bras
  for (let i = 0; i < 16; i++) {
    const u = (i + 0.5) / 16;
    add({ seg: 1, u, ang: -Math.PI / 2 - 0.12 * (1 - u), len: 0.86 - 0.05 * u, wid: 0.3, z: 0.0012 * i, twist: 0.08 });
  }
  // tertiaires et scapulaires : sur le bras, rabattues vers le corps
  for (let i = 0; i < 9; i++) {
    const u = (i + 0.5) / 9;
    add({ seg: 0, u, ang: -Math.PI / 2 - 0.35 - 0.3 * (1 - u), len: 0.5 + 0.24 * u, wid: 0.24, z: 0.0012 * i });
  }
  // couvertures dorsales : trois rangs de plus en plus courts vers le bord d'attaque
  ([[0.52, -0.016, 20], [0.3, -0.03, 24], [0.16, -0.042, 28]] as const).forEach(([len, z, n], r) => {
    for (let i = 0; i < n; i++) {
      const { seg, u } = along(((i + 0.5) / n) * 3);
      add({ seg, u, ang: -Math.PI / 2 + (seg === 2 ? 0.9 * u : 0) - (seg === 0 ? 0.3 : 0), len: len * (seg === 0 ? 0.8 : 1), wid: 0.26 - r * 0.04, z: z - 0.002 * (i % 2), bend: -0.03 * len, tear: r > 0 });
    }
  });
  // couvertures ventrales
  for (let i = 0; i < 20; i++) {
    const { seg, u } = along(((i + 0.5) / 20) * 3);
    add({ seg, u, ang: -Math.PI / 2 + (seg === 2 ? 0.9 * u : 0), len: 0.42, wid: 0.24, z: 0.026 + 0.002 * (i % 2), bend: 0.008 });
  }
  return f;
}

const featherGeometry = () => new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0);

export type Angel = {
  group: THREE.Group;
  /** a : avancée de la chute (0 → 1) ; light : lumière du corps ; sky : lumière d'en haut */
  /** open : 0 = ailes repliées par l'air, 1 = grandes ouvertes (elles prennent l'air et le freinent) */
  update: (dt: number, now: number, a: number, light: number, sky: number, camera: THREE.Camera, open?: number) => void;
  dispose: () => void;
};

export function createAngel(gltf: GLTF, scene: THREE.Scene): Angel {
  const group = new THREE.Group();
  const root = gltf.scene;
  root.position.set(-0.08, -1.52, -0.26);   // pivot au centre du corps (mesuré dans Blender)
  group.add(root);
  scene.add(group);

  /* ——— Combinaison : graphite chaud, liserés et anneaux orange qui rougeoient, visière et bottes brillantes ——— */
  const accent = { value: 0 };
  const mats: THREE.Material[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.map) mat.map.anisotropy = 8;
    // tissu mat : on coupe la texture spéculaire de la NASA (elle donnait un aspect de verre)
    const pm = mat as THREE.MeshPhysicalMaterial;
    if (pm.isMeshPhysicalMaterial) { pm.specularColorMap = null; pm.specularIntensityMap = null; pm.specularColor.setRGB(1, 1, 1); pm.specularIntensity = 0.3; }
    mat.metalness = 0;
    mat.roughness = 0.9;   // la carte de rugosité du modèle garde ses nuances
    mat.envMapIntensity = 0.45;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uAccent = accent;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uAccent;\nfloat suitAccent, suitLum;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          suitLum = dot(diffuseColor.rgb, vec3(.299, .587, .114));
          suitAccent = clamp((max(diffuseColor.r - max(diffuseColor.g, diffuseColor.b), diffuseColor.b - max(diffuseColor.r, diffuseColor.g))) * 3. - .5, 0., 1.);
          diffuseColor.rgb = mix(mix(vec3(.03, .024, .02), vec3(.34, .27, .22), smoothstep(.08, .85, suitLum)), vec3(.05, .03, .02), suitAccent);`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .2, smoothstep(.12, .03, suitLum));')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1., .42, .12) * suitAccent * uAccent;');
    };
    mat.needsUpdate = true;
    mats.push(mat);
  });

  const mixer = new THREE.AnimationMixer(root);
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
  mixer.timeScale = 1;   // il se débat : boucle de 4 s

  /* ——— Ailes : accrochées à l'os de la poitrine, à l'arrière de la combinaison ——— */
  const uniforms = {
    uT: { value: 0 }, uFlutter: { value: 0.02 },
    uL1: { value: new THREE.Vector3(0.2, 1, 0.35).normalize() }, uK1: { value: 0 },
    uL2: { value: new THREE.Vector3(0.1, -1, 0.3).normalize() }, uK2: { value: 0 },
  };
  // Les ailes sont toujours dessinées derrière le corps : leur profondeur est repoussée (polygonOffset) de plus que
  // l'envergure des bras, sans changer leur place à l'écran. Un bras ne peut donc plus traverser une aile : il passe
  // devant elle, et le corps clair se détache sur le plumage noir. Les plumes d'une même aile gardent leur ordre.
  const makeFeatherMat = (back: number) => new THREE.ShaderMaterial({
    uniforms, vertexShader: FEATHER_VERT, fragmentShader: FEATHER_FRAG, side: THREE.DoubleSide, alphaToCoverage: true,
    polygonOffset: back > 0, polygonOffsetFactor: 0, polygonOffsetUnits: back,
  });
  const featherMat = makeFeatherMat(WING_BACK);
  const looseMat = makeFeatherMat(WING_BACK);   // les plumes arrachées passent elles aussi derrière le corps (pas de tache noire sur la combinaison)
  const geo = featherGeometry();
  const layout = featherLayout();
  let chest: THREE.Object3D = root;   // l'os du haut du dos (le sac dorsal y est attaché)
  root.traverse((o) => { if ((o as THREE.Bone).isBone && /^Spine_3/.test(o.name)) chest = o; });
  // les os sont encore dans leur pose de repos (le mixeur n'a pas tourné) : on accroche les ailes maintenant.
  // (pas de skeleton.pose() : il ignore les échelles des nœuds parents du squelette, en centimètres ici, et écrase le corps)
  group.updateMatrixWorld(true);
  const toBone = new THREE.Matrix4().copy(chest.matrixWorld).invert().multiply(root.matrixWorld);

  const makeWing = (side: 1 | -1) => {
    const g = geo.clone();
    const n = layout.length;
    const seed = new Float32Array(n), bend = new Float32Array(n), asym = new Float32Array(n);
    layout.forEach((f, i) => { seed[i] = Math.random(); bend[i] = f.bend; asym[i] = -side * f.asym; });
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute('aBend', new THREE.InstancedBufferAttribute(bend, 1));
    g.setAttribute('aAsym', new THREE.InstancedBufferAttribute(asym, 1));
    const mesh = new THREE.InstancedMesh(g, featherMat, n);
    mesh.frustumCulled = false;
    const pivot = new THREE.Group();
    pivot.rotation.order = 'YZX';
    pivot.add(mesh);
    const anchor = new THREE.Group();
    // racine de l'aile : au milieu du sac dorsal, à hauteur des omoplates (plus haut, elles sortaient de la nuque)
    new THREE.Matrix4().multiplyMatrices(toBone, new THREE.Matrix4().makeTranslation(0.24 * side, 1.42, -0.3)).decompose(anchor.position, anchor.quaternion, anchor.scale);
    anchor.scale.multiplyScalar(0.85);
    anchor.add(pivot);
    chest.add(anchor);
    return { side, mesh, pivot, torn: new Array<boolean>(n).fill(false) };
  };
  const wings = [makeWing(1), makeWing(-1)];

  /* ——— Plumes arrachées : elles quittent l'aile et remontent (lui tombe plus vite qu'elles) en tournoyant ——— */
  const LOOSE = 10;
  const looseGeo = geo.clone();
  const lSeed = new Float32Array(LOOSE), lBend = new Float32Array(LOOSE), lAsym = new Float32Array(LOOSE);
  for (let i = 0; i < LOOSE; i++) { lSeed[i] = Math.random(); lBend[i] = 0.03; lAsym[i] = 0; }
  looseGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(lSeed, 1));
  looseGeo.setAttribute('aBend', new THREE.InstancedBufferAttribute(lBend, 1));
  looseGeo.setAttribute('aAsym', new THREE.InstancedBufferAttribute(lAsym, 1));
  const loose = new THREE.InstancedMesh(looseGeo, looseMat, LOOSE);
  loose.frustumCulled = false;
  scene.add(loose);
  type Loose = { rel: THREE.Vector3; vel: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3; axis: THREE.Vector3; spin: number; age: number; life: number; seed: number };
  const flying: Loose[] = [];
  const tearAt = [0.06, 0.1, ...Array.from({ length: 7 }, () => 0.14 + Math.random() * 0.6)].sort((x, y) => x - y);
  let nextTear = 0;
  const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), spinQ = new THREE.Quaternion();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), segDir = new THREE.Vector3();
  const AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
  const joints = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  const tear = (camera: THREE.Camera) => {
    if (flying.length >= LOOSE) return;
    const w = wings[Math.random() < 0.5 ? 0 : 1];
    const candidates = layout.map((f, i) => (f.tear && !w.torn[i] ? i : -1)).filter((i) => i >= 0);
    if (!candidates.length) return;
    const i = candidates[Math.floor(Math.random() * candidates.length)];
    w.mesh.updateMatrixWorld();
    w.mesh.getMatrixAt(i, tmpM);
    tmpM.premultiply(w.mesh.matrixWorld).decompose(tmpP, tmpQ, tmpS);
    w.torn[i] = true;
    flying.push({
      rel: tmpP.clone().sub(camera.position), q: tmpQ.clone(), s: tmpS.clone(),
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.7, 0.8 + Math.random() * 1.0, (Math.random() - 0.5) * 0.5),
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spin: 1.5 + Math.random() * 2.5, age: 0, life: 2.4 + Math.random() * 1.4, seed: Math.random() * 10,
    });
  };

  function update(dt: number, now: number, a: number, light: number, sky: number, camera: THREE.Camera, open = 0) {
    mixer.update(dt);
    accent.value = light * 0.7;
    uniforms.uT.value = now;
    uniforms.uK1.value = 0.12 + sky * 0.9;
    uniforms.uK2.value = light;
    const speed = Math.min(1, a * 2.2);   // la chute accélère : l'air pousse de plus en plus fort
    uniforms.uFlutter.value = 0.02 + 0.045 * speed;   // l'air fait claquer les plumes

    for (const w of wings) {
      const ph = w.side > 0 ? 0 : 0.8;
      const k = 0.7 + 0.8 * speed;
      // Il tombe sur le dos : l'air ne déploie pas les ailes, il les replie vers le ciel, plumes dans le sens du vent
      // (comme un oiseau qui pique). Elles montent du sac dorsal, longues et étroites, légèrement courbées ;
      // l'air tente de les ouvrir par à-coups (fold respire), elles ne portent rien.
      const fold = (0.32 + Math.sin(now * 2.2 + ph) * 0.12 * k) * (1 - open) + 0.04 * open;   // ouvertes : elles prennent l'air
      // le plan de l'aile est tourné de 90° : il contient l'axe tête-pieds et le ciel, on le voit de face quand il est de profil
      w.pivot.rotation.set(
        Math.sin(now * 1.6 + ph) * 0.08 * k,
        (-Math.PI / 2 + 0.42 + Math.sin(now * 1.7 + ph * 1.3) * 0.1 * k) * w.side,
        Math.sin(now * 1.9 + ph) * 0.06 * k * w.side,
      );
      const th = [
        (w.side > 0 ? 1.04 : 0.6) + Math.sin(now * 2.3 + ph) * 0.06 * k,             // le bras de l'aile longe le casque, vers la tête et le ciel…
        -0.2 + Math.sin(now * 2.3 + ph - 0.8) * 0.1 * k,
        -0.35 + Math.sin(now * 2.3 + ph - 1.6) * 0.14 * k,      // … et la main se relève vers le ciel
      ];
      // les plumes partent de cette ligne vers le ciel : rien ne pend au-dessus de l'épaule, les bras restent libres
      th[1] += th[0]; th[2] += th[1];
      const sw = [0, -0.12 + Math.sin(now * 1.9 + ph - 0.6) * 0.06 * k, -0.25 + Math.sin(now * 1.9 + ph - 1.2) * 0.1 * k];
      for (let s = 0; s < 3; s++) {
        segDir.set(Math.cos(th[s]) * Math.cos(sw[s]), Math.sin(th[s]), -Math.cos(th[s]) * Math.sin(sw[s]));
        joints[s + 1].copy(joints[s]).addScaledVector(segDir, SEG[s]);
      }
      layout.forEach((f, i) => {
        if (w.torn[i]) { w.mesh.setMatrixAt(i, zero); return; }
        const s = f.seg;
        const swS = sw[s];
        tmpP.copy(joints[s]).lerp(joints[s + 1], f.u);
        tmpP.x += Math.sin(swS) * f.z;   // décalage des rangs le long de la normale de l'aile
        tmpP.z += Math.cos(swS) * f.z;
        tmpP.x *= w.side;                 // aile droite : miroir de la gauche
        const fa = f.ang + (-0.14 - 0.08 * f.u - f.ang) * fold;   // repliée : les plumes se couchent le long du bras
        const rz = th[s] + fa - Math.PI / 2;
        tmpQ.setFromAxisAngle(AX_Y, swS * w.side)
          .multiply(qa.setFromAxisAngle(AX_Z, rz * w.side))
          .multiply(qb.setFromAxisAngle(AX_Y, f.twist * w.side));
        tmpS.set(f.wid, f.len, 1);
        w.mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
      });
      w.mesh.instanceMatrix.needsUpdate = true;
    }

    while (nextTear < tearAt.length && a >= tearAt[nextTear]) { tear(camera); nextTear++; }
    for (let i = 0; i < LOOSE; i++) {
      const f = flying[i];
      if (!f || f.age > f.life) { loose.setMatrixAt(i, zero); continue; }
      f.age += dt;
      f.vel.y += 1.8 * dt;   // il tombe plus vite qu'elles : elles remontent et sortent par le haut
      f.vel.multiplyScalar(1 - 0.4 * dt);
      f.rel.addScaledVector(f.vel, dt);
      f.rel.x += Math.sin(f.age * 3 + f.seed) * 0.3 * dt;
      f.q.multiply(spinQ.setFromAxisAngle(f.axis, f.spin * dt));
      const fade = 1 - THREE.MathUtils.smoothstep(f.age, f.life - 0.8, f.life);
      tmpP.copy(camera.position).add(f.rel);
      tmpS.copy(f.s).multiplyScalar(fade);
      loose.setMatrixAt(i, tmpM.compose(tmpP, f.q, tmpS));
    }
    loose.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    update,
    dispose() {
      mixer.stopAllAction();
      scene.remove(group, loose);
      wings.forEach((w) => w.mesh.geometry.dispose());
      geo.dispose(); looseGeo.dispose(); featherMat.dispose(); looseMat.dispose();
      mats.forEach((m) => {
        const sm = m as THREE.MeshStandardMaterial;
        [sm.map, sm.normalMap, sm.roughnessMap, sm.metalnessMap].forEach((t) => t?.dispose());
        m.dispose();
      });
      root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    },
  };
}

/* ═══ La paroi de l'abîme, en travelling : on tombe avec lui, la roche défile vers le haut derrière lui.
   Texture « Rock Face 03 » (Poly Haven, CC0) : luminosité en R, relief (normal map) en G et B, en 2K, nette ;
   éclairée d'en haut (la lumière qu'il quitte) et repeinte dans la palette du site. Le flou de bougé suit la
   vitesse, comme l'obturateur d'une caméra. Des arêtes de roche toutes proches passent sur les bords. ═══ */
const ROCK = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uK, uScroll, uAspect, uBlur;
  varying vec2 vUv;
  vec3 rock(vec2 uv) {
    vec4 t = vec4(0.);
    for (int i = 0; i < 6; i++) t += texture2D(uTex, uv + vec2(0., uBlur * (float(i) / 5. - .5)));
    t /= 6.;
    vec3 n = vec3(t.g * 2. - 1., t.b * 2. - 1., 0.);
    n.z = sqrt(max(1. - dot(n.xy, n.xy), 0.));
    float dif = max(dot(n, normalize(vec3(-.25, .9, .45))), 0.);
    return vec3(t.r, dif, 0.);
  }
`;

const WALL_FRAG = /* glsl */ `
  precision highp float;
  ${ROCK}
  void main() {
    vec2 uv = vec2((vUv.x - .5) * uAspect, vUv.y) * 1.25 + vec2(.37, -uScroll);
    vec3 r = rock(uv);
    float top = smoothstep(-.2, 1.15, vUv.y);                       // plus clair vers le haut, d'où vient la lumière
    float lum = r.x * pow(r.y, 1.6) * (.2 + .9 * top);
    vec3 col = mix(vec3(.012, .009, .008), vec3(.17, .1, .062), smoothstep(.03, .42, lum));
    col = mix(col, vec3(1., .58, .3), smoothstep(.4, .85, lum) * .55);
    col *= .35 + .65 * smoothstep(.75, .25, abs(vUv.x - .5));       // les bords retombent dans le noir
    // au-dessus de lui, la lumière d'où il tombe : ses ailes noires s'y découpent en silhouette
    float halo = exp(-pow((vUv.x - .5) * uAspect * .85, 2.) * 2.2 - pow(1.05 - vUv.y, 2.) * 3.2);
    col = col * (1. - halo * .6) + vec3(.8, .45, .22) * halo * .5 + vec3(1., .78, .55) * pow(halo, 3.) * .22;
    gl_FragColor = vec4(mix(vec3(.0392, .0314, .0235), col, uK), 1.);
  }
`;

const EDGE_FRAG = /* glsl */ `
  precision highp float;
  ${ROCK}
  void main() {
    float side = abs(vUv.x - .5) * 2.;
    vec2 uv = vec2((vUv.x - .5) * uAspect, vUv.y) * .55 + vec2(.81, -uScroll);
    vec3 r = rock(uv);
    float jag = texture2D(uTex, vec2(.13 + step(.5, vUv.x) * .5, vUv.y * .35 - uScroll * .45)).r;
    float m = smoothstep(.0, .03, side - (.8 + .16 * jag));        // arêtes déchiquetées, seulement sur les côtés
    vec3 col = vec3(.012, .009, .007) + vec3(.9, .45, .2) * pow(r.y, 6.) * r.x * .35;
    gl_FragColor = vec4(col, m * uK);
  }
`;

const PLANE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }
`;

export type FallWall = {
  setTexture: (t: THREE.Texture) => void;
  /** descent : de combien la caméra est descendue ; rate : sa vitesse (unités du monde par seconde) */
  update: (camera: THREE.PerspectiveCamera, k: number, descent: number, rate: number, wallDist?: number) => void;
  dispose: () => void;
};

export function createFallWall(scene: THREE.Scene): FallWall {
  const plane = new THREE.PlaneGeometry(1, 1);
  const uni = () => ({ uTex: { value: null as THREE.Texture | null }, uK: { value: 0 }, uScroll: { value: 0 }, uAspect: { value: 1 }, uBlur: { value: 0 } });
  const layers = [
    { d: 26, uvs: 1.25, mat: new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: WALL_FRAG, depthWrite: false, uniforms: uni() }), order: -10 },
    { d: 3, uvs: 0.55, mat: new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: EDGE_FRAG, transparent: true, depthWrite: false, uniforms: uni() }), order: 8 },
  ].map((l) => {
    const mesh = new THREE.Mesh(plane, l.mat);
    mesh.renderOrder = l.order;
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    return { ...l, mesh };
  });
  const dir = new THREE.Vector3();
  return {
    setTexture(t) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      layers.forEach((l) => { l.mat.uniforms.uTex.value = t; });
    },
    update(camera, k, descent, rate, wallDist) {
      if (wallDist) layers[0].d = wallDist;   // la paroi à la profondeur de l'œil : ils défilent ensemble
      camera.getWorldDirection(dir);
      const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      for (const l of layers) {
        l.mesh.visible = k > 0.002 && !!l.mat.uniforms.uTex.value;
        if (!l.mesh.visible) continue;
        const h = 2 * l.d * tan * 1.1;
        l.mesh.position.copy(camera.position).addScaledVector(dir, l.d);
        l.mesh.quaternion.copy(camera.quaternion);
        l.mesh.scale.set(h * camera.aspect * 1.05, h, 1);
        const u = l.mat.uniforms;
        u.uK.value = k;
        // la paroi défile exactement à la vitesse de la chute, selon sa distance (parallaxe juste)
        u.uScroll.value = (descent * l.uvs) / h;
        u.uAspect.value = camera.aspect;
        u.uBlur.value = (rate * l.uvs) / h / 120;   // déplacement pendant l'obturation (une demi-image à 60 i/s)
      }
    },
    dispose() {
      layers.forEach((l) => { scene.remove(l.mesh); l.mat.dispose(); });
      plane.dispose();
    },
  };
}
