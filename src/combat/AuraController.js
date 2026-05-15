import * as THREE from 'three';
import {
  TRANSFORMATION_MODES,
  AURA_TYPES,
  CHARGE_DURATION,
  CHARGE_THRESHOLD,
  getTransformation,
  resolveAuraPalette,
} from './Transformations.js';
import { createAuraShellMaterial } from './particles/aura/AuraShader.js';
import { AuraParticles } from './particles/aura/AuraParticles.js';

const _color = new THREE.Color();
const _color2 = new THREE.Color();

/**
 * @typedef {import('./Transformations.js').AuraType} AuraType
 * @typedef {import('./Transformations.js').TransformationMode} TransformationMode
 * @typedef {import('./CombatController.js').CombatController} CombatController
 * @typedef {import('../vrm/VRMAvatar.js').VRMAvatar} VRMAvatar
 * @typedef {import('../core/AnimationStateMachine.js').AnimationStateMachine} AnimationStateMachine
 * @typedef {import('./particles/CombatParticles.js').CombatParticles} CombatParticles
 * @typedef {import('../effects/EffectsManager.js').EffectsManager} EffectsManager
 */

/**
 * @typedef {{
 *   object: THREE.Object3D,
 *   scene: THREE.Scene,
 *   stateMachine?: AnimationStateMachine | null,
 *   clips?: Record<string, string>,
 *   vrmAvatar?: VRMAvatar | null,
 *   combatController?: CombatController | null,
 *   effectsManager?: EffectsManager | null,
 *   combatParticles?: CombatParticles | null,
 *   inputSystem?: import('../core/InputSystem.js').InputSystem | null,
 *   cameraController?: import('../core/CameraController.js').CameraController | null,
 *   enableChargeInput?: boolean,
 *   onEvent?: (payload: { type: string, [key: string]: unknown }) => void,
 * }} AuraControllerOptions
 */

/**
 * PR39 — stylized aura, charge-up, and transformation power-up system.
 */
export class AuraController {
  /**
   * @param {AuraControllerOptions} options
   */
  constructor(options) {
    this.object = options.object;
    this.scene = options.scene;
    this.stateMachine = options.stateMachine ?? null;
    this.clips = options.clips ?? {};
    this.vrmAvatar = options.vrmAvatar ?? null;
    this.combatController = options.combatController ?? null;
    this.effectsManager = options.effectsManager ?? null;
    this.combatParticles = options.combatParticles ?? null;
    this.inputSystem = options.inputSystem ?? null;
    this.cameraController = options.cameraController ?? null;
    this.onEvent = options.onEvent ?? null;

    /** @type {AuraType | null} */
    this._auraType = null;
    this._auraColor = 0x66aaff;
    this._auraColorSecondary = 0xaa44ff;
    this._auraIntensity = 0;

    /** @type {TransformationMode | null} */
    this._transformation = null;
    this._transformTimer = 0;

    this._charging = false;
    this._chargeLevel = 0;
    this._chargePulse = 0;
    this._chargedReady = false;

    this._shell = null;
    this._shellMat = null;
    this._particles = null;
    this._glowEffectId = null;
    this._time = 0;

    if (options.enableChargeInput && this.inputSystem) {
      this._bindChargeInput();
    }
  }

  get isCharging() {
    return this._charging;
  }

  get chargeLevel() {
    return this._chargeLevel;
  }

  get transformation() {
    return this._transformation;
  }

  isCharged() {
    return this._chargedReady || this._chargeLevel >= CHARGE_THRESHOLD;
  }

  /**
   * @param {AuraType} type
   * @param {{ elemental?: string }} [options]
   */
  enableAura(type, options = {}) {
    const pal = resolveAuraPalette(type, options.elemental);
    this._auraType = type;
    this.setAuraColor(pal.color, pal.colorSecondary);
    this._ensureVisuals();
    this._auraIntensity = pal.typeDef.intensity;
    this._emit('auraEnable', { type });
    this._emit('onAuraPulse', { intensity: this._auraIntensity });
  }

  disableAura() {
    this._auraType = null;
    this._auraIntensity = 0;
    this._teardownVisuals();
    this._emit('auraDisable', {});
  }

  /**
   * @param {number} color
   * @param {number} [secondary]
   */
  setAuraColor(color, secondary) {
    this._auraColor = color;
    this._auraColorSecondary = secondary ?? color;
    if (this._shellMat) {
      this._shellMat.uniforms.uColor.value.setHex(color);
      this._shellMat.uniforms.uColorSecondary.value.setHex(this._auraColorSecondary);
    }
    this._particles?.setStyle(color, this._getParticleRate());
  }

  /**
   * @param {TransformationMode} mode
   * @returns {boolean}
   */
  startTransformation(mode) {
    const def = getTransformation(mode);
    if (!def) return false;

    this._transformation = mode;
    this._transformTimer = def.duration;
    this._chargedReady = false;
    this._chargeLevel = 0;

    this.enableAura(def.auraType, { elemental: def.elemental });
    this._auraIntensity = (AURA_TYPES[def.auraType]?.intensity ?? 0.8) * 1.15;
    this.setAuraColor(def.color, def.colorSecondary);

    this.combatController?.applyTransformationModifiers(def);

    this._applyVRMTransformation(def);
    this._playClip(this.clips.transform ?? this.clips.abilityCharge ?? this.clips.emote);

    const pos = this.object.position.clone();
    pos.y += 1;
    this.combatParticles?.spawnEnergyBurst(pos, 2.8, def.color);
    this.combatParticles?.spawnAuraFlare(pos, def.colorSecondary);

    this.cameraController?.addScreenShake?.(0.09);
    this._emit('onTransform', { mode, def });
    this._emit('transformStart', { mode });

    return true;
  }

  endTransformation() {
    if (!this._transformation) return;
    const mode = this._transformation;
    this._transformation = null;
    this._transformTimer = 0;
    this.combatController?.clearTransformationModifiers();
    this.combatController?._emitHud();
    this._restoreVRM();
    this.disableAura();
    this._emit('transformEnd', { mode });
  }

  startCharge() {
    if (this._transformation || this._charging) return;
    this._charging = true;
    this._chargeLevel = 0;
    this._chargedReady = false;
    this.enableAura('BaseGlow');
    this._playClip(this.clips.charge ?? this.clips.abilityCharge ?? this.clips.idle);
    this._emit('onChargeStart', {});
    this._emit('chargeStart', {});
  }

  cancelCharge() {
    if (!this._charging) return;
    this._charging = false;
    if (!this._transformation) {
      this.disableAura();
    }
    this._emit('chargeCancel', { level: this._chargeLevel });
  }

  /**
   * Release charge — triggers Overdrive if fully charged.
   * @param {TransformationMode} [mode]
   * @returns {boolean}
   */
  releaseCharge(mode = 'OverdriveMode') {
    if (!this._charging) return false;
    this._charging = false;

    if (this.isCharged()) {
      this._emit('onChargeComplete', { level: this._chargeLevel });
      this._emit('chargeComplete', {});
      return this.startTransformation(mode);
    }

    if (!this._transformation) {
      this.disableAura();
    }
    return false;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.05);
    this._time += dt;

    if (this._charging) {
      this._updateCharge(dt);
    }

    if (this._transformation) {
      this._transformTimer -= dt;
      if (this._transformTimer <= 0) {
        this.endTransformation();
      } else {
        this._pulseTransformation(dt);
      }
    }

    if (this._auraType) {
      this._updateVisuals(dt);
    }
  }

  /**
   * @param {number} dt
   */
  _updateCharge(dt) {
    this._chargeLevel = Math.min(1, this._chargeLevel + dt / CHARGE_DURATION);
    this._chargePulse += dt * 4;
    this._auraIntensity =
      (AURA_TYPES.BaseGlow?.intensity ?? 0.35) * (0.4 + this._chargeLevel * 1.4);

    if (this._shellMat) {
      this._shellMat.uniforms.uIntensity.value = this._auraIntensity;
      this._shellMat.uniforms.uPulse.value = this._chargePulse;
    }

    if (Math.random() < this._chargeLevel * 0.35) {
      const pos = this.object.position.clone();
      pos.y += 0.8 + Math.random() * 0.8;
      this.combatParticles?.spawnHitSpark(pos, this._auraColor);
    }

    const shake = this._chargeLevel * 0.025;
    if (shake > 0.01) {
      this.cameraController?.addScreenShake?.(shake);
    }

    if (this._chargeLevel >= CHARGE_THRESHOLD) {
      this._chargedReady = true;
      if (!this._auraType || this._auraType === 'BaseGlow') {
        this.enableAura('Overdrive');
      }
    }

    this._emit('chargePulse', { level: this._chargeLevel });
    this._emit('onAuraPulse', { intensity: this._auraIntensity, charging: true });
  }

  /**
   * @param {number} dt
   */
  _pulseTransformation(dt) {
    this._chargePulse += dt * 2.5;
    const def = getTransformation(this._transformation);
    const pulse = 0.85 + Math.sin(this._time * 5) * 0.15;
    this._auraIntensity = (AURA_TYPES[def.auraType]?.intensity ?? 0.8) * pulse;

    if (Math.random() < 0.08) {
      this._emit('onAuraPulse', { intensity: this._auraIntensity });
    }
  }

  _updateVisuals(dt) {
    if (this._shellMat) {
      this._shellMat.uniforms.uTime.value = this._time;
      this._shellMat.uniforms.uIntensity.value = this._auraIntensity;
      this._shellMat.uniforms.uPulse.value = this._chargePulse;
    }

    if (this._shell) {
      this._shell.position.copy(this.object.position);
      this._shell.rotation.y = this.object.rotation.y;
      const scale = 1 + Math.sin(this._time * 3) * 0.04 * this._auraIntensity;
      this._shell.scale.set(1.05 * scale, 1.15 * scale, 1.05 * scale);
    }

    this._particles?.update(this._auraIntensity, dt);
  }

  _ensureVisuals() {
    if (!this._shell) {
      _color.setHex(this._auraColor);
      _color2.setHex(this._auraColorSecondary);
      this._shellMat = createAuraShellMaterial({
        color: _color,
        colorSecondary: _color2,
      });
      this._shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 1.05, 2.1, 24, 1, true),
        this._shellMat,
      );
      this._shell.position.copy(this.object.position);
      this.scene.add(this._shell);
    }

    if (!this._particles) {
      this._particles = new AuraParticles(this.object, this.scene);
      this._particles.setStyle(this._auraColor, this._getParticleRate());
    }

    if (this.effectsManager && !this._glowEffectId) {
      this._glowEffectId = `aura_${this.object.uuid}`;
      this.effectsManager.applyObjectEffect(this._glowEffectId, this.object, {
        glow: true,
        bloom: true,
        pulseGlow: true,
        emissive: this._auraColor,
        emissiveIntensity: 0.45,
      });
    }
  }

  _teardownVisuals() {
    if (this._shell) {
      this._shell.removeFromParent();
      this._shell.geometry.dispose();
      this._shellMat?.dispose();
      this._shell = null;
      this._shellMat = null;
    }
    this._particles?.dispose();
    this._particles = null;

    if (this.effectsManager && this._glowEffectId) {
      this.effectsManager.removeObjectEffect?.(this._glowEffectId);
      this._glowEffectId = null;
    }
  }

  _getParticleRate() {
    if (!this._auraType) return 8;
    return AURA_TYPES[this._auraType]?.particleRate ?? 10;
  }

  /**
   * @param {import('./Transformations.js').TransformationDef} def
   */
  _applyVRMTransformation(def) {
    if (!this.vrmAvatar) return;
    this.vrmAvatar.applyTransformationBoost(def.springBoost);
    this.vrmAvatar.setTransformationExpressions({
      eyeGlow: 0.65,
      hairLift: 0.35,
      expression: 'surprised',
    });
  }

  _restoreVRM() {
    this.vrmAvatar?.clearTransformationBoost();
    this.vrmAvatar?.clearTransformationExpressions();
  }

  /**
   * @param {string} clip
   */
  _playClip(clip) {
    if (!clip || !this.stateMachine) return;
    this.stateMachine.triggerOneShot(clip, { returnTo: 'idle', fadeIn: 0.12 });
  }

  _bindChargeInput() {
    this._onKeyDown = ({ code }) => {
      if (code === 'KeyF' && !this._charging && !this._transformation) {
        this.startCharge();
      }
    };
    this._onKeyUp = ({ code }) => {
      if (code === 'KeyF' && this._charging) {
        this.releaseCharge('OverdriveMode');
      }
    };
    this.inputSystem.on('keyDown', this._onKeyDown);
    this.inputSystem.on('keyUp', this._onKeyUp);
  }

  _unbindChargeInput() {
    if (this._onKeyDown) this.inputSystem?.off('keyDown', this._onKeyDown);
    if (this._onKeyUp) this.inputSystem?.off('keyUp', this._onKeyUp);
    this._onKeyDown = null;
    this._onKeyUp = null;
  }

  /**
   * @param {string} type
   * @param {object} [data]
   */
  _emit(type, data = {}) {
    this.onEvent?.({ type, ...data });
  }

  /**
   * Notify nearby AI fighters to react (dodge / stagger).
   * @param {CombatController[]} opponents
   */
  pulseTransformReaction(opponents) {
    for (const foe of opponents) {
      if (!foe.isAI || foe.health <= 0) continue;
      foe._aiDodgeTimer = 3;
      foe._staggerTimer = Math.max(foe._staggerTimer, 0.2);
    }
  }

  dispose() {
    this.endTransformation();
    this.cancelCharge();
    this._unbindChargeInput();
    this._teardownVisuals();
  }

  /**
   * @param {object} params
   * @returns {AuraController}
   */
  static attach(params) {
    const { host, scene, combatController, ...rest } = params;
    const aura = new AuraController({
      object: host.object,
      scene,
      stateMachine: host.stateMachine,
      clips: params.clips ?? host._clips ?? combatController?.clips ?? {},
      vrmAvatar: host.getVRMAvatar?.() ?? host.vrmAvatar ?? null,
      combatController,
      ...rest,
    });
    host.auraController = aura;
    return aura;
  }
}
