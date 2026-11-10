import * as THREE from 'three';

const MIN_DISTANCE = 75;
const MAX_DISTANCE = 650;

/** Caméra extérieure : orbite autour du vaisseau, suit ses rotations avec un léger retard. */
export class ChaseCamera {
  azimuth = 0;
  elevation = 0.2;
  private distance = 150;
  private targetDistance = 150;
  private frame = new THREE.Quaternion();
  private fov = 52;
  private pull = 0;
  private offset = new THREE.Vector3();
  private look = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  snapTo(shipQuaternion: THREE.Quaternion) { this.frame.copy(shipQuaternion); }

  setDistance(distance: number, immediate = false) {
    this.targetDistance = distance;
    if (immediate) this.distance = distance;
  }

  orbit(dx: number, dy: number, wheel: number) {
    this.azimuth -= dx * 0.005;
    this.elevation = THREE.MathUtils.clamp(this.elevation + dy * 0.004, -1.25, 1.4);
    if (wheel) this.targetDistance = THREE.MathUtils.clamp(this.targetDistance * (1 + wheel * 0.13), MIN_DISTANCE, MAX_DISTANCE);
  }

  /**
   * @param speedRatio vitesse / vitesse maximale de croisière (0 à 1)
   * @param surge accélération longitudinale normalisée
   */
  update(dt: number, shipQuaternion: THREE.Quaternion, speedRatio: number, surge: number, boosting: boolean, time: number) {
    this.frame.slerp(shipQuaternion, 1 - Math.exp(-dt * 2.4));
    this.distance += (this.targetDistance - this.distance) * (1 - Math.exp(-dt * 5));
    this.pull += (surge - this.pull) * (1 - Math.exp(-dt * 2));

    const cosE = Math.cos(this.elevation);
    this.offset
      .set(Math.sin(this.azimuth) * cosE, Math.sin(this.elevation), Math.cos(this.azimuth) * cosE)
      .multiplyScalar(this.distance * (1 + this.pull * 0.1));
    // Vibration discrète en surrégime
    if (boosting) {
      this.offset.x += Math.sin(time * 61) * 0.25;
      this.offset.y += Math.sin(time * 47 + 1.3) * 0.25;
    }
    this.camera.position.copy(this.offset).applyQuaternion(this.frame);
    this.camera.up.set(0, 1, 0).applyQuaternion(this.frame);
    this.look.set(0, this.distance * 0.06, -this.distance * 0.1).applyQuaternion(this.frame);
    this.camera.lookAt(this.look);

    const targetFov = 52 + 13 * Math.sqrt(Math.min(1, speedRatio)) + (boosting ? 5 : 0);
    this.fov += (targetFov - this.fov) * (1 - Math.exp(-dt * 2.5));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
