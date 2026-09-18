import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { planetState } from './planetState';

/* ═══════════════════════════════════════════════════════════════
   PLANÈTE 3D (React Three Fiber)
   - noyau sombre avec relief procédural + halo orange sur les bords
   - continents en points lumineux (façon hologramme)
   - anneau + poussière d'anneau, lune en orbite, étoiles
   - liaisons réseau lumineuses parcourues par des "paquets"
   - balise sur La Réunion avec étiquette HTML qui la suit
   ═══════════════════════════════════════════════════════════════ */

const ACCENT = new THREE.Color('#ff6a1f');
const CREAM = new THREE.Color('#ffe2c4');
const BASE = new THREE.Color('#150c07');

/* Bruit simplex 3D (Ashima Arts / Stefan Gustavson, licence MIT) */
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float landField(vec3 p){ return snoise(p*1.45)*.62 + snoise(p*3.3)*.28 + snoise(p*8.)*.1; }
`;

const LIGHT_DIR = new THREE.Vector3(-0.9, 0.55, 0.85).normalize();

/* Position sur la sphère à partir d'une latitude / longitude (degrés) */
const latLon = (lat: number, lon: number, r = 1) => {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(-Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);
};
const REUNION = latLon(-21.11, 55.53, 1.012);
// Rotations qui placent La Réunion face à la caméra (utilisées pendant la plongée)
const REUNION_YAW = -Math.atan2(REUNION.x, REUNION.z);
const REUNION_PITCH = Math.atan2(REUNION.y, Math.hypot(REUNION.x, REUNION.z));
const DIVE_SCALE = 3.3; // taille finale : la planète remplit l'écran, continents et bord orange encore visibles

/* ——— Noyau de la planète ——— */
function Core() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uLight: { value: LIGHT_DIR }, uAccent: { value: ACCENT }, uBase: { value: BASE } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vPos; varying vec3 vView;
      void main(){
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vView = normalize(-mv.xyz);
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: NOISE + /* glsl */ `
      uniform vec3 uLight; uniform vec3 uAccent; uniform vec3 uBase;
      varying vec3 vNormal; varying vec3 vPos; varying vec3 vView;
      void main(){
        vec3 p = normalize(vPos);
        float n = landField(p);
        float isLand = smoothstep(.08, .14, n);
        float bands = sin(p.y * 22. + snoise(p * 2.) * 2.) * .5 + .5;
        vec3 ocean = mix(uBase, uBase * 1.7, bands * .35);
        vec3 ground = mix(uBase * 2.4, uBase * 3.6, smoothstep(.14, .5, n));
        vec3 col = mix(ocean, ground, isLand * .85);
        float diff = max(dot(vNormal, normalize(uLight)), 0.);
        col *= .22 + diff * 1.05;
        float fres = pow(1. - max(dot(vNormal, vView), 0.), 2.6);
        col += uAccent * fres * .6;
        gl_FragColor = vec4(col, 1.);
      }`,
  }), []);
  return (
    <mesh material={material}>
      <sphereGeometry args={[1, 96, 96]} />
    </mesh>
  );
}

/* ——— Continents en points lumineux ——— */
function DotLand() {
  const gl = useThree((s) => s.gl);
  const { geometry, material } = useMemo(() => {
    const count = 11000;
    const positions = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      positions.set([Math.cos(th) * r * 1.004, y * 1.004, Math.sin(th) * r * 1.004], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: 4.2 }, uPixelRatio: { value: 1 }, uLight: { value: LIGHT_DIR },
        uAccent: { value: ACCENT }, uCream: { value: CREAM },
      },
      vertexShader: NOISE + /* glsl */ `
        uniform float uSize; uniform float uPixelRatio; uniform vec3 uLight;
        varying float vLand; varying float vLit;
        void main(){
          vec3 p = normalize(position);
          vLand = smoothstep(.1, .15, landField(p));
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          vec3 nrm = normalize(normalMatrix * p);
          vLit = max(dot(nrm, normalize(uLight)), 0.);
          gl_PointSize = uSize * uPixelRatio * vLand * (2. / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uAccent; uniform vec3 uCream;
        varying float vLand; varying float vLit;
        void main(){
          if (vLand < .5) discard;
          vec2 c = gl_PointCoord - .5;
          if (dot(c, c) > .25) discard;
          vec3 col = mix(uAccent, uCream, smoothstep(.2, .75, vLit));
          gl_FragColor = vec4(col, .5 + vLit * .5);
        }`,
    });
    return { geometry: geo, material: mat };
  }, []);
  useEffect(() => { material.uniforms.uPixelRatio.value = gl.getPixelRatio(); }, [gl, material]);
  return <points geometry={geometry} material={material} />;
}

/* ——— Halo atmosphérique ——— */
function Atmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: ACCENT } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vNormal;
      void main(){
        float i = pow(max(.72 - dot(vNormal, vec3(0., 0., 1.)), 0.), 3.2);
        gl_FragColor = vec4(uColor * i * 2.4, i);
      }`,
  }), []);
  return (
    <mesh material={material} scale={1.2}>
      <sphereGeometry args={[1, 64, 64]} />
    </mesh>
  );
}

/* ——— Liaisons réseau entre points (dont La Réunion) avec paquets lumineux ——— */
function Links() {
  const arcs = useMemo(() => {
    const rand = (seed: number) => { const x = Math.sin(seed * 9301.1) * 49297.3; return x - Math.floor(x); };
    const point = (s: number) => latLon(rand(s) * 140 - 70, rand(s + 7.3) * 360 - 180, 1.005);
    const list: { geometry: THREE.TubeGeometry; material: THREE.ShaderMaterial }[] = [];
    for (let i = 0; i < 12; i++) {
      const a = i < 6 ? REUNION.clone() : point(i * 3.1 + 1);
      const b = point(i * 5.7 + 11);
      const mid = a.clone().add(b).normalize().multiplyScalar(1 + a.distanceTo(b) * 0.38);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOffset: { value: rand(i + 3.3) }, uColor: { value: i < 6 ? CREAM : ACCENT }, uFade: { value: 1 } },
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: /* glsl */ `
          uniform float uTime; uniform float uOffset; uniform vec3 uColor; uniform float uFade; varying vec2 vUv;
          void main(){
            float head = fract(uTime * .22 + uOffset);
            float d = vUv.x - head;
            float trail = smoothstep(-.22, 0., d) * (1. - smoothstep(0., .015, d));
            float a = .1 + trail * 1.3;
            gl_FragColor = vec4(uColor * (.6 + trail) * uFade, a * uFade);
          }`,
      });
      list.push({ geometry: new THREE.TubeGeometry(curve, 72, 0.0045, 6, false), material });
    }
    return list;
  }, []);
  useFrame((state) => {
    // Les liaisons s'effacent pendant la plongée (sinon elles deviennent d'énormes faisceaux)
    const fade = 1 - THREE.MathUtils.smoothstep(planetState.dive, 0.18, 0.42);
    arcs.forEach(({ material }) => { material.uniforms.uTime.value = state.clock.elapsedTime; material.uniforms.uFade.value = fade; });
  });
  return <group>{arcs.map((arc, i) => <mesh key={i} geometry={arc.geometry} material={arc.material} />)}</group>;
}

/* ——— Balise La Réunion + étiquette HTML qui la suit ——— */
function Beacon({ label }: { label: React.RefObject<HTMLDivElement> }) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const tmp = useMemo(() => ({ world: new THREE.Vector3(), center: new THREE.Vector3(), toCam: new THREE.Vector3(), normal: new THREE.Vector3() }), []);
  // Oriente la balise vers l'extérieur de la planète (axe Z local = normale au sol)
  const orientation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), REUNION.clone().normalize()), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (pulse.current) {
      const k = (t * 0.8) % 1;
      pulse.current.scale.setScalar(1 + k * 3);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.9;
    }
    if (!group.current || !label.current) return;
    // La balise disparaît quand on fonce dessus
    group.current.scale.setScalar(Math.max(0.001, 1 - THREE.MathUtils.smoothstep(planetState.dive, 0.18, 0.4)));
    group.current.getWorldPosition(tmp.world);
    group.current.parent!.getWorldPosition(tmp.center);
    tmp.normal.copy(tmp.world).sub(tmp.center).normalize();
    tmp.toCam.copy(camera.position).sub(tmp.world).normalize();
    const facing = THREE.MathUtils.smoothstep(tmp.normal.dot(tmp.toCam), 0.05, 0.35);
    const v = tmp.world.clone().project(camera);
    label.current.style.transform = `translate3d(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px, 0)`;
    const diveFade = 1 - THREE.MathUtils.smoothstep(planetState.dive, 0.02, 0.18);
    label.current.style.opacity = String(facing * diveFade * (planetState.ready ? 1 : 0));
  });

  return (
    <group position={REUNION}>
      <group ref={group} quaternion={orientation}>
        <mesh><sphereGeometry args={[0.02, 16, 16]} /><meshBasicMaterial color={CREAM} toneMapped={false} /></mesh>
        <mesh ref={pulse}><ringGeometry args={[0.022, 0.03, 40]} /><meshBasicMaterial color={ACCENT} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} /></mesh>
        <mesh position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.003, 0.003, 0.14, 6]} /><meshBasicMaterial color={CREAM} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

/* ——— Anneau + poussière ——— */
function Ring() {
  const dust = useRef<THREE.Points>(null);
  const material = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    uniforms: { uAccent: { value: ACCENT }, uCream: { value: CREAM } },
    vertexShader: /* glsl */ `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: NOISE + /* glsl */ `
      uniform vec3 uAccent; uniform vec3 uCream; varying vec3 vPos;
      void main(){
        float t = (length(vPos.xy) - 1.5) / .85;
        float bands = .5 + .5 * sin(t * 70.) * .5 + snoise(vec3(t * 18., 0., 0.)) * .3;
        float a = smoothstep(0., .08, t) * (1. - smoothstep(.82, 1., t)) * (.18 + bands * .32);
        a *= 1. - (smoothstep(.44, .47, t) * (1. - smoothstep(.53, .56, t))) * .85;
        gl_FragColor = vec4(mix(uAccent, uCream, t), a);
      }`,
  }), []);
  const dustGeometry = useMemo(() => {
    const count = 2200;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.55 + Math.random() * 0.75;
      arr.set([Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 0.03], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((_, dt) => { if (dust.current) dust.current.rotation.z += dt * 0.03; });
  return (
    <group rotation={[-Math.PI / 2 + 0.36, 0, 0.28]}>
      <mesh material={material}><ringGeometry args={[1.5, 2.35, 180, 1]} /></mesh>
      <points ref={dust} geometry={dustGeometry}>
        <pointsMaterial color={CREAM} size={1.4} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} />
      </points>
    </group>
  );
}

/* ——— Lune en orbite ——— */
function Moon() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.18;
    ref.current?.position.set(Math.cos(t) * 3.1, Math.sin(t) * 0.55, Math.sin(t) * 3.1);
    ref.current?.scale.setScalar(Math.max(0.001, 1 - THREE.MathUtils.smoothstep(planetState.dive, 0, 0.3)));
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.1, 32, 32]} />
      <meshStandardMaterial color="#9c8f84" roughness={1} />
    </mesh>
  );
}

/* ——— Étoiles ——— */
function Stars() {
  const geometry = useMemo(() => {
    const count = 900;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(9 + Math.random() * 12);
      arr.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.004;
    ref.current.position.z = THREE.MathUtils.damp(ref.current.position.z, Math.pow(planetState.dive, 1.6) * 14, 6, dt);
  });
  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial color={CREAM} size={1.2} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/* ——— Assemblage + mouvements (intro, souris, scroll) ——— */
function System({ label, reduced }: { label: React.RefObject<HTMLDivElement>; reduced: boolean }) {
  const system = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const intro = useRef(reduced ? 1 : 0);
  const dive = useRef(0);
  const freeSpin = useRef(0);
  const size = useThree((s) => s.size);

  useFrame((_, dt) => {
    if (!system.current || !spin.current) return;
    const { damp, clamp, lerp, smoothstep } = THREE.MathUtils;
    if (planetState.ready && intro.current < 1) intro.current = Math.min(1, intro.current + dt / 2.2);
    const i = 1 - Math.pow(1 - intro.current, 3);
    const aspect = size.width / size.height;
    const fit = clamp(aspect / 1.15, 0.62, 1);

    // Plongée : 0 = hero normal, 1 = surface de La Réunion juste devant la caméra
    dive.current = damp(dive.current, planetState.dive, 7, dt);
    const d = dive.current;
    const center = smoothstep(d, 0, 0.32);             // la planète vient au centre, La Réunion face à nous
    const zoom = Math.pow(smoothstep(d, 0.1, 0.92), 1.8); // puis on fonce dessus (accélération)

    // Rotation libre, qui converge vers La Réunion pendant la plongée
    if (!reduced) freeSpin.current += dt * 0.07 * (1 - center);
    const target = REUNION_YAW + Math.round((freeSpin.current - REUNION_YAW) / (Math.PI * 2)) * Math.PI * 2;
    spin.current.rotation.y = lerp(freeSpin.current, target, center);

    const free = 1 - center;
    system.current.rotation.x = damp(system.current.rotation.x, lerp(0.18 + planetState.py * 0.22, REUNION_PITCH, center), 3 + center * 5, dt);
    system.current.rotation.y = damp(system.current.rotation.y, (planetState.px * 0.35 - (1 - i) * 1.2) * free, 3 + center * 5, dt);
    system.current.rotation.z = -0.32 * free;
    system.current.position.x = (aspect > 1 ? 1.25 * fit : 0) * free;
    system.current.position.y = (aspect < 0.9 ? 0.55 : 0) * free;
    const base = (0.55 + i * 0.45) * fit;
    system.current.scale.setScalar(Math.max(0.001, lerp(base, DIVE_SCALE, zoom)));
  });

  return (
    <group ref={system} rotation={[0.18, 0, -0.32]}>
      <group ref={spin}>
        <Core />
        <DotLand />
        <Links />
        <Beacon label={label} />
      </group>
      <Atmosphere />
      <Ring />
      <Moon />
    </group>
  );
}

const Planet = ({ label, visible }: { label: React.RefObject<HTMLDivElement>; visible: boolean }) => {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return (
    <Canvas
      dpr={[1, coarse ? 1.3 : 1.6]}
      gl={{ antialias: !coarse, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 35, near: 0.1, far: 100, position: [0, 0, 7] }}
      frameloop={reduced ? 'demand' : visible ? 'always' : 'never'}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[-6, 4, 5]} intensity={2.2} />
      <Stars />
      <System label={label} reduced={reduced} />
    </Canvas>
  );
};

export default Planet;
