import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/* ───────────────────────────────────────────────────────────────
   Structures industrielles posées sur la poutre principale :
   « Space Station Modules » par re1monsen (Sketchfab, licence CC BY 4.0, crédité dans les mentions légales).
   Préparé dans Blender : un seul des deux assemblages, centré sur son plateau, axe long sur X,
   textures 2K en WebP, géométrie Draco (public/station/industrial.glb, ≈ 3,3 Mo).
   Pièces : blocks_a, blocks_b, scatter, rails, plate, cables (sous le plateau), lights (points semés autour, non utilisés).
   ─────────────────────────────────────────────────────────────── */

const MODEL = '/station/industrial.glb';

/** Étendue des blocs principaux (unités du modèle) : les points lumineux débordent au-delà. */
export const INDUSTRIAL = { x0: -93, x1: 71, top: 7.1, bottom: -8.4 };

export interface IndustrialKit {
  parts: Map<string, THREE.Mesh>;
  dispose(): void;
}

/** Charge le modèle et remplace ses matériaux par des matériaux standard (moins coûteux que clearcoat / specular). */
export async function loadIndustrial(): Promise<IndustrialKit> {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  try {
    const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL);
    const parts = new Map<string, THREE.Mesh>();
    const materials = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const textures = new Set<THREE.Texture>();
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      let mat = materials.get(src);
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          map: src.map, normalMap: src.normalMap, normalScale: src.normalScale,
          roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap,
          roughness: src.roughness, metalness: src.metalness,
          emissiveMap: src.emissiveMap, emissive: new THREE.Color(0xff9a52), emissiveIntensity: 1.5,
          envMapIntensity: 0.8,
        });
        // Rugosité minimale : certaines faces planes du modèle, presque miroirs, renvoyaient le soleil en taches blanches
        mat.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = max(roughnessFactor, 0.5);');
        };
        mat.customProgramCacheKey = () => 'station-industrial';
        for (const t of [src.map, src.normalMap, src.roughnessMap, src.metalnessMap, src.emissiveMap]) if (t) textures.add(t);
        src.dispose();
        materials.set(src, mat);
      }
      mesh.material = mat;
      parts.set(mesh.name, mesh);
    });
    return {
      parts,
      dispose() {
        parts.forEach((m) => m.geometry.dispose());
        materials.forEach((m) => m.dispose());
        textures.forEach((t) => t.dispose());
      },
    };
  } finally {
    draco.dispose();
  }
}

/**
 * Pose un exemplaire de la structure : longueur voulue (axe X), position du centre des blocs,
 * sans certaines pièces (ex. les câbles quand la structure est posée sur la poutre).
 * Les géométries et le matériau sont partagés entre les exemplaires.
 */
export function placeIndustrial(kit: IndustrialKit, target: THREE.Object3D, opts: { length: number; center: THREE.Vector3; flip?: boolean; skip?: string[]; shadows: boolean }) {
  const s = opts.length / (INDUSTRIAL.x1 - INDUSTRIAL.x0);
  const g = new THREE.Group();
  const mid = (INDUSTRIAL.x0 + INDUSTRIAL.x1) / 2;
  g.scale.setScalar(s);
  g.rotation.y = opts.flip ? Math.PI : 0;
  g.position.copy(opts.center).add(new THREE.Vector3((opts.flip ? 1 : -1) * mid * s, 0, 0));
  for (const [name, mesh] of kit.parts) {
    if (opts.skip?.includes(name)) continue;
    const m = new THREE.Mesh(mesh.geometry, mesh.material);
    m.name = name;
    m.castShadow = opts.shadows && name !== 'lights';
    m.receiveShadow = opts.shadows;
    g.add(m);
  }
  target.add(g);
  return { group: g, scale: s };
}
