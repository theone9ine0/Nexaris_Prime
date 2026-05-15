import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { PortalManager } from '../portals/PortalManager.js';
import { NPCManager } from '../npc/NPCManager.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';
import {
  ACADEMY_SCENE_ID,
  FLASHCARD_CHAMBER_SCENE_ID,
  LESSON_HALL_SCENE_ID,
  QUIZ_ARENA_SCENE_ID,
  MAIN_WORLD_SCENE_ID,
} from './academySceneIds.js';

export { ACADEMY_SCENE_ID };

/**
 * PR50 — Academy hub: floating knowledge islands and subject portals.
 */
export class AcademyDimension extends SceneBase {
  constructor() {
    super(ACADEMY_SCENE_ID);
    this.cameraPosition.set(0, 3.5, 12);
    this.spawnPoint.set(0, 0.5, 4);
    this._islands = [];
    this._academy = null;
    this._uiOverlay = null;
  }

  /**
   * @param {import('../academy/AcademyController.js').AcademyController} academy
   * @param {import('../ui/UIOverlay.js').UIOverlay} [uiOverlay]
   */
  mountAcademy(academy, uiOverlay = null) {
    this._academy = academy;
    this._uiOverlay = uiOverlay;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x060818);
    this.scene.fog = new THREE.FogExp2(0x060818, 0.028);

    this.scene.add(new THREE.AmbientLight(0x334466, 0.45));
    const key = new THREE.DirectionalLight(0xaaccff, 0.85);
    key.position.set(5, 14, 8);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshStandardMaterial({
        color: 0x0a1020,
        emissive: 0x112244,
        emissiveIntensity: 0.2,
        metalness: 0.6,
        roughness: 0.35,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const subjects = [
      { name: 'Math', color: 0x44aaff, pos: [-5, 2.5, -2], deck: 'math_basics' },
      { name: 'Science', color: 0x66ffaa, pos: [5, 2.8, -1], deck: 'science_intro' },
      { name: 'Code', color: 0xaa66ff, pos: [0, 3.2, -6], deck: 'programming_basics' },
    ];

    for (const sub of subjects) {
      this._islands.push(this._createIsland(sub));
    }

    this.shardManager.createShard({
      id: 'academy_core',
      color: 0x88ccff,
      position: { x: 0, y: 2, z: 0 },
      animation: 'glow',
    });
  }

  /**
   * @param {{ name: string, color: number, pos: number[], deck: string }} sub
   */
  _createIsland(sub) {
    const group = new THREE.Group();
    group.position.set(sub.pos[0], sub.pos[1], sub.pos[2]);

    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.2, 1),
      new THREE.MeshStandardMaterial({
        color: sub.color,
        emissive: sub.color,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.5,
      }),
    );
    group.add(rock);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.5),
      new THREE.MeshBasicMaterial({
        color: sub.color,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      }),
    );
    label.position.y = 1.6;
    group.add(label);

    group.userData.subject = sub.name;
    group.userData.deckId = sub.deck;
    this.scene.add(group);
    return group;
  }

  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    this._uiOverlay?.showAcademyBanner?.();
    this._academy?.show();
    this._setupPortals();
    void this._spawnTutors();
  }

  onExit(nextSceneId) {
    this._uiOverlay?.hideAcademyBanner?.();
    this._academy?.hide();
    super.onExit(nextSceneId);
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;

    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);

    const portals = [
      { id: 'portal_flashcards', target: FLASHCARD_CHAMBER_SCENE_ID, label: 'FLASHCARDS', pos: [-3, 1.2, 3], color: 0x66aaff },
      { id: 'portal_lessons', target: LESSON_HALL_SCENE_ID, label: 'LESSON HALL', pos: [0, 1.2, 4.5], color: 0x88ffcc },
      { id: 'portal_quiz', target: QUIZ_ARENA_SCENE_ID, label: 'QUIZ ARENA', pos: [3, 1.2, 3], color: 0xcc88ff },
      { id: 'portal_main', target: MAIN_WORLD_SCENE_ID, label: 'MAIN WORLD', pos: [0, 1.2, 7], color: 0xaaddff },
    ];

    for (const p of portals) {
      this.portalManager.createPortal({
        id: p.id,
        targetSceneId: p.target,
        position: new THREE.Vector3(...p.pos),
        color: p.color,
        colorOuter: 0xffffff,
        radius: 0.95,
        frameStyle: 'crystal',
        label: p.label,
      });
    }

    this.interactionSystem?.rebuildTargets();
  }

  async _spawnTutors() {
    if (this.npcManager || !this._animationSystem || !this.modelManager) return;

    this.npcManager = new NPCManager(
      this.scene,
      this._animationSystem.mixerManager,
      this.modelManager,
      this._animationSystem,
      this.sceneManagerRef?.dialogueManager,
    );

    const dm = this.sceneManagerRef.dialogueManager;
    const tutors = [
      { id: 'tutor_math', pos: new THREE.Vector3(-4, 0, 1), dialogueId: 'academy_tutor_math', name: 'Professor Pi' },
      { id: 'tutor_science', pos: new THREE.Vector3(4, 0, 1), dialogueId: 'academy_tutor_science', name: 'Dr. Nova' },
    ];

    for (const t of tutors) {
      try {
        await this.npcManager.spawnNPC(SAMPLE_ROBOT_GLB, t.pos, {
          id: t.id,
          dialogueId: t.dialogueId,
          speakerName: t.name,
          initialState: 'idle',
          dialogueManager: dm,
          scale: 0.85,
        });
      } catch (err) {
        console.warn('[AcademyDimension] Tutor spawn failed:', err);
      }
    }

    this.interactionSystem?.rebuildTargets();
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
    this._effectsManager = effectsManager;
    if (effectsManager?.applyPreset) {
      effectsManager.applyPreset({
        bloom: { strength: 0.5, radius: 0.55, threshold: 0.2 },
      });
    }
  }

  onInteractClick(target) {
    const npc = this.npcManager
      ?.getAllNPCs()
      .find((n) => n.id === target?.id || n._interactive === target);
    if (npc) npc.triggerInteract();
  }

  update(deltaTime) {
    super.update(deltaTime);
    const t = this._elapsed;
    for (let i = 0; i < this._islands.length; i++) {
      const island = this._islands[i];
      island.position.y = island.position.y + Math.sin(t * 0.6 + i) * 0.0008;
      island.rotation.y = t * 0.08 + i;
    }
  }

  dispose() {
    this.npcManager?.dispose?.();
    super.dispose();
  }
}
