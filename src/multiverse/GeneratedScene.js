import * as THREE from 'three';
import { SceneBase } from '../scenes/SceneBase.js';
import { NPCManager } from '../npc/NPCManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';
import { modelManager } from '../core/ModelManager.js';

/**
 * @typedef {import('./templates/index.js').DimensionTemplate} DimensionTemplate
 * @typedef {import('../portals/Portal.js').Portal} Portal
 */

/**
 * Procedurally generated Nexaris dimension (PR29).
 */
export class GeneratedScene extends SceneBase {
  /**
   * @param {string} id
   * @param {{
   *   seed: number,
   *   template: DimensionTemplate,
   *   portals?: Portal[],
   *   terrainRoot?: THREE.Object3D,
   *   propsRoot?: THREE.Object3D,
   * }} config
   */
  constructor(id, config) {
    super(id);
    this.seed = config.seed;
    this.template = config.template;
    /** @type {Portal[]} */
    this.portals = config.portals ?? [];
    this.terrainRoot = config.terrainRoot ?? null;
    this.propsRoot = config.propsRoot ?? null;

    /** @type {import('../avatars/AvatarController.js').AvatarController | null} */
    this._preservedPlayer = null;
    /** @type {import('../core/SceneManager.js').SceneManager | null} */
    this.sceneManagerRef = null;

    this.cameraPosition.set(0, 2.5, 10);
    this._npcsSpawned = false;
    this._keyHandler = null;
  }

  /**
   * @param {import('../avatars/AvatarController.js').AvatarController | null} player
   */
  setPreservedPlayer(player) {
    this._preservedPlayer = player;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(this.template.palette.sky);
    this.scene.fog = new THREE.Fog(
      this.template.fog.color,
      this.template.fog.near,
      this.template.fog.far,
    );

    const lit = this.template.lighting;
    this.scene.add(new THREE.AmbientLight(lit.ambient, lit.ambientIntensity));
    const sun = new THREE.DirectionalLight(lit.directional, lit.directionalIntensity);
    sun.position.set(...lit.directionalPosition);
    this.scene.add(sun);

    if (this.terrainRoot) this.scene.add(this.terrainRoot);
    if (this.propsRoot) this.scene.add(this.propsRoot);

    this.scene.userData.multiverse = {
      seed: this.seed,
      templateId: this.template.id,
      templateName: this.template.name,
    };
  }

  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    console.info(
      `[Multiverse] Entered "${this.template.name}" (seed ${this.seed}, from ${previousSceneId ?? 'boot'})`,
    );
  }

  onExit(nextSceneId) {
    this._unbindKeyHandler();
    super.onExit(nextSceneId);
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);

    if (this._preservedPlayer && !this.player) {
      this._adoptPlayer(this._preservedPlayer);
      this._preservedPlayer = null;
    } else if (!this.player && !this._npcsSpawned) {
      this._spawnPlayerAvatar(animationSystem);
    }

    if (!this._npcsSpawned) {
      this._spawnDeferredNPCs(animationSystem);
    }

    this._bindKeyHandler();
    this.interactionSystem?.rebuildTargets();
  }

  /**
   * @param {import('../avatars/AvatarController.js').AvatarController} player
   */
  _adoptPlayer(player) {
    player.object.parent?.remove(player.object);
    player.object.position.set(0, 0.5, 2);
    this.scene.add(player.object);
    this.setPlayer(player);

    if (this.cameraController) {
      this.cameraController.followTarget(player.object, {
        offset: new THREE.Vector3(0, 2.4, 5),
        lookAtOffset: new THREE.Vector3(0, 1.2, 0),
      });
    }
  }

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem} animationSystem
   */
  async _spawnPlayerAvatar(animationSystem) {
    if (!this.inputSystem || !this.cameraController || !animationSystem?.mixerManager) return;

    try {
      const { object, animations } = await modelManager.cloneModel(SAMPLE_ROBOT_GLB);
      object.name = 'multiverse_player';
      object.position.set(0, 0.5, 2);
      this.scene.add(object);

      const avatar = new AvatarController({
        object,
        animations,
        inputSystem: this.inputSystem,
        cameraController: this.cameraController,
        mixerManager: animationSystem.mixerManager,
        modelManager,
        animationSystem,
        groundY: 0,
      });

      this.setPlayer(avatar);
      this.cameraController.followTarget(avatar.object, {
        offset: new THREE.Vector3(0, 2.4, 5),
        lookAtOffset: new THREE.Vector3(0, 1.2, 0),
      });
    } catch (err) {
      console.warn('[GeneratedScene] Player spawn failed:', err);
    }
  }

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem} animationSystem
   */
  _spawnDeferredNPCs(animationSystem) {
    const npcData = this.scene.userData.generatedNPCs;
    if (!npcData?.length || !animationSystem?.mixerManager) {
      this._npcsSpawned = true;
      return;
    }

    this.npcManager = new NPCManager(
      this.scene,
      animationSystem.mixerManager,
      modelManager,
      animationSystem,
    );

    for (const spec of npcData) {
      this.npcManager
        .spawnNPC(SAMPLE_ROBOT_GLB, spec.position, {
          id: spec.id,
          scale: spec.scale,
          initialState: spec.state,
          wanderRadius: spec.wanderRadius,
        })
        .then((npc) => {
          const customizer = npc.getCustomizer();
          if (customizer && spec.tint != null) {
            customizer.setColor('body', spec.tint);
          }
        })
        .catch(() => {});
    }

    this._npcsSpawned = true;
  }

  _bindKeyHandler() {
    if (!this.inputSystem || this._keyHandler) return;
    this._keyHandler = ({ code }) => {
      if (code === 'KeyG') {
        this.requestNewDimension();
      }
    };
    this.inputSystem.on('keyDown', this._keyHandler);
  }

  _unbindKeyHandler() {
    if (this._keyHandler && this.inputSystem) {
      this.inputSystem.off('keyDown', this._keyHandler);
      this._keyHandler = null;
    }
  }

  requestNewDimension() {
    if (!this.sceneManagerRef) return;
    const newSeed = (this.seed * 1664525 + 1013904223) >>> 0;
    this.sceneManagerRef.generateAndLoad(newSeed, {
      preservePlayer: true,
      parentSeed: this.seed,
      transition: 'warp',
      duration: 0.9,
    });
  }

  configureEffects(effects) {
    const preset = this.template.effects;
    if (preset) {
      effects.applyPreset(preset);
    }
  }

  update(deltaTime) {
    super.update(deltaTime);
    for (const portal of this.portals) {
      portal.update(this._elapsed);
    }
  }

  dispose() {
    this._unbindKeyHandler();
    for (const portal of this.portals) {
      portal.dispose();
    }
    this.portals = [];
    super.dispose();
  }
}
