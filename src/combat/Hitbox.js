import * as THREE from 'three';

const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();

/**
 * Invisible attack volume activated during animation windows.
 */
export class Hitbox {
  /**
   * @param {{
   *   owner: THREE.Object3D,
   *   radius?: number,
   *   offset?: THREE.Vector3,
   *   size?: THREE.Vector3,
   *   shape?: 'sphere' | 'box',
   * }} options
   */
  constructor(options) {
    this.owner = options.owner;
    this.shape = options.shape ?? 'sphere';
    this.radius = options.radius ?? 0.9;
    this.offset = options.offset?.clone() ?? new THREE.Vector3(0, 1, 0.6);
    this.size = options.size?.clone() ?? new THREE.Vector3(1.2, 1.4, 1.2);

    this.active = false;
    this.damage = 8;
    this.knockback = 3.5;
    this.hitTargets = new Set();

    /** @type {THREE.Mesh | null} */
    this._debugMesh = null;
  }

  /**
   * @param {{ start: number, end: number }} window normalized 0–1 of attack duration
   * @param {number} elapsed attack elapsed time
   * @param {number} duration attack total duration
   */
  updateWindow(window, elapsed, duration) {
    const t = elapsed / duration;
    const wasActive = this.active;
    this.active = t >= window.start && t <= window.end;
    if (!wasActive && this.active) {
      this.hitTargets.clear();
    }
    if (wasActive && !this.active) {
      this.hitTargets.clear();
    }
  }

  activate() {
    this.active = true;
    this.hitTargets.clear();
  }

  deactivate() {
    this.active = false;
    this.hitTargets.clear();
  }

  /**
   * @returns {THREE.Vector3}
   */
  getWorldCenter() {
    _center.copy(this.offset);
    this.owner.localToWorld(_center);
    return _center;
  }

  /**
   * @param {THREE.Object3D} target
   * @returns {boolean}
   */
  intersectsHurtbox(target) {
    const hurt = target.userData?.combatHurtbox;
    if (!hurt) return false;

    const targetPos = target.getWorldPosition(_center.clone());
    const hurtRadius = hurt.radius ?? 0.55;
    const hurtY = hurt.offsetY ?? 1;

    if (this.shape === 'sphere') {
      const hitCenter = this.getWorldCenter();
      const dist = hitCenter.distanceTo(
        targetPos.clone().add(new THREE.Vector3(0, hurtY, 0)),
      );
      return dist < this.radius + hurtRadius;
    }

    _box.setFromCenterAndSize(
      this.getWorldCenter(),
      this.size,
    );
    const targetBox = new THREE.Box3().setFromCenterAndSize(
      targetPos.clone().add(new THREE.Vector3(0, hurtY, 0)),
      new THREE.Vector3(hurtRadius * 2, hurtRadius * 2.2, hurtRadius * 2),
    );
    return _box.intersectsBox(targetBox);
  }

  /**
   * @param {THREE.Scene} scene
   * @param {boolean} visible
   */
  setDebugVisible(scene, visible) {
    if (!visible) {
      this._debugMesh?.removeFromParent();
      this._debugMesh = null;
      return;
    }
    if (this._debugMesh) return;

    const geo =
      this.shape === 'sphere'
        ? new THREE.SphereGeometry(this.radius, 8, 8)
        : new THREE.BoxGeometry(this.size.x, this.size.y, this.size.z);
    this._debugMesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xff4488,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      }),
    );
    scene.add(this._debugMesh);
  }

  /**
   * Sync debug mesh to hitbox position.
   */
  syncDebugMesh() {
    if (!this._debugMesh) return;
    this.getWorldCenter();
    this._debugMesh.position.copy(_center);
  }

  dispose() {
    this._debugMesh?.removeFromParent();
    this._debugMesh?.geometry.dispose();
    this._debugMesh?.material.dispose();
    this._debugMesh = null;
  }
}

/**
 * Register a stylized hurt volume on an avatar mesh.
 * @param {THREE.Object3D} object
 * @param {{ radius?: number, offsetY?: number }} [options]
 */
export function registerCombatHurtbox(object, options = {}) {
  object.userData.combatHurtbox = {
    radius: options.radius ?? 0.55,
    offsetY: options.offsetY ?? 1,
  };
}
