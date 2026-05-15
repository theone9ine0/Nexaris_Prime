import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { NPCManager } from '../npc/NPCManager.js';
import {
  SAMPLE_DUCK_GLB,
  SAMPLE_FOX_GLB,
  SAMPLE_ROBOT_GLB,
} from '../assets/modelUrls.js';
import { NEXARIS_DEFAULT_PRESET } from '../avatars/presets/nexarisDefault.js';

/**
 * Example dimension — playable avatar, wandering NPCs, shards, and props.
 */
export class ExampleScene extends SceneBase {
  constructor() {
    super('example');
    this.cameraPosition.set(0, 0.2, 8);
    this.scene.background = new THREE.Color(0x050510);

    this.inputSystem = null;
    this.cameraController = null;
    /** @type {import('../core/InteractionSystem.js').InteractionSystem | null} */
    this.interactionSystem = null;
    this._animationSystem = null;
    this._avatarLoading = false;
    this._npcsLoading = false;
  }

  _buildContent() {
    this.scene.add(new THREE.AmbientLight(0x334466, 0.65));
    const key = new THREE.DirectionalLight(0xaaccff, 1.2);
    key.position.set(3, 6, 4);
    this.scene.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x0a1020,
        metalness: 0.2,
        roughness: 0.85,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.shardManager.createShard({
      id: 'example_a',
      color: 0x88aaff,
      position: { x: -3, y: 0.6, z: -2 },
      animation: 'pulse',
    });

    this.shardManager.createShard({
      id: 'example_b',
      color: 0x66ccff,
      position: { x: 3, y: 0.6, z: -2 },
      animation: 'glow',
    });

    this.clusterManager.createCluster({
      id: 'example_cluster',
      layout: 'circle',
      layoutOptions: { radius: 1.2 },
      position: { x: 0, y: 0.55, z: -4 },
      animation: ['rotate'],
      shardSpecs: [
        { id: 'ex_c1', color: 0x5577cc, animation: 'pulse' },
        { id: 'ex_c2', color: 0x6688dd, animation: 'pulse' },
        { id: 'ex_c3', color: 0x7799ee, animation: 'pulse' },
      ],
    });
  }

  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    if (this.player) {
      this.cameraController?.followTarget(this.player.object);
    }
  }

  onExit(nextSceneId) {
    this.cameraController?.clearFollowTarget();
    super.onExit(nextSceneId);
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;

    if (!this._animationSystem?.mixerManager) return;

    if (!this.player && !this._avatarLoading) {
      this._spawnAvatar();
    }

    if (!this.npcManager && !this._npcsLoading) {
      this._spawnNPCs();
    }
  }

  async _spawnAvatar() {
    if (this._avatarLoading || this.player) return;
    if (!this.inputSystem || !this.cameraController || !this._animationSystem?.mixerManager) {
      return;
    }

    this._avatarLoading = true;

    try {
      const { object, animations } = await modelManager.cloneModel(SAMPLE_ROBOT_GLB);
      object.name = 'player_avatar';
      object.position.set(0, 0, 0);
      object.scale.setScalar(1);
      this.scene.add(object);

      const avatar = new AvatarController({
        object,
        animations,
        inputSystem: this.inputSystem,
        cameraController: this.cameraController,
        mixerManager: this._animationSystem.mixerManager,
        modelManager,
        groundY: 0,
        walkSpeed: 2.4,
        runSpeed: 5,
      });

      await this._applyExampleCustomization(avatar);

      this.setPlayer(avatar);
      this.cameraController.followTarget(avatar.object, {
        offset: new THREE.Vector3(0, 2.4, 5),
        lookAtOffset: new THREE.Vector3(0, 1.2, 0),
      });

      this.npcManager?.setFollowTarget(avatar.object);
      this.interactionSystem?.rebuildTargets();
    } catch (err) {
      console.warn('[ExampleScene] Avatar load failed:', err);
    } finally {
      this._avatarLoading = false;
    }
  }

  /**
   * Demo PR34 — part swaps, recolor, emissive, and bone-attached accessories.
   * @param {import('../avatars/AvatarController.js').AvatarController} avatar
   */
  async _applyExampleCustomization(avatar) {
    const customizer = avatar.getCustomizer();
    if (!customizer) return;

    try {
      await customizer.applyCustomization(NEXARIS_DEFAULT_PRESET);

      customizer.setColor('hair', 0x88ccff);
      customizer.setMaterial('outfit', {
        emissive: 0x113355,
        emissiveIntensity: 0.25,
        metalness: 0.5,
        roughness: 0.45,
      });

      await customizer.setPart('hair', SAMPLE_FOX_GLB);
      await customizer.setPart('outfit', SAMPLE_ROBOT_GLB);
      await customizer.setPart('head', SAMPLE_DUCK_GLB);

      await customizer.attachAccessory(SAMPLE_DUCK_GLB, 'RightHand', {
        id: 'sword_prop',
        scale: 0.1,
        position: { x: 0.08, y: 0.05, z: 0 },
        rotation: { x: 0.2, y: 0, z: -0.4 },
      });

      customizer.savePreset('example_player', customizer.exportConfig());
    } catch (err) {
      console.warn('[ExampleScene] Avatar customization demo failed:', err);
    }
  }

  async _spawnNPCs() {
    if (this._npcsLoading || this.npcManager) return;
    if (!this._animationSystem?.mixerManager) return;

    this._npcsLoading = true;
    this.npcManager = new NPCManager(
      this.scene,
      this._animationSystem.mixerManager,
      modelManager,
    );

    const spawns = [
      { x: -4, z: 2, wanderRadius: 3.5 },
      { x: 4, z: 1, wanderRadius: 4 },
      { x: 0, z: -3, wanderRadius: 3 },
    ];

    try {
      for (let i = 0; i < spawns.length; i++) {
        const s = spawns[i];
        const npc = await this.npcManager.spawnNPC(
          SAMPLE_ROBOT_GLB,
          new THREE.Vector3(s.x, 0, s.z),
          {
            id: `npc_guard_${i}`,
            scale: 0.92,
            initialState: 'wander',
            wanderRadius: s.wanderRadius,
            walkSpeed: 1.2,
            onInteract: () => {
              console.info(`[NPC] ${`npc_guard_${i}`} emote triggered`);
            },
          },
        );

        const npcCustomizer = npc.getCustomizer?.();
        if (npcCustomizer) {
          const tint = [0xcc6644, 0x44aa88, 0xaa66cc][i];
          npcCustomizer.setColor('body', tint);
          npcCustomizer.setMaterial('body', {
            emissive: tint,
            emissiveIntensity: 0.15,
          });
        }
      }

      if (this.player) {
        this.npcManager.setFollowTarget(this.player.object);
      }

      this.interactionSystem?.rebuildTargets();
    } catch (err) {
      console.warn('[ExampleScene] NPC spawn failed:', err);
    } finally {
      this._npcsLoading = false;
    }
  }

  onInteractClick(target) {
    if (target === this.player?._interactive || target?.id === this.player?.id) {
      this.player?.triggerEmote();
      return;
    }

    const npc = this.npcManager
      ?.getAllNPCs()
      .find((n) => n.id === target?.id || n._interactive === target);
    if (npc) {
      npc.triggerInteract();
    }
  }

  configureEffects(effects) {
    effects.applyPreset({
      bloom: { strength: 0.35, radius: 0.5, threshold: 0.22 },
      colorGrading: {
        saturation: 1.05,
        tint: 0x7a9ec8,
        tintStrength: 0.12,
        vignette: 0.2,
      },
    });
  }
}
