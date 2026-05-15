import * as THREE from 'three';
import { Hitbox, registerCombatHurtbox } from './Hitbox.js';
import { getAbility } from './Ability.js';
import { resolveCombatClips } from './combatClips.js';

const _forward = new THREE.Vector3();
const _knockDir = new THREE.Vector3();
const COMBO_WINDOW = 0.65;

/**
 * @typedef {import('../avatars/AvatarController.js').AvatarController} AvatarController
 * @typedef {import('../npc/NPC.js').NPC} NPC
 * @typedef {import('../core/AnimationStateMachine.js').AnimationStateMachine} AnimationStateMachine
 * @typedef {import('../core/AnimationMixerManager.js').AnimationMixerManager} AnimationMixerManager
 * @typedef {import('./particles/CombatParticles.js').CombatParticles} CombatParticles
 * @typedef {import('./Ability.js').AbilityId} AbilityId
 */

/**
 * @typedef {{
 *   id: string,
 *   object: THREE.Object3D,
 *   mixerManager: AnimationMixerManager,
 *   stateMachine: AnimationStateMachine,
 *   clips: Record<string, string>,
 *   scene: THREE.Scene,
 *   particles?: CombatParticles | null,
 *   team?: 'player' | 'enemy',
 *   inputSystem?: import('../core/InputSystem.js').InputSystem | null,
 *   avatar?: AvatarController | null,
 *   npc?: NPC | null,
 *   isAI?: boolean,
 *   maxHealth?: number,
 *   onHudUpdate?: (state: object) => void,
 *   onDamage?: (payload: { target: CombatController, amount: number }) => void,
 * }} CombatControllerOptions
 */

/**
 * PR38 — stylized anime combat: combos, hitboxes, energy abilities.
 */
export class CombatController {
  /**
   * @param {CombatControllerOptions} options
   */
  constructor(options) {
    this.id = options.id;
    this.object = options.object;
    this.mixerManager = options.mixerManager;
    this.stateMachine = options.stateMachine;
    this.clips = options.clips;
    this.scene = options.scene;
    this.particles = options.particles ?? null;
    this.team = options.team ?? 'player';
    this.inputSystem = options.inputSystem ?? null;
    this.avatar = options.avatar ?? null;
    this.npc = options.npc ?? null;
    this.isAI = options.isAI ?? false;
    this.onHudUpdate = options.onHudUpdate ?? null;
    this.onDamage = options.onDamage ?? null;

    this.maxHealth = options.maxHealth ?? 100;
    this.health = this.maxHealth;
    this.energy = 100;
    this.energyRegen = 12;

    this.comboIndex = 0;
    this.comboTimer = 0;
    this._lastAttack = null;
    this._expectHeavyFinisher = false;

    /** @type {CombatController[]} */
    this.opponents = [];

    this._state = 'idle';
    this._attackElapsed = 0;
    this._attackDuration = 0;
    this._attackType = null;
    this._invulnTimer = 0;
    this._staggerTimer = 0;
    this._dashVelocity = new THREE.Vector3();
    this._cooldowns = { energyBurst: 0, aerialDash: 0 };

    this.hitbox = new Hitbox({
      owner: this.object,
      radius: 1.1,
      offset: new THREE.Vector3(0, 1, 0.7),
    });

    registerCombatHurtbox(this.object, { radius: 0.55, offsetY: 1 });

    /** @type {CombatController | null} */
    this._aiTarget = null;
    this._aiAttackCooldown = 0;
    this._aiThinkTimer = 0;
    this._aiDodgeTimer = 0;
    this.aggroRange = 14;
    this.attackRange = 2.4;

    if (!this.isAI && this.inputSystem) {
      this.bindInput();
    }
  }

  /**
   * @param {CombatController[]} fighters
   */
  setOpponents(fighters) {
    this.opponents = fighters.filter((f) => f !== this);
  }

  /**
   * @param {CombatController | null} target
   */
  setAITarget(target) {
    this._aiTarget = target;
  }

  get isBusy() {
    return this._state !== 'idle' && this._state !== 'stagger';
  }

  addEnergy(amount) {
    this.energy = Math.min(100, this.energy + amount);
    this._emitHud();
  }

  /**
   * @param {number} amount
   * @returns {boolean}
   */
  consumeEnergy(amount) {
    if (this.energy < amount) return false;
    this.energy -= amount;
    this._emitHud();
    return true;
  }

  attackLight() {
    if (this.isBusy || this._staggerTimer > 0) return false;
    if (this._tryComboFinisher()) return true;

    if (this.comboTimer > 0 && this._lastAttack === 'light' && this.comboIndex === 1) {
      this.comboIndex = 2;
      return this._startAttack('light', { damage: 10, duration: 0.32, knockback: 3 });
    }

    if (this.comboTimer > 0 && this.comboIndex === 2) {
      return this.attackHeavy();
    }

    this._registerComboInput('light');
    return this._startAttack('light', { damage: 8, duration: 0.28, knockback: 2.5 });
  }

  attackHeavy() {
    if (this.isBusy || this._staggerTimer > 0) return false;

    if (this._expectHeavyFinisher) {
      this._expectHeavyFinisher = false;
      this._resetCombo();
      return this._startAttack('heavy', { damage: 22, duration: 0.45, knockback: 5.5 });
    }

    if (this.comboTimer > 0 && this._lastAttack === 'heavy') {
      return this.useAbility('energyBurst');
    }

    this._registerComboInput('heavy');
    return this._startAttack('heavy', { damage: 14, duration: 0.38, knockback: 4 });
  }

  dashAttack() {
    if (this.isBusy || this._staggerTimer > 0) return false;

    if (this.comboTimer > 0 && this._lastAttack === 'light') {
      this._expectHeavyFinisher = true;
      this.comboIndex = 3;
    }

    this._registerComboInput('dash');
    return this._startDashAttack();
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  useAbility(name) {
    const def = getAbility(name);
    if (!def || this.isBusy || this._staggerTimer > 0) return false;
    if (this._cooldowns[def.id] > 0) return false;
    if (!this.consumeEnergy(def.energyCost)) return false;

    this._cooldowns[def.id] = def.cooldown;
    this._resetCombo();

    if (def.id === 'energyBurst') {
      return this._startAbilityBurst(def);
    }
    if (def.id === 'aerialDash') {
      return this._startAerialDash(def);
    }
    return false;
  }

  /**
   * @param {number} deltaTime
   */
  update(deltaTime) {
    const dt = Math.min(deltaTime, 0.05);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this._resetCombo();
      }
    }

    if (this._invulnTimer > 0) this._invulnTimer -= dt;
    if (this._staggerTimer > 0) {
      this._staggerTimer -= dt;
      if (this._staggerTimer <= 0) this._state = 'idle';
    }

    for (const key of Object.keys(this._cooldowns)) {
      if (this._cooldowns[key] > 0) {
        this._cooldowns[key] = Math.max(0, this._cooldowns[key] - dt);
      }
    }

    if (this.energy < 100 && this._state === 'idle') {
      this.energy = Math.min(100, this.energy + this.energyRegen * dt);
      this._emitHud();
    }

    if (this._state === 'attack' || this._state === 'ability') {
      this._updateAttack(dt);
    } else if (this._state === 'dash') {
      this._updateDash(dt);
    }

    if (this.isAI && this._state === 'idle') {
      this._updateAI(dt);
    }

    if (!this.isAI && this.inputSystem && this._state === 'idle') {
      this._readPlayerInputHeld();
    }
  }

  /** Bind edge-triggered combat inputs (player only). */
  bindInput() {
    if (!this.inputSystem || this.isAI) return;

    this._onMouseDown = ({ button }) => {
      if (button === 0) this.attackLight();
      if (button === 2) this.attackHeavy();
    };
    this._onKeyDown = ({ code }) => {
      if (code === 'Space') this.dashAttack();
      if (code === 'KeyQ') this.useAbility('energyBurst');
      if (code === 'KeyE') this.useAbility('aerialDash');
    };
    this.inputSystem.on('mouseDown', this._onMouseDown);
    this.inputSystem.on('keyDown', this._onKeyDown);
  }

  unbindInput() {
    if (this._onMouseDown && this.inputSystem) {
      this.inputSystem.off('mouseDown', this._onMouseDown);
    }
    if (this._onKeyDown && this.inputSystem) {
      this.inputSystem.off('keyDown', this._onKeyDown);
    }
    this._onMouseDown = null;
    this._onKeyDown = null;
  }

  _readPlayerInputHeld() {
    // Space held fallback if keyDown was eaten by browser UI
    if (this.inputSystem?.isKeyDown('Space')) {
      this._spaceHeld ??= false;
      if (!this._spaceHeld) {
        this._spaceHeld = true;
        this.dashAttack();
      }
    } else {
      this._spaceHeld = false;
    }
  }

  /**
   * @param {number} dt
   */
  _updateAI(dt) {
    const target = this._aiTarget;
    if (!target || target.health <= 0) return;

    this._aiThinkTimer -= dt;
    this._aiAttackCooldown -= dt;
    this._aiDodgeTimer -= dt;

    target.object.getWorldPosition(_forward);
    _forward.sub(this.object.position);
    _forward.y = 0;
    const dist = _forward.length();

    if (dist > this.aggroRange) return;

    if (dist > 0.2) {
      const yaw = Math.atan2(_forward.x, _forward.z);
      this.object.rotation.y = yaw;
    }

    if (this._aiDodgeTimer > 0 && dist < 3 && this._cooldowns.aerialDash <= 0) {
      this.useAbility('aerialDash');
      this._aiDodgeTimer = 0;
      return;
    }

    if (this._aiAttackCooldown <= 0 && dist < this.attackRange) {
      const roll = Math.random();
      if (roll < 0.55) this.attackLight();
      else if (roll < 0.85) this.attackHeavy();
      else if (this.energy >= 35 && this._cooldowns.energyBurst <= 0) {
        this.useAbility('energyBurst');
      } else {
        this.dashAttack();
      }
      this._aiAttackCooldown = 0.9 + Math.random() * 0.6;
      return;
    }

    if (this._aiThinkTimer <= 0) {
      this._aiThinkTimer = 0.4 + Math.random() * 0.5;
      if (dist > this.attackRange && dist < 8 && Math.random() < 0.35) {
        this.dashAttack();
      }
    }
  }

  /**
   * @param {number} dt
   */
  _updateAttack(dt) {
    this._attackElapsed += dt;

    const window = this._currentHitWindow;
    if (window) {
      this.hitbox.updateWindow(window, this._attackElapsed, this._attackDuration);
    } else {
      this.hitbox.active = this._attackElapsed > this._attackDuration * 0.2;
    }

    if (this.hitbox.active) {
      this._checkHits();
    }

    if (this._attackElapsed >= this._attackDuration) {
      this.hitbox.deactivate();
      this._state = 'idle';
      if (this.avatar) this.avatar.combatPaused = false;
      if (this.npc) this.npc.combatPaused = false;
    }
  }

  /**
   * @param {number} dt
   */
  _updateDash(dt) {
    this._attackElapsed += dt;
    this.object.position.addScaledVector(this._dashVelocity, dt);
    this.particles?.spawnDashTrail(this.object, 0.08);

    if (this._attackType === 'dashAttack') {
      this.hitbox.updateWindow(
        { start: 0.15, end: 0.85 },
        this._attackElapsed,
        this._attackDuration,
      );
      if (this.hitbox.active) this._checkHits();
    } else {
      this.hitbox.updateWindow(
        { start: 0.1, end: 0.9 },
        this._attackElapsed,
        this._attackDuration,
      );
      if (this.hitbox.active) this._checkHits();
    }

    if (this._attackElapsed >= this._attackDuration) {
      this.hitbox.deactivate();
      this._state = 'idle';
      this._dashVelocity.set(0, 0, 0);
      if (this.avatar) this.avatar.combatPaused = false;
      if (this.npc) this.npc.combatPaused = false;
    }
  }

  _checkHits() {
    for (const foe of this.opponents) {
      if (foe.health <= 0 || foe._invulnTimer > 0) continue;
      if (this.hitbox.hitTargets.has(foe.id)) continue;
      if (!this.hitbox.intersectsHurtbox(foe.object)) continue;

      this.hitbox.hitTargets.add(foe.id);
      foe.receiveHit(this, this.hitbox.damage, this.hitbox.knockback);
    }
  }

  /**
   * @param {CombatController} source
   * @param {number} damage
   * @param {number} knockback
   */
  receiveHit(source, damage, knockback) {
    if (this._invulnTimer > 0) return;

    this.health = Math.max(0, this.health - damage);
    this._invulnTimer = 0.35;
    this._staggerTimer = 0.35;
    this._state = 'stagger';

    source.object.getWorldPosition(_knockDir);
    _knockDir.sub(this.object.position);
    _knockDir.y = 0;
    if (_knockDir.lengthSq() < 1e-4) {
      _knockDir.set(0, 0, 1);
    }
    _knockDir.normalize().multiplyScalar(knockback * 0.12);
    this.object.position.add(_knockDir);

    const hitClip = this.clips.hitReact ?? this.clips.light;
    if (hitClip) {
      this.stateMachine.triggerOneShot(hitClip, { returnTo: 'idle', fadeIn: 0.06 });
    }

    this.object.getWorldPosition(_forward);
    this.particles?.spawnHitSpark(_forward.clone().add(new THREE.Vector3(0, 1.2, 0)));

    if (this.isAI) {
      this._aiDodgeTimer = 2.5;
    }

    this.onDamage?.({ target: this, amount: damage, source });
    this._emitHud();

    if (this.health <= 0) {
      this._onDefeated();
    }
  }

  _onDefeated() {
    this.hitbox.deactivate();
    this._state = 'idle';
    this.particles?.spawnAuraFlare(
      this.object.position.clone().add(new THREE.Vector3(0, 1, 0)),
      0x6688ff,
    );
  }

  /**
   * @param {'light' | 'heavy' | 'dash'} type
   */
  _registerComboInput(type) {
    this._lastAttack = type;
    this.comboTimer = COMBO_WINDOW;
    if (type === 'light' && this.comboIndex === 0) {
      this.comboIndex = 1;
    }
    this._emitHud();
  }

  _resetCombo() {
    this.comboIndex = 0;
    this.comboTimer = 0;
    this._lastAttack = null;
    this._expectHeavyFinisher = false;
    this._emitHud();
  }

  _tryComboFinisher() {
    if (this.comboTimer <= 0) return false;
    if (this.comboIndex === 2 && this._lastAttack === 'light') {
      this._resetCombo();
      return this._startAttack('heavy', { damage: 20, duration: 0.42, knockback: 5 });
    }
    return false;
  }

  /**
   * @param {'light' | 'heavy'} type
   * @param {{ damage: number, duration: number, knockback: number }} spec
   */
  _startAttack(type, spec) {
    this._state = 'attack';
    this._attackType = type;
    this._attackElapsed = 0;
    this._attackDuration = spec.duration;
    this.hitbox.damage = spec.damage;
    this.hitbox.knockback = spec.knockback;
    this._currentHitWindow = { start: 0.25, end: 0.7 };

    const clip = type === 'heavy' ? this.clips.heavy : this.clips.light;
    this._playCombatClip(clip);

    if (this.avatar) this.avatar.combatPaused = true;
    if (this.npc) this.npc.combatPaused = true;

    return true;
  }

  _startDashAttack() {
    this._state = 'dash';
    this._attackType = 'dashAttack';
    this._attackElapsed = 0;
    this._attackDuration = 0.35;
    this.hitbox.damage = 9;
    this.hitbox.knockback = 3;
    this._currentHitWindow = { start: 0.2, end: 0.75 };

    this.object.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    this._dashVelocity.copy(_forward).multiplyScalar(12);

    this._playCombatClip(this.clips.dash);
    this.particles?.spawnDashTrail(this.object);

    if (this.avatar) this.avatar.combatPaused = true;
    if (this.npc) this.npc.combatPaused = true;
    return true;
  }

  /**
   * @param {import('./Ability.js').AbilityDef} def
   */
  _startAbilityBurst(def) {
    this._state = 'ability';
    this._attackType = 'energyBurst';
    this._attackElapsed = 0;
    this._attackDuration = def.duration;
    this.hitbox.damage = def.damage ?? 18;
    this.hitbox.knockback = def.knockback ?? 6;
    this.hitbox.radius = def.radius ?? 3;
    this._currentHitWindow = def.hitWindow ?? { start: 0.25, end: 0.5 };

    this._playCombatClip(this.clips.abilityCharge ?? this.clips.heavy);

    const pos = this.object.position.clone();
    pos.y += 0.5;
    this.particles?.spawnEnergyBurst(pos, def.radius, 0x66ddff);

    if (this.avatar) this.avatar.combatPaused = true;
    if (this.npc) this.npc.combatPaused = true;
    return true;
  }

  /**
   * @param {import('./Ability.js').AbilityDef} def
   */
  _startAerialDash(def) {
    this._state = 'dash';
    this._attackType = 'aerialDash';
    this._attackElapsed = 0;
    this._attackDuration = def.duration;
    this.hitbox.damage = def.damage ?? 6;
    this.hitbox.knockback = def.knockback ?? 2;
    this._currentHitWindow = def.hitWindow ?? { start: 0.1, end: 0.85 };

    this.object.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    this._dashVelocity.copy(_forward).multiplyScalar((def.dashDistance ?? 5) / def.duration);

    this._playCombatClip(this.clips.dash);
    this.particles?.spawnDashTrail(this.object, def.duration);

    if (this.avatar) this.avatar.combatPaused = true;
    if (this.npc) this.npc.combatPaused = true;
    return true;
  }

  /**
   * @param {number} radius
   * @param {number} force
   */
  _applyRadialKnockback(radius, force) {
    for (const foe of this.opponents) {
      if (foe.health <= 0) continue;
      const dist = foe.object.position.distanceTo(this.object.position);
      if (dist > radius) continue;
      foe.receiveHit(this, this.hitbox.damage * 0.5, force * (1 - dist / radius));
    }
  }

  /**
   * @param {string} clip
   */
  _playCombatClip(clip) {
    if (!clip) return;
    this.stateMachine.triggerOneShot(clip, {
      returnTo: 'idle',
      fadeIn: 0.08,
    });
  }

  _emitHud() {
    this.onHudUpdate?.({
      id: this.id,
      health: this.health,
      maxHealth: this.maxHealth,
      energy: this.energy,
      comboIndex: this.comboIndex,
      comboTimer: this.comboTimer,
      cooldowns: { ...this._cooldowns },
    });
  }

  dispose() {
    this.unbindInput();
    this.hitbox.dispose();
    delete this.object.userData.combatHurtbox;
  }

  /**
   * Factory helper for avatar or NPC hosts.
   * @param {object} params
   * @returns {CombatController}
   */
  static attach(params) {
    const {
      host,
      id,
      scene,
      particles,
      team,
      inputSystem,
      isAI,
      clipNames,
      onHudUpdate,
      isAvatar,
    } = params;

    const clips = resolveCombatClips(host._clips ?? {}, clipNames ?? []);

    const controller = new CombatController({
      id: id ?? host.id,
      object: host.object,
      mixerManager: host.mixerManager,
      stateMachine: host.stateMachine,
      clips,
      scene,
      particles,
      team,
      inputSystem,
      avatar: isAvatar ? host : null,
      npc: isAvatar ? null : host,
      isAI,
      onHudUpdate,
    });

    if (isAvatar) {
      host.combatController = controller;
    }

    return controller;
  }
}
