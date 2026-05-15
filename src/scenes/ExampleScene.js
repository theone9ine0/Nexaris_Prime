import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { NPCManager } from '../npc/NPCManager.js';
import { SAMPLE_ROBOT_GLB, SAMPLE_VRM_URL } from '../assets/modelUrls.js';
import { scanSession } from '../scan/AvatarScanManager.js';
import { AvatarScanManager } from '../scan/AvatarScanManager.js';
import { PortalManager } from '../portals/PortalManager.js';
import { SCAN_CHAMBER_SCENE_ID } from './ScanChamberScene.js';
import { ACADEMY_SCENE_ID } from './academySceneIds.js';

const EXPRESSION_CYCLE = ['happy', 'angry', 'sad', 'surprised'];
let _expressionIndex = 0;

/**
 * Example dimension — VRM player avatar, NPCs, shards, and props.
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
    this._keyHandler = null;
    this._generating = false;
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
    this._setupPortals();
    if (this.player) {
      this.cameraController?.followTarget(this.player.object);
    }
  }

  onExit(nextSceneId) {
    this._unbindKeyHandler();
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

    this._bindKeyHandler();
    this._setupPortals();
  }

  _setupPortals() {
    if (!this.sceneManagerRef || this.portalManager) return;

    this.portalManager = new PortalManager(this.scene, this.sceneManagerRef);
    this.portalManager.createPortal({
      id: 'portal_crystal',
      targetSceneId: 'crystal_cave',
      position: new THREE.Vector3(-6, 1.3, -2),
      color: 0xaa66ff,
      radius: 1,
      frameStyle: 'ring',
    });
    this.portalManager.createPortal({
      id: 'portal_retro',
      targetSceneId: 'retro_console',
      position: new THREE.Vector3(6, 1.3, -2),
      color: 0x00ff88,
      radius: 1,
      frameStyle: 'arch',
    });
    this.portalManager.createPortal({
      id: 'portal_scan_chamber',
      targetSceneId: SCAN_CHAMBER_SCENE_ID,
      position: new THREE.Vector3(-1.5, 1.2, 5),
      color: 0x88ddff,
      colorOuter: 0xffffff,
      radius: 0.9,
      frameStyle: 'crystal',
      label: 'SCAN CHAMBER',
    });
    this.portalManager.createPortal({
      id: 'portal_academy',
      targetSceneId: ACADEMY_SCENE_ID,
      position: new THREE.Vector3(1.5, 1.2, 5),
      color: 0xaa88ff,
      colorOuter: 0xffffff,
      radius: 0.9,
      frameStyle: 'arch',
      label: 'ACADEMY',
    });

    this.interactionSystem?.rebuildTargets();
  }

  _bindKeyHandler() {
    if (!this.inputSystem || this._keyHandler) return;
    this._keyHandler = ({ code }) => {
      if (code === 'KeyG') {
        this._generateMultiverse();
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

  async _generateMultiverse() {
    if (this._generating || !this.sceneManagerRef) return;
    this._generating = true;
    try {
      const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
      await this.sceneManagerRef.generateAndLoad(seed, {
        preservePlayer: true,
        transition: 'warp',
        duration: 0.9,
      });
      console.info(`[ExampleScene] Generated dimension (seed ${seed})`);
    } catch (err) {
      console.warn('[ExampleScene] Multiverse generation failed:', err);
    } finally {
      this._generating = false;
    }
  }

  async _spawnAvatar() {
    if (this._avatarLoading || this.player) return;
    if (!this.inputSystem || !this.cameraController || !this._animationSystem?.mixerManager) {
      return;
    }

    this._avatarLoading = true;

    try {
      const avatar = await this._trySpawnVRMAvatar();
      if (!avatar) {
        await this._spawnRobotAvatar();
        return;
      }

      this.setPlayer(avatar);
      this._configurePlayerCamera(avatar);
      this.npcManager?.setFollowTarget(avatar.object);
      this.interactionSystem?.rebuildTargets();
    } catch (err) {
      console.warn('[ExampleScene] Avatar load failed:', err);
    } finally {
      this._avatarLoading = false;
    }
  }

  /**
   * @returns {Promise<import('../avatars/AvatarController.js').AvatarController | null>}
   */
  async _trySpawnVRMAvatar() {
    try {
      const vrmUrl = scanSession.lastScanUrl ?? SAMPLE_VRM_URL;
      const { vrm, object, animations } = await modelManager.cloneVRM(vrmUrl);
      object.name = 'player_vrm';
      object.position.set(0, 0, 0);
      object.scale.setScalar(1);

      let clips = animations;
      if (!clips.length) {
        await modelManager.loadModel(SAMPLE_ROBOT_GLB);
        clips = modelManager.getCached(SAMPLE_ROBOT_GLB)?.animations ?? [];
      }

      this.scene.add(object);

      const avatar = new AvatarController({
        object,
        vrm,
        animations: clips,
        inputSystem: this.inputSystem,
        cameraController: this.cameraController,
        mixerManager: this._animationSystem.mixerManager,
        animationSystem: this._animationSystem,
        modelManager,
        groundY: 0,
        walkSpeed: 2.2,
        runSpeed: 4.5,
        scanSource: scanSession.lastScanUrl,
      });

      if (scanSession.lastScanUrl) {
        const scanMgr = new AvatarScanManager();
        scanMgr.scanUrl = scanSession.lastScanUrl;
        scanMgr.scanId = scanSession.lastScanId;
        scanMgr.stitchedCanvas = scanSession.lastStitchedCanvas;
        scanMgr.customizationConfig = {
          ...scanMgr.customizationConfig,
          ...scanSession.lastCustomization,
        };
        scanMgr.applyScanToVRM(vrm, avatar.vrmAvatar);
        await scanMgr.restoreFaceStylization(vrm, avatar.vrmAvatar);
        await scanMgr.applyCustomizationToAvatar(avatar);
      }

      avatar.vrmAvatar?.setLookAtTarget(this.cameraController.camera);
      avatar.vrmAvatar?.setBlink(true);

      if (clips.length > 0) {
        this._animationSystem.mixerManager.play(object, clips[0].name, {
          loop: THREE.LoopRepeat,
          fadeIn: 0,
        });
      }

      return avatar;
    } catch (err) {
      console.warn('[ExampleScene] VRM avatar unavailable, using GLB fallback:', err);
      return null;
    }
  }

  async _spawnRobotAvatar() {
    const { object, animations } = await modelManager.cloneModel(SAMPLE_ROBOT_GLB);
    object.name = 'player_avatar';
    object.position.set(0, 0, 0);
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

    this.setPlayer(avatar);
    this._configurePlayerCamera(avatar);
  }

  /**
   * @param {import('../avatars/AvatarController.js').AvatarController} avatar
   */
  _configurePlayerCamera(avatar) {
    this.cameraController.followTarget(avatar.object, {
      offset: new THREE.Vector3(0, 2.4, 5),
      lookAtOffset: new THREE.Vector3(0, 1.2, 0),
    });
  }

  async _spawnNPCs() {
    if (this._npcsLoading || this.npcManager) return;
    if (!this._animationSystem?.mixerManager) return;

    this._npcsLoading = true;
    this.npcManager = new NPCManager(
      this.scene,
      this._animationSystem.mixerManager,
      modelManager,
      this._animationSystem,
      this.sceneManagerRef?.dialogueManager ?? null,
    );

    const spawns = [
      { x: -4, z: 2, wanderRadius: 3.5, useVrm: true, dialogueId: 'npc_intro' },
      { x: 4, z: 1, wanderRadius: 4, useVrm: false },
      { x: 0, z: -3, wanderRadius: 3, useVrm: false },
    ];

    try {
      for (let i = 0; i < spawns.length; i++) {
        const s = spawns[i];
        const pos = new THREE.Vector3(s.x, 0, s.z);
        const baseOptions = {
          id: `npc_guard_${i}`,
          scale: 0.92,
          initialState: 'wander',
          wanderRadius: s.wanderRadius,
          walkSpeed: 1.2,
          lookAtTarget: this.cameraController?.camera ?? null,
          dialogueId: s.dialogueId ?? null,
          dialogueManager: this.sceneManagerRef?.dialogueManager ?? null,
          speakerName: s.dialogueId ? 'Guide' : `Guard ${i}`,
        };

        let npc;
        if (s.useVrm) {
          try {
            npc = await this.npcManager.spawnVRMNPC(SAMPLE_VRM_URL, pos, baseOptions);
            npc.vrmAvatar?.setLookAtTarget(this.cameraController?.camera ?? null);
            npc.playExpression('relaxed', 0.3);
          } catch {
            npc = await this.npcManager.spawnNPC(SAMPLE_ROBOT_GLB, pos, baseOptions);
          }
        } else {
          npc = await this.npcManager.spawnNPC(SAMPLE_ROBOT_GLB, pos, baseOptions);
        }

        const npcCustomizer = npc.getCustomizer?.();
        if (npcCustomizer) {
          const tint = [0xcc6644, 0x44aa88, 0xaa66cc][i];
          npcCustomizer.setColor('body', tint);
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
      const expr = EXPRESSION_CYCLE[_expressionIndex % EXPRESSION_CYCLE.length];
      _expressionIndex += 1;
      this.player?.vrmAvatar?.playExpression(expr, 0.55);
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
