import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { modelManager } from '../core/ModelManager.js';
import { AvatarController } from '../avatars/AvatarController.js';
import { NPCManager } from '../npc/NPCManager.js';
import { SAMPLE_ROBOT_GLB } from '../assets/modelUrls.js';
import { CombatController } from '../combat/CombatController.js';
import { CombatParticles } from '../combat/particles/CombatParticles.js';
import { CombatHUD } from '../combat/CombatHUD.js';
import { AuraController } from '../combat/AuraController.js';

/**
 * PR38 — stylized anime combat training arena.
 */
export class CombatZoneScene extends SceneBase {
  constructor() {
    super('combat_zone');
    this.cameraPosition.set(0, 2.5, 12);
    this.spawnPoint.set(0, 0.5, 0);

    this.inputSystem = null;
    this.cameraController = null;
    this.interactionSystem = null;
    this._animationSystem = null;
    this._loading = false;

    /** @type {CombatController[]} */
    this.combatants = [];
    /** @type {CombatController | null} */
    this.playerCombat = null;
    /** @type {CombatParticles | null} */
    this.combatParticles = null;
    /** @type {CombatHUD | null} */
    this.combatHud = null;
    /** @type {AuraController | null} */
    this.playerAura = null;
    this._effectsManager = null;
  }

  _buildContent() {
    this.scene.background = new THREE.Color(0x080612);
    this.scene.fog = new THREE.Fog(0x080612, 12, 45);

    this.scene.add(new THREE.AmbientLight(0x4455aa, 0.55));
    const key = new THREE.DirectionalLight(0xffeedd, 1.1);
    key.position.set(4, 10, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6688ff, 0.6);
    rim.position.set(-6, 4, -4);
    this.scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(16, 32),
      new THREE.MeshStandardMaterial({
        color: 0x12182a,
        metalness: 0.45,
        roughness: 0.55,
        emissive: 0x0a1020,
        emissiveIntensity: 0.3,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(14.5, 15, 48),
      new THREE.MeshBasicMaterial({
        color: 0x44aaff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.scene.add(ring);

    for (let i = 0; i < 6; i++) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.35, 3, 6),
        new THREE.MeshStandardMaterial({
          color: 0x223355,
          emissive: 0x2244aa,
          emissiveIntensity: 0.25,
        }),
      );
      const angle = (i / 6) * Math.PI * 2;
      pillar.position.set(Math.cos(angle) * 13, 1.5, Math.sin(angle) * 13);
      this.scene.add(pillar);
    }

    this.combatParticles = new CombatParticles(this.scene);
  }

  onEnter(previousSceneId) {
    super.onEnter(previousSceneId);
    this.combatHud?.show();
    if (this.player) {
      this.cameraController?.followTarget(this.player.object, {
        offset: new THREE.Vector3(0, 2.6, 5.5),
        lookAtOffset: new THREE.Vector3(0, 1.3, 0),
      });
    }
  }

  onExit(nextSceneId) {
    this._disposeCombat();
    this.combatHud?.hide();
    super.onExit(nextSceneId);
  }

  bindSystems(animationSystem, effectsManager) {
    super.bindSystems(animationSystem, effectsManager);
    this._animationSystem = animationSystem;
    this._effectsManager = effectsManager;

    if (!this._animationSystem?.mixerManager || this._loading) return;
    if (this.playerCombat) return;

    this._spawnCombatants();
    if (effectsManager?.applyPreset) {
      effectsManager.applyPreset();
    }
  }

  /**
   * @param {import('../combat/CombatHUD.js').CombatHUD} hud
   */
  setCombatHud(hud) {
    this.combatHud = hud;
  }

  async _spawnCombatants() {
    if (!this.inputSystem || !this.cameraController) return;
    this._loading = true;

    try {
      const { object, animations } = await modelManager.cloneModel(SAMPLE_ROBOT_GLB);
      object.name = 'combat_player';
      object.position.copy(this.spawnPoint);
      this.scene.add(object);

      const avatar = new AvatarController({
        object,
        animations,
        inputSystem: this.inputSystem,
        cameraController: this.cameraController,
        mixerManager: this._animationSystem.mixerManager,
        modelManager,
        animationSystem: this._animationSystem,
        groundY: 0,
        walkSpeed: 2.4,
        runSpeed: 4.8,
      });
      avatar.combatMode = true;
      this.setPlayer(avatar);

      const clipNames = animations.map((c) => c.name);
      this.playerCombat = CombatController.attach({
        host: avatar,
        id: 'player',
        scene: this.scene,
        particles: this.combatParticles,
        team: 'player',
        inputSystem: this.inputSystem,
        isAI: false,
        isAvatar: true,
        clipNames,
        onHudUpdate: (state) => this._updateCombatHud(state),
      });

      this.playerAura = AuraController.attach({
        host: avatar,
        scene: this.scene,
        combatController: this.playerCombat,
        clips: this.playerCombat.clips,
        effectsManager: this._effectsManager,
        combatParticles: this.combatParticles,
        inputSystem: this.inputSystem,
        cameraController: this.cameraController,
        enableChargeInput: true,
        onEvent: (e) => this._onAuraEvent(e),
      });

      this.npcManager = new NPCManager(
        this.scene,
        this._animationSystem.mixerManager,
        modelManager,
        this._animationSystem,
      );

      const enemyPositions = [
        new THREE.Vector3(5, 0, 2),
        new THREE.Vector3(-4, 0, 4),
        new THREE.Vector3(0, 0, 6),
      ];

      for (let i = 0; i < enemyPositions.length; i++) {
        const npc = await this.npcManager.spawnNPC(SAMPLE_ROBOT_GLB, enemyPositions[i], {
          id: `fighter_${i}`,
          initialState: 'idle',
          wanderRadius: 0,
        });

        const customizer = npc.getCustomizer();
        if (customizer) {
          customizer.setColor('body', [0xff6644, 0x44ff88, 0xaa66ff][i]);
        }

        const fighter = CombatController.attach({
          host: npc,
          id: npc.id,
          scene: this.scene,
          particles: this.combatParticles,
          team: 'enemy',
          isAI: true,
          isAvatar: false,
          clipNames,
        });
        fighter.setAITarget(this.playerCombat);
        this.combatants.push(fighter);
      }

      this.combatants.unshift(this.playerCombat);
      for (const c of this.combatants) {
        c.setOpponents(this.combatants);
      }

      this.playerCombat._emitHud();
      this.interactionSystem?.rebuildTargets();
    } catch (err) {
      console.warn('[CombatZoneScene] Spawn failed:', err);
    } finally {
      this._loading = false;
    }
  }

  /**
   * @param {object} state
   */
  _updateCombatHud(state) {
    this.combatHud?.update({
      ...state,
      chargeLevel: this.playerAura?.chargeLevel ?? 0,
      charging: this.playerAura?.isCharging ?? false,
      transformation: this.playerAura?.transformation ?? state.transformation,
    });
  }

  /**
   * @param {{ type: string }} event
   */
  _onAuraEvent(event) {
    if (event.type === 'onTransform' || event.type === 'transformStart') {
      this.playerAura?.pulseTransformReaction(
        this.combatants.filter((c) => c.isAI),
      );
    }
    if (event.type === 'onChargeStart' || event.type === 'chargeStart') {
      console.info('[Aura] Charge started — hold F, release to transform');
    }
    if (event.type === 'onChargeComplete' || event.type === 'chargeComplete') {
      console.info('[Aura] Charge complete!');
    }
    if (event.type === 'onAuraPulse') {
      // placeholder for audio hooks
    }
  }

  update(deltaTime) {
    super.update(deltaTime);

    this.playerAura?.update(deltaTime);

    for (const fighter of this.combatants) {
      fighter.update(deltaTime);
    }

    this.combatParticles?.update(deltaTime);
  }

  _disposeCombat() {
    this.playerAura?.dispose();
    this.playerAura = null;
    for (const fighter of [...this.combatants]) {
      fighter.dispose();
    }
    this.combatants = [];
    this.playerCombat = null;
    this.combatParticles?.dispose();
    this.combatParticles = null;
  }

  dispose() {
    this._disposeCombat();
    super.dispose();
  }
}
