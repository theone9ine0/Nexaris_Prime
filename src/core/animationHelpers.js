import * as THREE from 'three';

/**
 * @typedef {{
 *   type: string,
 *   elapsed: number,
 *   phase: number,
 * }} AnimationState
 */

/**
 * @param {THREE.Object3D} object
 * @param {number} [amplitude]
 * @param {number} [speed]
 * @returns {AnimationState}
 */
export function floatAnimation(object, amplitude = 0.06, speed = 1.2) {
  return {
    type: 'float',
    object,
    amplitude,
    speed,
    axis: 'y',
    basePosition: object.position.clone(),
    elapsed: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

/**
 * @param {THREE.Object3D} object
 * @param {number} [intensity]
 * @param {number} [speed]
 * @returns {AnimationState}
 */
export function pulseAnimation(object, intensity = 0.05, speed = 2.5) {
  return {
    type: 'pulse',
    object,
    intensity,
    speed,
    baseScale: object.scale.clone(),
    elapsed: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

/**
 * @param {THREE.Object3D} object
 * @param {'x' | 'y' | 'z'} [axis]
 * @param {number} [speed] radians per second
 * @returns {AnimationState}
 */
export function rotateAnimation(object, axis = 'y', speed = 0.22) {
  return {
    type: 'rotate',
    object,
    axis,
    speed,
    baseRotation: object.rotation.clone(),
    elapsed: 0,
    phase: 0,
  };
}

/**
 * @param {THREE.Object3D} object
 * @param {{ x?: number, y?: number, z?: number }} [directionVector]
 * @param {number} [speed]
 * @returns {AnimationState}
 */
export function driftAnimation(object, directionVector = {}, speed = 1) {
  const dir = new THREE.Vector3(
    directionVector.x ?? 1,
    directionVector.y ?? 1,
    directionVector.z ?? 0.6,
  ).normalize();
  return {
    type: 'drift',
    object,
    direction: dir,
    speed,
    amplitude: 0.1,
    basePosition: object.position.clone(),
    elapsed: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

/**
 * @param {THREE.MeshStandardMaterial} material
 * @param {number} [intensity]
 * @param {number} [speed]
 * @returns {AnimationState}
 */
export function glowPulseAnimation(material, intensity = 0.5, speed = 2.5) {
  return {
    type: 'glowPulse',
    material,
    intensity,
    speed,
    baseIntensity: material.emissiveIntensity ?? 0.45,
    elapsed: 0,
    phase: Math.random() * Math.PI * 2,
  };
}

/**
 * @param {AnimationState[]} animations
 * @param {number} deltaTime
 */
export function applyAnimations(animations, deltaTime) {
  for (const anim of animations) {
    anim.elapsed += deltaTime;
    const t = anim.elapsed + anim.phase;

    switch (anim.type) {
      case 'float': {
        const offset = Math.sin(t * anim.speed) * anim.amplitude;
        if (anim.axis === 'x') {
          anim.object.position.x = anim.basePosition.x + offset;
        } else if (anim.axis === 'z') {
          anim.object.position.z = anim.basePosition.z + offset;
        } else {
          anim.object.position.y = anim.basePosition.y + offset;
        }
        break;
      }
      case 'pulse': {
        const p = (Math.sin(t * anim.speed) + 1) * 0.5;
        const s = 1 + p * anim.intensity;
        anim.object.scale.set(
          anim.baseScale.x * s,
          anim.baseScale.y * s,
          anim.baseScale.z,
        );
        break;
      }
      case 'rotate': {
        const r = anim.baseRotation[anim.axis] + t * anim.speed;
        anim.object.rotation[anim.axis] = r;
        break;
      }
      case 'drift': {
        const w = Math.sin(t * anim.speed * anim.direction.x) * anim.amplitude;
        const h = Math.sin(t * anim.speed * anim.direction.y) * anim.amplitude;
        const d = Math.cos(t * anim.speed * anim.direction.z) * anim.amplitude * 0.6;
        anim.object.position.set(
          anim.basePosition.x + w,
          anim.basePosition.y + h,
          anim.basePosition.z + d,
        );
        break;
      }
      case 'glowPulse': {
        const p = (Math.sin(t * anim.speed) + 1) * 0.5;
        anim.material.emissiveIntensity =
          anim.baseIntensity + p * anim.intensity;
        break;
      }
      default:
        break;
    }
  }
}
