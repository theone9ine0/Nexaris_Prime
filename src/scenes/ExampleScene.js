import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';

/**
 * Example dimension — playable robot avatar, shards, and props.
 */
export class ExampleScene extends SceneBase {
  constructor() {
    super('example');
    this.cameraPosition.set(0, 0.2, 8);
    this.scene.background = new THREE.Color(0x050510);

    /** @type {import('../core/InputSystem.js').InputSystem | null} */
    this.inputSystem = null;
    /** @type {import('../core/CameraController.js').CameraController | null} */
    this.cameraController = null;
    /** @type {import('../core/AnimationSystem.js').AnimationSystem | null} */
    this._animationSystem = null;
    this._avatarLoading = false;
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

  /**
   * @param {string | null} previousSceneId
   */
  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    if (this.player) {
      this.cameraController?.followTarget(this.player.object);
    }
  }

  /**
   * @param {string | null} nextSceneId
   */
  onExit(nextSceneId) {
    this.cameraController?.clearFollowTarget();
    super.onExit(nextSceneId);
  }

  /**
   * @param {import('../core/AnimationSystem.js').AnimationSystem | null} animationSystem
   * @param {import('../effects/EffectsManager.js').EffectsManager | null} effectsManager
   */
  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
    if (this.player && animationSystem) {
      this._attachAvatarToMixer(animationSystem);
    } else if (!this.player && !this._avatarLoading) {
      this._spawnAvatar();
    }
  }

  async _spawnAvatar() {
    if (this._avatarLoading || this.player) return;
    if (!this.inputSystem || !this.cameraController) {
      console.warn('[ExampleScene] inputSystem / cameraController required for avatar');
      return;
    }

    this._avatarLoading = true;

    if (!this._animationSystem?.mixerManager) {
      console.warn('[ExampleScene] AnimationSystem not ready for avatar');
      this._avatarLoading = false;
      return;
    }

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
        groundY: 0,
        walkSpeed: 2.4,
        runSpeed: 5,
      });

      this.setPlayer(avatar);
      this.cameraController.followTarget(avatar.object, {
        offset: new THREE.Vector3(0, 2.4, 5),
        lookAtOffset: new THREE.Vector3(0, 1.2, 0),
      });
    } catch (err) {
      console.warn('[ExampleScene] Avatar load failed:', err);
    } finally {
      this._avatarLoading = false;
    }
  }

  /**
   * @param {object} target
   */
  onInteractClick(target) {
    if (target === this.player?._interactive || target?.id === this.player?.id) {
      this.player?.triggerEmote();
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
