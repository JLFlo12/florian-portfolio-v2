import * as THREE from 'three';
import type { Input } from '../core/input';
import type { EngineState } from '../core/store';

const IMPULSE = { maxSpeed: 140, acceleration: 55, turn: 0.85 };
const CRUISE = { maxSpeed: 3200, acceleration: 650, turn: 0.42 };

const FORWARD = new THREE.Vector3(0, 0, -1);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export interface ShipSnapshot {
  position: [number, number, number];
  velocity: [number, number, number];
  quaternion: [number, number, number, number];
  cruise: boolean;
  energy: number;
}

/** Pilotage d'AETHER-01 : poussée, inertie, assistance de vol, croisière et surrégime. */
export class ShipController {
  /** Position dans l'univers (nombres JS = double précision). Le rendu, lui, garde le vaisseau à l'origine. */
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly quaternion = new THREE.Quaternion();
  readonly forward = new THREE.Vector3(0, 0, -1);
  yawRate = 0;
  pitchRate = 0;
  cruise = false;
  energy = 100;
  /** Niveau de poussée visible sur les moteurs. */
  power = 0;
  /** Accélération longitudinale normalisée, pour la caméra et l'animation. */
  surge = 0;
  boosting = false;
  state: EngineState = 'Arrêt';
  /** Modificateurs apportés par les améliorations. */
  mods = { thrust: 1, topSpeed: 1, energyMax: 100, regen: 7 };

  private lateral = new THREE.Vector3();
  private q = new THREE.Quaternion();

  get maxSpeed() { return (this.cruise ? CRUISE : IMPULSE).maxSpeed; }

  /** @param drain énergie perdue par seconde (radiations) */
  update(dt: number, input: Input | null, gravity: THREE.Vector3, drain = 0) {
    const mode = this.cruise ? CRUISE : IMPULSE;
    const thrust = !!input && input.down('KeyW');
    const reverse = !!input && input.down('KeyS');
    const brake = !!input && input.down('Space');
    const shift = !!input && (input.down('ShiftLeft') || input.down('ShiftRight'));
    const yawInput = input ? Number(input.down('KeyA') || input.down('ArrowLeft')) - Number(input.down('KeyD') || input.down('ArrowRight')) : 0;
    const pitchInput = input ? Number(input.down('ArrowUp')) - Number(input.down('ArrowDown')) : 0;

    // Rotation, avec une mise en mouvement progressive
    const ease = 1 - Math.exp(-dt * 3.5);
    this.yawRate += (yawInput * mode.turn - this.yawRate) * ease;
    this.pitchRate += (pitchInput * mode.turn * 0.8 - this.pitchRate) * ease;
    this.quaternion.multiply(this.q.setFromAxisAngle(Y_AXIS, this.yawRate * dt));
    this.quaternion.multiply(this.q.setFromAxisAngle(X_AXIS, this.pitchRate * dt));
    this.quaternion.normalize();
    this.forward.copy(FORWARD).applyQuaternion(this.quaternion);

    // Surrégime : plus de poussée tant qu'il reste de l'énergie
    this.boosting = shift && thrust && this.energy > 0;
    this.energy = THREE.MathUtils.clamp(this.energy + ((this.boosting ? -14 : this.mods.regen) - drain) * dt, 0, this.mods.energyMax);
    const acceleration = mode.acceleration * this.mods.thrust * (this.boosting ? 2.2 : 1);
    const maxSpeed = mode.maxSpeed * this.mods.topSpeed * (this.boosting ? 1.6 : 1);

    const before = this.velocity.dot(this.forward);
    if (thrust) this.velocity.addScaledVector(this.forward, acceleration * dt);
    if (reverse && this.velocity.dot(this.forward) > -mode.maxSpeed * 0.25) {
      this.velocity.addScaledVector(this.forward, -acceleration * 0.6 * dt);
    }
    if (brake) this.velocity.multiplyScalar(Math.exp(-(this.cruise ? 1.8 : 2.6) * dt));

    // Assistance de vol : la dérive latérale s'amortit, le vaisseau finit par aller où pointe le nez
    const along = this.velocity.dot(this.forward);
    this.lateral.copy(this.velocity).addScaledVector(this.forward, -along);
    this.velocity.addScaledVector(this.lateral, -(1 - Math.exp(-(this.cruise ? 1.1 : 1.6) * dt)));

    const speed = this.velocity.length();
    if (speed > maxSpeed) this.velocity.multiplyScalar(1 - (1 - maxSpeed / speed) * (1 - Math.exp(-2.5 * dt)));
    if (speed < 0.05 && !thrust && !reverse) this.velocity.set(0, 0, 0);

    this.surge += (THREE.MathUtils.clamp((this.velocity.dot(this.forward) - before) / (dt * mode.acceleration * 2.2 || 1), -1, 1) - this.surge) * (1 - Math.exp(-dt * 5));

    this.velocity.addScaledVector(gravity, dt);
    this.position.addScaledVector(this.velocity, dt);

    if (this.boosting) { this.state = 'Surrégime'; this.power = 1.5; }
    else if (thrust) { this.state = 'Poussée'; this.power = this.cruise ? 1.2 : 1; }
    else if (brake && speed > 0.5) { this.state = 'Freinage'; this.power = 0.12; }
    else if (reverse) { this.state = 'Rétro'; this.power = 0.2; }
    else if (speed > 0.5) { this.state = 'Inertie'; this.power = 0.06; }
    else { this.state = 'Arrêt'; this.power = 0.04; }
  }

  toggleCruise() { this.cruise = !this.cruise; }

  reset() {
    this.position.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.quaternion.identity();
    this.yawRate = this.pitchRate = 0;
    this.cruise = false;
    this.energy = this.mods.energyMax;
  }

  snapshot(): ShipSnapshot {
    return {
      position: this.position.toArray() as [number, number, number],
      velocity: this.velocity.toArray() as [number, number, number],
      quaternion: this.quaternion.toArray() as [number, number, number, number],
      cruise: this.cruise,
      energy: this.energy,
    };
  }

  restore(s: ShipSnapshot) {
    this.position.fromArray(s.position);
    this.velocity.fromArray(s.velocity);
    this.quaternion.fromArray(s.quaternion);
    this.cruise = s.cruise;
    this.energy = s.energy;
  }
}
