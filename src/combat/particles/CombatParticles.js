import * as THREE from 'three';
import { createCombatSpriteSheet } from './spriteTexture.js';

const _worldPos = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, 1);

/**
 * Stylized additive combat VFX (sparks, bursts, dash trails).
 */
export class CombatParticles {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this.scene = scene;
    const sheet = createCombatSpriteSheet(96);
    this.texture = new THREE.CanvasTexture(sheet);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;

    /** @type {CombatParticle[]} */
    this._particles = [];
    this._maxParticles = 80;
  }

  /**
   * @param {THREE.Vector3} position
   * @param {number} [color]
   */
  spawnHitSpark(position, color = 0xaaddff) {
    for (let i = 0; i < 8; i++) {
      this._spawn({
        type: 'spark',
        position: position.clone(),
        frame: 0,
        life: 0.25 + Math.random() * 0.15,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4,
          Math.random() * 2 + 0.5,
          (Math.random() - 0.5) * 4,
        ),
        scale: 0.25 + Math.random() * 0.2,
        color,
      });
    }
  }

  /**
   * @param {THREE.Vector3} position
   * @param {number} radius
   * @param {number} [color]
   */
  spawnEnergyBurst(position, radius = 2.5, color = 0x66ccff) {
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      this._spawn({
        type: 'burst',
        position: position.clone(),
        frame: 2,
        life: 0.45 + Math.random() * 0.2,
        velocity: new THREE.Vector3(
          Math.cos(angle) * radius * 2.5,
          0.3 + Math.random() * 0.8,
          Math.sin(angle) * radius * 2.5,
        ),
        scale: 0.5 + Math.random() * 0.4,
        color,
      });
    }
    this._spawnRing(position, radius, color);
  }

  /**
   * @param {THREE.Object3D} object
   * @param {number} duration
   */
  spawnDashTrail(object, duration = 0.35) {
    object.getWorldPosition(_worldPos);
    for (let i = 0; i < 6; i++) {
      this._spawn({
        type: 'trail',
        position: _worldPos.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6, (Math.random() - 0.5) * 0.4),
        ),
        frame: 3,
        life: duration * (0.6 + Math.random() * 0.4),
        velocity: new THREE.Vector3(0, 0.2, 0),
        scale: 0.35,
        color: 0x88eeff,
      });
    }
  }

  /**
   * @param {THREE.Vector3} position
   * @param {number} [color]
   */
  spawnAuraFlare(position, color = 0xaa88ff) {
    this._spawnRing(position, 1.2, color);
    for (let i = 0; i < 5; i++) {
      this._spawn({
        type: 'spark',
        position: position.clone(),
        frame: 1,
        life: 0.5,
        velocity: new THREE.Vector3(0, 0.8, 0),
        scale: 0.4,
        color,
      });
    }
  }

  /**
   * @param {THREE.Vector3} position
   * @param {number} radius
   * @param {number} color
   */
  _spawnRing(position, radius, color) {
    const sprite = this._makeSprite(1, color, 1);
    sprite.position.copy(position);
    sprite.position.y += 0.2;
    sprite.scale.setScalar(radius);
    this.scene.add(sprite);
    this._particles.push({
      sprite,
      type: 'ring',
      life: 0.35,
      maxLife: 0.35,
      velocity: new THREE.Vector3(),
      frame: 1,
    });
  }

  /**
   * @param {object} spec
   */
  _spawn(spec) {
    if (this._particles.length >= this._maxParticles) {
      this._particles.shift()?.sprite.removeFromParent();
    }

    const sprite = this._makeSprite(spec.scale, spec.color, spec.frame);
    sprite.position.copy(spec.position);
    this.scene.add(sprite);

    this._particles.push({
      sprite,
      type: spec.type,
      life: spec.life,
      maxLife: spec.life,
      velocity: spec.velocity,
      frame: spec.frame,
    });
  }

  /**
   * @param {number} scale
   * @param {number} color
   * @param {number} frame
   */
  _makeSprite(scale, color, frame) {
    const mat = new THREE.SpriteMaterial({
      map: this.texture,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 1,
    });
    mat.map.offset.x = frame / 4;
    mat.map.repeat.x = 0.25;

    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 10;
    return sprite;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.05);

    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.removeFromParent();
        p.sprite.material.dispose();
        this._particles.splice(i, 1);
        continue;
      }

      const t = 1 - p.life / p.maxLife;
      p.sprite.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(0.92);

      if (p.type === 'ring') {
        p.sprite.scale.multiplyScalar(1 + dt * 2.5);
        p.sprite.material.opacity = 1 - t;
      } else {
        p.sprite.material.opacity = 1 - t * t;
        p.sprite.scale.setScalar((0.2 + (1 - t) * 0.5) * (p.type === 'burst' ? 1.4 : 1));
      }
    }
  }

  dispose() {
    for (const p of this._particles) {
      p.sprite.removeFromParent();
      p.sprite.material.dispose();
    }
    this._particles = [];
    this.texture.dispose();
  }
}
