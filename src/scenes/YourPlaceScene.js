import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';
import { socialSession } from '../social/socialSession.js';
import { YOUR_PLACE_SCENE_ID } from '../social/types.js';
import { MAIN_WORLD_SCENE_ID } from './ScanChamberScene.js';
import { ACADEMY_SCENE_ID } from './academySceneIds.js';

export { YOUR_PLACE_SCENE_ID };

/**
 * PR52 — personal dimension (“Your Place”) for self or visiting friends.
 */
export class YourPlaceScene extends SceneBase {
  constructor() {
    super(YOUR_PLACE_SCENE_ID);
    this.cameraPosition.set(0, 2.5, 8);
    this.spawnPoint.set(0, 0.5, 3);
    this._uiOverlay = null;
    this._ownerLabel = null;
  }

  /**
   * @param {import('../ui/UIOverlay.js').UIOverlay} [uiOverlay]
   */
  mountUI(uiOverlay) {
    this._uiOverlay = uiOverlay;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x0c1020);
    this.scene.fog = new THREE.FogExp2(0x0c1020, 0.03);

    this.scene.add(new THREE.AmbientLight(0x556688, 0.45));
    const warm = new THREE.PointLight(0xffaa66, 1.1, 14);
    warm.position.set(-2, 3, 2);
    this.scene.add(warm);
    const cool = new THREE.PointLight(0x66aaff, 0.9, 14);
    cool.position.set(2, 2.5, -1);
    this.scene.add(cool);

    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1a2840,
        emissive: 0x223355,
        emissiveIntensity: 0.2,
        roughness: 0.85,
      }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.01;
    this.scene.add(rug);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.65, 0.35, 24),
      new THREE.MeshStandardMaterial({
        color: 0x334466,
        emissive: 0x4488aa,
        emissiveIntensity: 0.35,
        metalness: 0.7,
        roughness: 0.25,
      }),
    );
    pedestal.position.set(0, 0.18, 0);
    this.scene.add(pedestal);

    for (let i = 0; i < 5; i++) {
      const deco = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.35 + Math.random() * 0.2, 0.12),
        new THREE.MeshStandardMaterial({
          color: 0x6688aa,
          emissive: 0x4466aa,
          emissiveIntensity: 0.2,
        }),
      );
      const angle = (i / 5) * Math.PI * 2;
      deco.position.set(Math.cos(angle) * 2.5, 0.2, Math.sin(angle) * 2.5);
      this.scene.add(deco);
    }

    this.shardManager.createShard({
      id: 'place_anchor',
      color: 0x88ccff,
      position: { x: 0, y: 1.1, z: -1.2 },
      animation: 'pulse',
    });
  }

  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    const target = socialSession.visitTarget;
    const title = target?.ownerDisplayName ?? (target?.isOwnPlace ? 'Your Place' : 'Personal Dimension');
    this._ownerLabel = title;
    this._uiOverlay?.showYourPlaceBanner?.(title);
    this._setupPortals();
  }

  onExit(nextSceneId) {
    this._uiOverlay?.hideYourPlaceBanner?.();
    super.onExit(nextSceneId);
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;

    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'place_to_chamber',
      targetSceneId: 'chamber',
      position: new THREE.Vector3(0, 1.2, 4.5),
      color: 0x88ccff,
      label: 'NEXARIS HUB',
    });
    this.portalManager.createPortal({
      id: 'place_to_world',
      targetSceneId: MAIN_WORLD_SCENE_ID,
      position: new THREE.Vector3(-2.2, 1.1, 3.5),
      color: 0xaaddff,
      label: 'MAIN WORLD',
    });
    this.portalManager.createPortal({
      id: 'place_to_academy',
      targetSceneId: ACADEMY_SCENE_ID,
      position: new THREE.Vector3(2.2, 1.1, 3.5),
      color: 0xaa88ff,
      label: 'ACADEMY',
    });
    this.interactionSystem?.rebuildTargets();
  }

  configureEffects(effects) {
    effects.applyPreset({
      bloom: { strength: 0.45, radius: 0.5, threshold: 0.22 },
      colorGrading: { saturation: 1.08, tint: 0x8899cc, tintStrength: 0.12, vignette: 0.22 },
    });
  }

  update(deltaTime) {
    super.update(deltaTime);
    const t = this._elapsed;
    const anchor = this.shardManager?.getShard('place_anchor');
    if (anchor?.mesh) {
      anchor.mesh.position.y = 1.1 + Math.sin(t * 0.9) * 0.06;
    }
  }
}
