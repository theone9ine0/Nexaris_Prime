import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';

/**
 * Retro Console World — portal destination from Example scene.
 */
export class RetroConsoleScene extends SceneBase {
  constructor() {
    super('retro_console');
    this.spawnPoint = new THREE.Vector3(0, 0.5, 2);
    this.cameraPosition.set(0, 1.6, 9);
    this.scene.background = new THREE.Color(0x1a1a2e);
  }

  _buildContent() {
    this.scene.fog = new THREE.Fog(0x0f0f1a, 10, 40);
    this.scene.add(new THREE.AmbientLight(0x223344, 0.5));
    const key = new THREE.DirectionalLight(0x00ffaa, 0.7);
    key.position.set(0, 10, 5);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      new THREE.MeshStandardMaterial({ color: 0x16213e, metalness: 0.35, roughness: 0.7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(28, 28, 0x00ff88, 0x004433);
    grid.material.opacity = 0.35;
    grid.material.transparent = true;
    grid.position.y = 0.02;
    this.scene.add(grid);

    for (let i = 0; i < 8; i++) {
      const console = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.5, 1),
        new THREE.MeshStandardMaterial({
          color: 0x222233,
          emissive: 0x00ff88,
          emissiveIntensity: 0.35,
        }),
      );
      const angle = (i / 8) * Math.PI * 2;
      console.position.set(Math.cos(angle) * 5, 0.25, Math.sin(angle) * 5);
      console.rotation.y = -angle;
      this.scene.add(console);
    }

    this.shardManager.createShard({
      id: 'retro_anchor',
      color: 0x00ff88,
      position: { x: 0, y: 0.8, z: -2 },
      animation: 'both',
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
      id: 'retro_return_example',
      targetSceneId: 'example',
      position: new THREE.Vector3(0, 1.2, 4),
      color: 0x66ccff,
      radius: 0.85,
      frameStyle: 'arch',
    });
  }

  configureEffects(effects) {
    effects.applyPreset({
      bloom: { strength: 0.4, radius: 0.5, threshold: 0.2 },
      colorGrading: { saturation: 1.15, tint: 0x00aa66, tintStrength: 0.12, vignette: 0.2 },
    });
  }
}
