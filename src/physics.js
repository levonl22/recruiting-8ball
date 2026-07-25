import { Vector3 } from "three";

const MAX_STEP = 1 / 180;

/**
 * Damped spring on a 3-vector. Used for the shell's positional recoil, its
 * rotational wobble, and the die's tumble. Rest state is always zero, so the
 * ball naturally settles back to facing the camera.
 */
export class Spring3 {
  constructor({ stiffness, damping }) {
    this.stiffness = stiffness;
    this.damping = damping;
    this.value = new Vector3();
    this.velocity = new Vector3();
    this._accel = new Vector3();
  }

  impulse(x, y, z = 0) {
    this.velocity.x += x;
    this.velocity.y += y;
    this.velocity.z += z;
  }

  update(dt) {
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h = dt / steps;

    for (let i = 0; i < steps; i += 1) {
      this._accel
        .copy(this.value)
        .multiplyScalar(-this.stiffness)
        .addScaledVector(this.velocity, -this.damping);
      this.velocity.addScaledVector(this._accel, h);
      this.value.addScaledVector(this.velocity, h);
    }
  }

  isAtRest(epsilon = 0.0008) {
    return this.value.length() < epsilon && this.velocity.length() < epsilon;
  }
}
