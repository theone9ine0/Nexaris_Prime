import * as THREE from 'three';

const _pos = new THREE.Vector3();

/**
 * Orbiting additive point particles for aura effects.
 */
export class AuraParticles {
  /**
   * @param {THREE.Object3D} owner
   * @param {THREE.Scene} scene
   */
  constructor(owner, scene) {
    this.owner = owner;
    this.scene = scene;
    this.maxCount = 36;
    this.count = 24;
    this.color = new THREE.Color(0x66aaff);
    this.rate = 14;
    this._spawnAcc = 0;
    this._phase = Math.random() * Math.PI * 2;

    const positions = new Float32Array(this.maxCount * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.22,
      color: this.color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);

    /** @type {{ angle: number, height: number, radius: number, speed: number, life: number }[]} */
    this._orbs = [];
    for (let i = 0; i < this.count; i++) {
      this._orbs.push({
        angle: (i / this.count) * Math.PI * 2,
        height: 0.5 + Math.random() * 1.2,
        radius: 0.55 + Math.random() * 0.35,
        speed: 0.8 + Math.random() * 1.2,
        life: Math.random(),
      });
    }
  }

  /**
   * @param {number} color
   * @param {number} rate
   */
  setStyle(color, rate) {
    this.color.setHex(color);
    this.material.color.copy(this.color);
    this.rate = rate;
  }

  /**
   * @param {number} intensity 0–1+
   * @param {number} deltaTime
   */
  update(intensity, deltaTime) {
    const dt = Math.min(deltaTime, 0.05);
    this._phase += dt;
    this.material.opacity = THREE.MathUtils.clamp(0.35 + intensity * 0.55, 0, 1);
    this.material.size = 0.15 + intensity * 0.18;

    this.owner.getWorldPosition(_pos);
    const positions = this.points.geometry.attributes.position;
    const active = Math.min(this.count, Math.floor(this.maxCount * (0.4 + intensity * 0.6)));

    for (let i = 0; i < active; i++) {
      const orb = this._orbs[i];
      orb.angle += orb.speed * dt * (0.8 + intensity);
      const r = orb.radius * (0.9 + Math.sin(this._phase * 2 + i) * 0.1 * intensity);
      const x = _pos.x + Math.cos(orb.angle) * r;
      const y = _pos.y + orb.height + Math.sin(this._phase * 3 + i) * 0.15 * intensity;
      const z = _pos.z + Math.sin(orb.angle) * r;
      positions.setXYZ(i, x, y, z);
    }

    for (let i = active; i < this.maxCount; i++) {
      positions.setXYZ(i, _pos.x, _pos.y - 99, _pos.z);
    }

    positions.needsUpdate = true;
    this.count = active;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
