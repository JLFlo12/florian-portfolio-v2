import * as THREE from 'three';
import type { CameraKey } from '@/components/station/scrollTimeline';

/* ───────────────────────────────────────────────────────────────
   CameraController : la caméra suit une courbe continue définie par les plans
   de la timeline. Chaque grandeur (position, cible, focale, décalage optique)
   est interpolée par une cubique monotone (méthode de Steffen) : la courbe passe
   par chaque plan sans le dépasser (pas de rebond dans la coque d'un module),
   la vitesse varie sans à-coup et s'annule aux points de retournement.
   Par-dessus : léger mouvement lié à la souris, flottement très lent,
   inclinaison dans les virages, adaptation aux écrans verticaux.
   ─────────────────────────────────────────────────────────────── */

const CH = 8; // px py pz tx ty tz fov shift

class Steffen {
  private m: Float64Array;
  constructor(private x: Float64Array, private y: Float64Array) {
    const n = x.length;
    this.m = new Float64Array(n);
    for (let i = 1; i < n - 1; i++) {
      const h0 = x[i] - x[i - 1];
      const h1 = x[i + 1] - x[i];
      const s0 = (y[i] - y[i - 1]) / h0;
      const s1 = (y[i + 1] - y[i]) / h1;
      const p = (s0 * h1 + s1 * h0) / (h0 + h1);
      this.m[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p));
    }
  }
  at(t: number, i: number) {
    const { x, y, m } = this;
    const h = x[i + 1] - x[i];
    const u = (t - x[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * y[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * y[i + 1] + (u3 - u2) * h * m[i + 1];
  }
}

export class CameraController {
  private ts: Float64Array;
  private splines: Steffen[] = [];
  private out = new Float64Array(CH);
  private pos = new THREE.Vector3();
  private target = new THREE.Vector3();
  private sway = new THREE.Vector2();
  private roll = 0;
  private lastYaw = NaN;
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private upv = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(keys: CameraKey[]) {
    // Clés strictement croissantes
    const clean = keys.filter((k, i) => i === 0 || k.t > keys[i - 1].t + 1e-6);
    this.ts = Float64Array.from(clean.map((k) => k.t));
    for (let c = 0; c < CH; c++) {
      const ys = Float64Array.from(clean.map(({ shot }) => [shot.pos[0], shot.pos[1], shot.pos[2], shot.target[0], shot.target[1], shot.target[2], shot.fov, shot.shift ?? 0][c]));
      this.splines.push(new Steffen(this.ts, ys));
    }
  }

  sample(t: number) {
    const ts = this.ts;
    const n = ts.length;
    const x = Math.min(ts[n - 1], Math.max(ts[0], t));
    let i = 0;
    let hi = n - 2;
    while (i < hi) { const mid = (i + hi + 1) >> 1; if (ts[mid] <= x) i = mid; else hi = mid - 1; }
    for (let c = 0; c < CH; c++) this.out[c] = this.splines[c].at(x, i);
    return this.out;
  }

  /** Pose la caméra pour la progression t. pointer : -1..1 ; drift : flottement (animations d'ambiance). */
  apply(camera: THREE.PerspectiveCamera, t: number, dt: number, pointer: THREE.Vector2, time: number, drift: boolean, width: number, height: number) {
    const s = this.sample(t);
    const aspect = width / height;
    this.pos.set(s[0], s[1], s[2]);
    this.target.set(s[3], s[4], s[5]);
    let fov = s[6];
    const shift = s[7];
    // Écran vertical : on recule un peu et on ouvre la focale pour garder le module entier
    const tall = Math.max(0, Math.min(1, (1.15 - aspect) / 0.7));
    if (tall > 0) {
      this.pos.sub(this.target).multiplyScalar(1 + tall * 0.55).add(this.target);
      fov = Math.min(78, fov * (1 + tall * 0.55));
    }
    camera.position.copy(this.pos);

    // Souris (amorti) et flottement très lent
    const k = 1 - Math.exp(-dt * 2.6);
    this.sway.x += (pointer.x - this.sway.x) * k;
    this.sway.y += (pointer.y - this.sway.y) * k;
    const fx = this.sway.x * 0.03 + (drift ? Math.sin(time * 0.21) * 0.004 + Math.sin(time * 0.083) * 0.003 : 0);
    const fy = -this.sway.y * 0.02 + (drift ? Math.sin(time * 0.17 + 1.3) * 0.003 : 0);
    const forward = this.fwd.copy(this.target).sub(this.pos);
    const dist = forward.length();
    forward.normalize();
    const right = this.right.crossVectors(forward, camera.up.set(0, 1, 0)).normalize();
    const up = this.upv.crossVectors(right, forward);
    forward.addScaledVector(right, fx).addScaledVector(up, fy).normalize();

    // Inclinaison dans les virages : proportionnelle à la vitesse de rotation réelle
    const yaw = Math.atan2(forward.x, forward.z);
    if (!Number.isNaN(this.lastYaw) && dt > 0) {
      let d = yaw - this.lastYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const target = Math.max(-0.05, Math.min(0.05, (-d / dt) * 0.09));
      this.roll += (target - this.roll) * (1 - Math.exp(-dt * 3));
    }
    this.lastYaw = yaw;
    camera.up.set(0, 1, 0).applyAxisAngle(forward, this.roll);
    camera.lookAt(this.look.copy(this.pos).addScaledVector(forward, dist));

    // Plan proche adapté à la distance (précision du tampon de profondeur de près comme de loin)
    camera.near = Math.min(20, Math.max(0.35, dist * 0.015));
    camera.far = 30000;
    camera.fov = fov;
    camera.aspect = aspect;
    // Décalage optique : le module se place à gauche (ou en haut sur écran vertical) pour laisser la place au panneau
    if (Math.abs(shift) > 1e-3) {
      const ox = tall > 0.5 ? 0 : shift * 0.5 * width;
      const oy = tall > 0.5 ? shift * 0.6 * height : 0;
      camera.setViewOffset(width, height, ox, oy, width, height);
    } else {
      camera.clearViewOffset();
    }
    camera.updateProjectionMatrix();
    return dist;
  }
}
