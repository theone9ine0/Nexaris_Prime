import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';

/**
 * Crystal Cavern dimension — portal destination from Example scene.
 */
export class CrystalCavernScene extends SceneBase {
  constructor() {
    super('crystal_cave');
    this.spawnPoint = new THREE.Vector3(0, 0.5, 2);
    this.cameraPosition.set(0, 1.8, 9);
    this.scene.background = new THREE.Color(0x0a0818);
  }

  _buildContent() {
    this.scene.fog = new THREE.Fog(0x1a1030, 8, 36);
    this.scene.add(new THREE.AmbientLight(0x442266, 0.45));
    const key = new THREE.DirectionalLight(0xcc88ff, 0.85);
    key.position.set(-3, 8, 2);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    for (let i = 0; i < 12; i++) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35 + Math.random() * 0.5, 0),
        new THREE.MeshStandardMaterial({
          color: 0xaa66ff,
          emissive: 0xaa66ff,
          emissiveIntensity: 0.45,
          roughness: 0.2,
        }),
      );
      const angle = (i / 12) * Math.PI * 2;
      crystal.position.set(Math.cos(angle) * (4 + Math.random() * 4), 0.3, Math.sin(angle) * (4 + Math.random() * 4));
      this.scene.add(crystal);
    }

    this.shardManager.createShard({
      id: 'crystal_anchor',
      color: 0xaa66ff,
      position: { x: 0, y: 1.2, z: -2 },
      animation: 'glow',
    });
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._ensurePortals();
  }

  _ensurePortals() {
    if (this.portalManager || !this.sceneManagerRef) return;
    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'crystal_return_example',
      targetSceneId: 'example',
      position: new THREE.Vector3(0, 1.2, 4),
      color: 0x88aaff,
      radius: 0.85,
    });
  }

  configureEffects(effects) {
    effects.applyPreset({
      bloom: { strength: 0.55, radius: 0.6, threshold: 0.15 },
      colorGrading: { saturation: 1.2, tint: 0x8844cc, tintStrength: 0.18, vignette: 0.28 },
    });
  }
}
