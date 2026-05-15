import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';
import { NPCManager } from '../npc/NPCManager.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';
import {
  ACADEMY_SCENE_ID,
  MAIN_WORLD_SCENE_ID,
  LESSON_HALL_SCENE_ID,
} from './academySceneIds.js';

export { LESSON_HALL_SCENE_ID };

/**
 * PR50 — holographic lesson panels and NPC guide.
 */
export class LessonHall extends SceneBase {
  constructor() {
    super(LESSON_HALL_SCENE_ID);
    this.cameraPosition.set(0, 2, 8);
    this.spawnPoint.set(0, 0.5, 3);
    this._academy = null;
    this._panels = [];
  }

  mountAcademy(academy) {
    this._academy = academy;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x0a0e18);
    this.scene.add(new THREE.AmbientLight(0x445566, 0.45));
    const key = new THREE.DirectionalLight(0xccddff, 0.8);
    key.position.set(2, 8, 4);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x141c28, roughness: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.8, 1.6),
        new THREE.MeshBasicMaterial({
          color: 0x4488cc,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
        }),
      );
      panel.position.set((i - 1) * 3.2, 1.8, -1.5);
      panel.rotation.y = (i - 1) * 0.25;
      this.scene.add(panel);
      this._panels.push(panel);
    }
  }

  onEnter() {
    super.onEnter();
    this._academy?.show();
    this._academy?.ui?.showPanel('lesson');
    this._refreshLesson();
    this._setupPortals();
    this._spawnGuide();
  }

  onExit(nextSceneId) {
    this._academy?.hide();
    super.onExit(nextSceneId);
  }

  _refreshLesson() {
    const section = this._academy?.lessons?.getCurrentSection();
    if (section) {
      this._academy?.ui?.showLesson(section, this._academy.lessons.getProgress());
    }
  }

  async _spawnGuide() {
    if (this.npcManager || !this._animationSystem) return;

    this.npcManager = new NPCManager(
      this.scene,
      this._animationSystem.mixerManager,
      this.modelManager,
      this._animationSystem,
      this.sceneManagerRef?.dialogueManager,
    );

    try {
      await this.npcManager.spawnNPC(SAMPLE_ROBOT_GLB, new THREE.Vector3(0, 0, 2), {
        id: 'lesson_guide',
        dialogueId: 'academy_lesson_guide',
        speakerName: 'Holo Guide',
        initialState: 'idle',
        scale: 0.9,
      });
      this.interactionSystem?.rebuildTargets();
    } catch (err) {
      console.warn('[LessonHall] Guide spawn failed:', err);
    }
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;
    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'lesson_to_academy',
      targetSceneId: ACADEMY_SCENE_ID,
      position: new THREE.Vector3(0, 1.2, 4.5),
      color: 0x88ffcc,
      label: 'ACADEMY HUB',
    });
    this.portalManager.createPortal({
      id: 'lesson_to_world',
      targetSceneId: MAIN_WORLD_SCENE_ID,
      position: new THREE.Vector3(-2.5, 1.1, 3),
      color: 0xaaddff,
      label: 'MAIN WORLD',
    });
    this.interactionSystem?.rebuildTargets();
  }

  onInteractClick(target) {
    const npc = this.npcManager
      ?.getAllNPCs()
      .find((n) => n.id === target?.id || n._interactive === target);
    if (npc) npc.triggerInteract();
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
  }

  update(deltaTime) {
    super.update(deltaTime);
    const t = this._elapsed;
    for (const p of this._panels) {
      p.material.opacity = 0.14 + Math.sin(t * 1.2 + p.position.x) * 0.06;
    }
  }
}
