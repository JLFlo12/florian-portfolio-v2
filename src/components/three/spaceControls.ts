import * as THREE from 'three';
import { metalEnvironment, type SatelliteSpot } from './satellites';

/* ───────────────────────────────────────────────────────────────
   Boutons de l'en-tête en 3D (une seule scène WebGL pour les quatre), même thème que les
   satellites du menu : métal sombre et chrome, l'orange en touches.
   - Langue : petite planète aux continents en points et au bord orange (comme celle de l'accueil) ;
     elle fait un demi-tour quand la langue change ;
   - Mini-jeux : soucoupe volante, lumières qui tournent, rayon tracteur au survol (et sur la page Jeux) ;
   - Musique : pulsar, deux faisceaux qui balaient comme un phare et pulsent pendant la lecture ;
     éteint quand la musique est coupée ;
   - Thème : soleil et ses rayons en mode clair ; en mode sombre, la lune passe devant (éclipse).
   Caméra orthographique : 1 unité = 1 px CSS.
   ─────────────────────────────────────────────────────────────── */

export type ControlsState = { dark: boolean; music: 0 | 1 | 2; games: boolean }; // music : 0 coupée, 1 voulue (en attente d'un clic), 2 en lecture
export type ControlsScene = {
  setHover: (i: number) => void; setState: (s: ControlsState) => void; spin: (i: number) => void;
  setPaused: (paused: boolean) => void; dispose: () => void;
};

const ORANGE = 0xff6a1f;
const BASE = 1.3; // taille générale
const TAU = Math.PI * 2;

export const createSpaceControls = (canvas: HTMLCanvasElement, spots: SatelliteSpot[], width: number, height: number, initial: ControlsState): ControlsScene => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };
  const env = keep(metalEnvironment(renderer));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, -200, 200);
  camera.position.set(0, 0, 100);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.set(-40, 60, 80);
  const rimLight = new THREE.DirectionalLight(ORANGE, 0.5);
  rimLight.position.set(60, 10, -60);
  scene.add(key, rimLight);

  // Lueurs : additives sur fond sombre, normales sur fond clair (l'additif y disparaîtrait)
  const glowing: THREE.Material[] = [];
  const setBlending = (dark: boolean) => glowing.forEach((m) => { m.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending; m.needsUpdate = true; });

  const glowTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return keep(new THREE.CanvasTexture(c));
  })();
  // Point rond (sans ça, les points de three.js sont carrés)
  const dotTexture = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(16, 16, 14, 0, TAU);
    g.fill();
    return keep(new THREE.CanvasTexture(c));
  })();
  const glow = (color: number, size: number) => {
    const m = keep(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, depthWrite: false, toneMapped: false }));
    glowing.push(m);
    const s = new THREE.Sprite(m);
    s.scale.setScalar(size);
    return s;
  };
  // Dégradé le long d'un faisceau (rayon tracteur, faisceaux du pulsar) : fort à la source, nul au bout
  const beamMaterial = (color: number) => {
    const m = keep(new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv; void main(){ gl_FragColor = vec4(uColor, pow(vUv.y, 1.6) * uOpacity); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    glowing.push(m);
    return m;
  };
  const metal = (params: THREE.MeshStandardMaterialParameters) =>
    keep(new THREE.MeshStandardMaterial({ envMap: env.texture, envMapIntensity: 1.3, ...params }));
  const chrome = metal({ color: 0xc9ced4, metalness: 1, roughness: 0.16 });
  const steel = metal({ color: 0x8d939b, metalness: 1, roughness: 0.3 });
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(keep(geometry), material);
    o.position.set(x, y, z);
    return o;
  };

  type Item = { body: THREE.Group; update: (dt: number, t: number, h: number, s: ControlsState) => void };

  /* ——— Langue : petite planète ——— */
  const planet = (): Item => {
    const body = new THREE.Group();
    const ground = metal({ color: 0x1c1d21, metalness: 0.4, roughness: 0.55, envMapIntensity: 0.8 });
    body.add(mesh(new THREE.SphereGeometry(12, 40, 28), ground));
    // Continents en points (motif fixe), sur une sphère de Fibonacci : peu de points, bien séparés à cette taille
    const pts: number[] = [];
    const n = 520;
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.399963;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const f = Math.sin(2.3 * x + 0.4) + Math.sin(2.9 * y + 1.1) + Math.sin(2.1 * z + 2.3) + 0.6 * Math.sin(4.7 * (x + z) + 0.3);
      if (f > 1) pts.push(x * 12.25, y * 12.25, z * 12.25);
    }
    const dotsGeometry = keep(new THREE.BufferGeometry());
    dotsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const dots = keep(new THREE.PointsMaterial({ color: 0xffe2c4, map: dotTexture, alphaTest: 0.4, size: 1.5 * dpr, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false }));
    body.add(new THREE.Points(dotsGeometry, dots));
    // Bord orange (plus fort sur le pourtour)
    const rim = keep(new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(ORANGE) } },
      vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; varying vec3 vN; void main(){ gl_FragColor = vec4(uColor, pow(1. - abs(vN.z), 3.) * .85); }',
      transparent: true, depthWrite: false,
    }));
    glowing.push(rim);
    body.add(mesh(new THREE.SphereGeometry(12.8, 40, 28), rim));
    let turn = 0; // demi-tours demandés (changement de langue)
    let angle = 0;
    return {
      body,
      update: (dt, _t, h, s) => {
        // Comme la planète de l'accueil : noire à points crème en mode sombre, ivoire à points orange en mode clair
        dots.color.set(s.dark ? 0xffe2c4 : 0xc2410c);
        ground.color.set(s.dark ? 0x1c1d21 : 0xf1e2d0);
        ground.metalness = s.dark ? 0.4 : 0.1;
        turn = (body.userData.turn as number | undefined) ?? turn;
        angle += dt * (0.35 + h * 1.6);
        body.rotation.y += (angle + turn * Math.PI - body.rotation.y) * Math.min(1, dt * 5);
      },
    };
  };

  /* ——— Mini-jeux : soucoupe volante ——— */
  const ufo = (): Item => {
    const body = new THREE.Group();
    const profile = [[0, -2.6], [7, -2.2], [13.5, -0.6], [14.6, 0], [13.5, 0.7], [8, 2.1], [0, 2.4]].map(([x, y]) => new THREE.Vector2(x, y));
    const hull = metal({ color: 0xc9ced4, metalness: 1, roughness: 0.16 }); // chrome plus sombre en mode clair (sinon il se fond dans le fond)
    body.add(mesh(new THREE.LatheGeometry(profile, 40), hull));
    body.add(mesh(new THREE.CylinderGeometry(5, 6.5, 1.6, 24), steel, 0, -3, 0));
    const dome = mesh(new THREE.SphereGeometry(5.8, 24, 12, 0, TAU, 0, Math.PI / 2), metal({ color: 0x9fb4c8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.6 }), 0, 2, 0);
    body.add(dome);
    // Lumières du bord, qui s'allument tour à tour
    const lights = Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * TAU;
      const m = keep(new THREE.MeshBasicMaterial({ color: ORANGE, transparent: true, toneMapped: false }));
      body.add(mesh(new THREE.SphereGeometry(0.95, 10, 8), m, Math.cos(a) * 12.4, 0.5, Math.sin(a) * 12.4));
      return m;
    });
    // Rayon tracteur (au survol, et en continu sur la page Jeux)
    const beam = beamMaterial(ORANGE);
    body.add(mesh(new THREE.ConeGeometry(10, 20, 32, 1, true), beam, 0, -13, 0));
    let on = 0;
    return {
      body,
      update: (dt, t, h, s) => {
        hull.color.set(s.dark ? 0xc9ced4 : 0x6b7079);
        lights.forEach((m, k) => { m.opacity = 0.25 + 0.75 * Math.max(0, Math.cos(t * 4 - (k / 10) * TAU)) ** 3; });
        on += ((Math.max(h, s.games ? 0.6 : 0)) - on) * Math.min(1, dt * 6);
        beam.uniforms.uOpacity.value = on * (s.dark ? 0.55 : 0.4) * (0.85 + Math.sin(t * 9) * 0.15);
        body.rotation.y += dt * (0.5 + h * 1.5);
        body.rotation.z = Math.sin(t * 2.2) * 0.05 * (1 + h * 2);
      },
    };
  };

  /* ——— Musique : pulsar ——— */
  const pulsar = (): Item => {
    const body = new THREE.Group();
    const coreMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff1dc, toneMapped: false }));
    body.add(mesh(new THREE.SphereGeometry(5.4, 24, 16), coreMat));
    const halo = glow(ORANGE, 30);
    body.add(halo);
    const ring = mesh(new THREE.TorusGeometry(10, 0.55, 8, 48), steel);
    ring.rotation.set(Math.PI / 2 - 0.5, 0.3, 0);
    body.add(ring);
    // Faisceaux : axe incliné qui tourne (effet phare)
    const spinner = new THREE.Group();
    const axis = new THREE.Group();
    axis.rotation.z = 0.55;
    spinner.add(axis);
    body.add(spinner);
    const beam = beamMaterial(0xffd2a8);
    const up = mesh(new THREE.ConeGeometry(4.2, 23, 20, 1, true), beam, 0, 11.5, 0);
    up.rotation.x = Math.PI;
    axis.add(up, mesh(new THREE.ConeGeometry(4.2, 23, 20, 1, true), beam, 0, -11.5, 0));
    let level = initial.music === 2 ? 1 : 0;
    const grey = new THREE.Color(0x5a5e66), hot = new THREE.Color(0xfff1dc);
    return {
      body,
      update: (dt, t, h, s) => {
        const target = s.music === 2 ? 1 : s.music === 1 ? 0.55 : 0;
        level += (target - level) * Math.min(1, dt * 4);
        spinner.rotation.y += dt * (1.6 + level * 2.4 + h * 2);
        const pulse = s.music === 2 ? 0.75 + Math.sin(t * 7.5) * 0.25 : 1;
        beam.uniforms.uOpacity.value = level * pulse * (s.dark ? 0.8 : 0.6) + h * 0.15;
        coreMat.color.copy(grey).lerp(hot, Math.max(level, h * 0.6));
        (halo.material as THREE.SpriteMaterial).opacity = (level * 0.8 + h * 0.2) * (s.dark ? 1 : 0.55);
        halo.scale.setScalar(26 + level * 8 * pulse);
      },
    };
  };

  /* ——— Thème : soleil, ou éclipse en mode sombre ——— */
  const sun = (): Item => {
    const body = new THREE.Group();
    body.add(mesh(new THREE.SphereGeometry(9.5, 32, 20), keep(new THREE.MeshBasicMaterial({ color: 0xffa43c, toneMapped: false }))));
    const corona = glow(0xff7a2a, 40);
    body.add(corona);
    const rays = new THREE.Group();
    const rayMat = keep(new THREE.MeshBasicMaterial({ color: 0xffb547, toneMapped: false }));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const ray = mesh(new THREE.ConeGeometry(1.5, k % 2 ? 4.5 : 6, 4), rayMat, Math.cos(a) * 14.5, Math.sin(a) * 14.5, 0);
      ray.rotation.z = a - Math.PI / 2;
      rays.add(ray);
    }
    body.add(rays);
    // Lune un peu plus petite que le soleil et décalée : il en reste un fin croissant lumineux (éclipse)
    const moon = mesh(new THREE.SphereGeometry(8.9, 32, 20), metal({ color: 0x141518, metalness: 0.2, roughness: 0.85, envMapIntensity: 0.4 }), 0, 0, 6);
    body.add(moon);
    let eclipse = initial.dark ? 1 : 0;
    return {
      body,
      update: (dt, _t, h, s) => {
        eclipse += ((s.dark ? 1 : 0) - eclipse) * Math.min(1, dt * 3.5);
        const e = eclipse * eclipse * (3 - 2 * eclipse);
        moon.position.x = (1 - e) * 24 + e * 1.3;
        moon.position.y = e * 0.6;
        moon.scale.setScalar(Math.max(0.001, e));
        moon.visible = e > 0.01;
        rays.scale.setScalar(Math.max(0.001, 1 - e));
        rays.rotation.z -= dt * (0.25 + h * 1.4);
        (corona.material as THREE.SpriteMaterial).opacity = s.dark ? 0.95 : 0.6;
        corona.scale.setScalar(34 + e * 12 + h * 6);
      },
    };
  };

  const builders = [planet, ufo, pulsar, sun];
  const items = spots.map((spot, i) => {
    const item = builders[i % builders.length]();
    const holder = new THREE.Group();
    const tilt = new THREE.Group();
    tilt.add(item.body);
    holder.add(tilt);
    holder.position.x = spot.x;
    // La soucoupe et l'anneau du pulsar se voient un peu de dessus
    tilt.rotation.x = i === 1 ? 0.42 : 0.15;
    scene.add(holder);
    return { ...item, holder, tilt, h: 0 };
  });

  let state = initial;
  setBlending(state.dark);
  let hover = -1;
  let paused = false;
  let raf = 0;
  let last = performance.now();
  let t = 0;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    items.forEach((it, i) => {
      const spot = spots[i];
      it.h += ((hover === i ? 1 : 0) - it.h) * Math.min(1, dt * 8);
      it.update(dt, t, it.h, state);
      it.tilt.rotation.z = spot.rz + Math.sin(t * 0.6 + i * 1.7) * 0.06;
      it.holder.position.y = -spot.y + Math.sin(t * 1.3 + i * 0.9) * 1.4;
      it.holder.scale.setScalar(BASE * spot.s * (1 + it.h * 0.15));
    });
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    setHover: (i) => { hover = i; },
    setState: (s) => { if (s.dark !== state.dark) setBlending(s.dark); state = s; },
    spin: (i) => { const body = items[i]?.body; if (body) body.userData.turn = ((body.userData.turn as number | undefined) ?? 0) + 1; },
    setPaused: (p) => {
      if (p === paused) return;
      paused = p;
      cancelAnimationFrame(raf);
      if (!p) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    },
  };
};
