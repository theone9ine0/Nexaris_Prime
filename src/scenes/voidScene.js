import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';

/**
 * Void dimension — starfield and a single anchor shard.
 */
export class VoidScene extends SceneBase {
  constructor() {
    super('void');
    this.cameraPosition.set(0, 0.2, 5);
    this.scene.background = new THREE.Color(0x020208);
    this._stars = null;
  }

  _buildContent() {
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(
          new Float32Array(
            Array.from({ length: 400 * 3 }, () => (Math.random() - 0.5) * 30),
          ),
          3,
        ),
      ),
      new THREE.PointsMaterial({ color: 0x99bbee, size: 0.04, transparent: true }),
    );
    this.scene.add(stars);
    this._stars = stars;

    this.scene.add(new THREE.AmbientLight(0x0a0a18, 0.5));

    this.shardManager.createShard({
      id: 'void_anchor',
      color: 0x6688cc,
      position: { x: 0, y: 0, z: 0.5 },
      animation: 'both',
    });
  }

  configureEffects(effects) {
    effects.setSceneEffects({
      bloom: { strength: 0.6, radius: 0.65, threshold: 0.12 },
      colorGrading: { saturation: 0.95, tint: 0x334466, vignette: 0.4 },
    });
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._stars) {
      this._stars.rotation.y = this._elapsed * 0.03;
    }
  }

  dispose() {
    if (this._stars) {
      this._stars.geometry.dispose();
      this._stars.material.dispose();
      this._stars = null;
    }
    super.dispose();
  }
}
