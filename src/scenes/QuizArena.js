import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';
import {
  ACADEMY_SCENE_ID,
  MAIN_WORLD_SCENE_ID,
  QUIZ_ARENA_SCENE_ID,
} from './academySceneIds.js';

export { QUIZ_ARENA_SCENE_ID };

/**
 * PR50 — quiz arena with floating question panels and holographic score.
 */
export class QuizArena extends SceneBase {
  constructor() {
    super(QUIZ_ARENA_SCENE_ID);
    this.cameraPosition.set(0, 2.5, 9);
    this.spawnPoint.set(0, 0.5, 2);
    this._academy = null;
    this._questionPanel = null;
    this._scoreHolo = null;
    this._fxTimer = 0;
  }

  mountAcademy(academy) {
    this._academy = academy;
    academy.onEffect((type, payload) => this._onAcademyEffect(type, payload));
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x120818);
    this.scene.fog = new THREE.Fog(0x1a1028, 6, 28);

    this.scene.add(new THREE.AmbientLight(0x553366, 0.4));
    const spot = new THREE.SpotLight(0xff88cc, 1.2, 25, 0.4, 0.5);
    spot.position.set(0, 10, 4);
    this.scene.add(spot);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 3.2, 48),
      new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.scene.add(ring);

    this._questionPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(3.5, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x332255,
        emissive: 0xaa66ff,
        emissiveIntensity: 0.25,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      }),
    );
    this._questionPanel.position.set(0, 2.2, 0);
    this.scene.add(this._questionPanel);

    this._scoreHolo = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 0.8),
      new THREE.MeshBasicMaterial({
        color: 0x88ffcc,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    );
    this._scoreHolo.position.set(0, 3.2, 0.5);
    this.scene.add(this._scoreHolo);
  }

  /**
   * @param {string} type
   * @param {unknown} [payload]
   */
  _onAcademyEffect(type, payload) {
    if (type === 'quiz_correct') {
      this._fxTimer = 0.6;
      if (this._questionPanel?.material) {
        this._questionPanel.material.emissive.setHex(0x44ff88);
        this._questionPanel.material.emissiveIntensity = 0.6;
      }
    } else if (type === 'quiz_wrong') {
      this._fxTimer = 0.5;
      if (this._questionPanel?.material) {
        this._questionPanel.material.emissive.setHex(0xff4466);
        this._questionPanel.material.emissiveIntensity = 0.5;
      }
    } else if (type === 'quiz_complete' && payload) {
      const score = /** @type {{ percent: number, grade: string }} */ (payload);
      if (this._scoreHolo?.material) {
        this._scoreHolo.material.opacity = 0.9;
      }
      this._scoreHolo?.scale.setScalar(1 + score.percent / 200);
    }
  }

  onEnter() {
    super.onEnter();
    this._academy?.show();
    this._academy?.ui?.showPanel('quiz');
    this._academy?.startQuiz?.(this._academy.quizzes.quiz?.id ?? 'math_quiz');
    this._setupPortals();
  }

  onExit(nextSceneId) {
    this._academy?.hide();
    super.onExit(nextSceneId);
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;
    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'quiz_to_academy',
      targetSceneId: ACADEMY_SCENE_ID,
      position: new THREE.Vector3(0, 1.2, 5),
      color: 0xcc88ff,
      label: 'ACADEMY HUB',
    });
    this.portalManager.createPortal({
      id: 'quiz_to_world',
      targetSceneId: MAIN_WORLD_SCENE_ID,
      position: new THREE.Vector3(2.5, 1.1, 2),
      color: 0xaaddff,
      label: 'MAIN WORLD',
    });
    this.interactionSystem?.rebuildTargets();
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._effectsManager = effectsManager;
  }

  update(deltaTime) {
    super.update(deltaTime);
    if (this._fxTimer > 0) {
      this._fxTimer -= deltaTime;
      if (this._fxTimer <= 0 && this._questionPanel?.material) {
        this._questionPanel.material.emissive.setHex(0xaa66ff);
        this._questionPanel.material.emissiveIntensity = 0.25;
      }
    }
    if (this._questionPanel) {
      this._questionPanel.rotation.y = Math.sin(this._elapsed * 0.3) * 0.08;
    }
  }
}
