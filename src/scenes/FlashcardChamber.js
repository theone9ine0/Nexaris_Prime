import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';
import {
  FLASHCARD_CHAMBER_SCENE_ID,
  ACADEMY_SCENE_ID,
  MAIN_WORLD_SCENE_ID,
} from './academySceneIds.js';

export { FLASHCARD_CHAMBER_SCENE_ID };

/**
 * PR50 — floating holographic flashcards with click-to-flip.
 */
export class FlashcardChamber extends SceneBase {
  constructor() {
    super(FLASHCARD_CHAMBER_SCENE_ID);
    this.cameraPosition.set(0, 2.2, 7);
    this.spawnPoint.set(0, 0.5, 2);
    /** @type {import('../academy/AcademyController.js').AcademyController | null} */
    this._academy = null;
    /** @type {THREE.Mesh[]} */
    this._cardMeshes = [];
    this._pulse = 0;
  }

  /**
   * @param {import('../academy/AcademyController.js').AcademyController} academy
   */
  mountAcademy(academy) {
    this._academy = academy;
    academy.onEffect((type) => {
      if (type === 'correct' || type === 'incorrect') this._pulse = 1;
    });
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x080612);
    this.scene.fog = new THREE.FogExp2(0x080612, 0.035);

    this.scene.add(new THREE.AmbientLight(0x334466, 0.5));
    const key = new THREE.PointLight(0x88ccff, 1.4, 20);
    key.position.set(0, 4, 2);
    this.scene.add(key);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3.5, 0.2, 32),
      new THREE.MeshStandardMaterial({
        color: 0x101828,
        emissive: 0x224466,
        emissiveIntensity: 0.4,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    platform.position.y = 0.1;
    this.scene.add(platform);

    this._spawnFloatingCards();
  }

  _spawnFloatingCards() {
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x223355,
      emissive: 0x4488cc,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.2), cardMat.clone());
      const angle = (i / 6) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 2.2, 1.2 + Math.sin(i) * 0.2, Math.sin(angle) * 2.2);
      mesh.lookAt(0, mesh.position.y, 0);

      mesh.userData.interactive = {
        id: `flashcard_${i}`,
        mesh,
        metadata: { title: 'Flashcard', type: 'academy_card', payload: { index: i } },
        onClick: () => this._onCardClick(mesh),
      };

      this.scene.add(mesh);
      this._cardMeshes.push(mesh);
    }
  }

  /**
   * @param {THREE.Mesh} mesh
   */
  _onCardClick(mesh) {
    this._academy?.ui?.showPanel('flashcard');
    const flipped = this._academy?.flashcards?.flip();
    const card = this._academy?.flashcards?.currentCard;
    if (card) {
      this._academy.ui.showFlashcard(flipped ? card.back : card.front, !!flipped);
    }

    mesh.rotation.y += Math.PI;
    this._pulse = 1;
    this._effectsManager?.applyObjectEffect?.('card_flip', mesh, {
      glow: true,
      emissive: 0x66ccff,
      emissiveIntensity: 0.8,
    });
  }

  onEnter() {
    super.onEnter();
    this._academy?.show();
    this._academy?.ui?.showPanel('flashcard');
    this._setupPortals();
    const card = this._academy?.flashcards?.getNextCard();
    if (card) this._academy?.ui?.showFlashcard(card.front, false);
  }

  onExit(nextSceneId) {
    this._academy?.hide();
    super.onExit(nextSceneId);
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;
    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'fc_to_academy',
      targetSceneId: ACADEMY_SCENE_ID,
      position: new THREE.Vector3(0, 1.2, -4),
      color: 0x66aaff,
      label: 'ACADEMY HUB',
    });
    this.portalManager.createPortal({
      id: 'fc_to_world',
      targetSceneId: MAIN_WORLD_SCENE_ID,
      position: new THREE.Vector3(2.5, 1.1, 3.5),
      color: 0xaaddff,
      label: 'MAIN WORLD',
    });
    this.interactionSystem?.rebuildTargets();
  }

  onInteractClick(target) {
    if (target.metadata?.type === 'academy_card' && target.onClick) {
      target.onClick();
      return;
    }
    const mesh = target.mesh ?? target;
    const interactive = mesh?.userData?.interactive;
    if (interactive?.onClick) interactive.onClick();
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._effectsManager = effectsManager;
  }

  update(deltaTime) {
    super.update(deltaTime);
    const t = this._elapsed;
    for (let i = 0; i < this._cardMeshes.length; i++) {
      const m = this._cardMeshes[i];
      m.position.y = 1.2 + Math.sin(t * 0.8 + i * 0.9) * 0.15;
      m.rotation.z = Math.sin(t * 0.5 + i) * 0.05;
    }
    if (this._pulse > 0) this._pulse -= deltaTime;
  }
}
