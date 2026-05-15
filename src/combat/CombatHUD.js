/**
 * PR38 — combat HUD: energy bar, combo counter, ability cooldowns.
 */
export class CombatHUD {
  /**
   * @param {HTMLElement | null} [container]
   */
  constructor(container = document.getElementById('app')) {
    this.container = container;

    this.root = document.createElement('div');
    this.root.className = 'combat-hud hidden';

    this.energyTrack = document.createElement('div');
    this.energyTrack.className = 'combat-energy-track';
    this.energyFill = document.createElement('div');
    this.energyFill.className = 'combat-energy-fill';
    this.energyTrack.appendChild(this.energyFill);

    this.comboEl = document.createElement('div');
    this.comboEl.className = 'combat-combo';
    this.comboEl.textContent = 'COMBO x0';

    this.abilitiesEl = document.createElement('div');
    this.abilitiesEl.className = 'combat-abilities';

    this.abilityQ = this._createAbilitySlot('Q', 'Energy Burst');
    this.abilityE = this._createAbilitySlot('E', 'Aerial Dash');

    this.abilitiesEl.append(this.abilityQ.root, this.abilityE.root);
    this.hintsEl = document.createElement('div');
    this.hintsEl.className = 'combat-hints';
    this.chargeTrack = document.createElement('div');
    this.chargeTrack.className = 'combat-charge-track hidden';
    this.chargeFill = document.createElement('div');
    this.chargeFill.className = 'combat-charge-fill';
    this.chargeTrack.appendChild(this.chargeFill);

    this.transformEl = document.createElement('div');
    this.transformEl.className = 'combat-transform-label hidden';

    this.hintsEl.innerHTML =
      'LMB Light · RMB Heavy · Space Dash · Q Burst · E Aerial Dash · Hold F Charge';

    this.root.append(
      this.energyTrack,
      this.chargeTrack,
      this.transformEl,
      this.comboEl,
      this.abilitiesEl,
      this.hintsEl,
    );
    this.container?.appendChild(this.root);
  }

  /**
   * @param {string} key
   * @param {string} label
   */
  _createAbilitySlot(key, label) {
    const root = document.createElement('div');
    root.className = 'combat-ability-slot';

    const keyEl = document.createElement('span');
    keyEl.className = 'combat-ability-key';
    keyEl.textContent = key;

    const nameEl = document.createElement('span');
    nameEl.className = 'combat-ability-name';
    nameEl.textContent = label;

    const cdEl = document.createElement('div');
    cdEl.className = 'combat-ability-cd';

    root.append(keyEl, nameEl, cdEl);
    return { root, cdEl };
  }

  show() {
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.classList.add('hidden');
  }

  /**
   * @param {{
   *   energy?: number,
   *   comboIndex?: number,
   *   comboTimer?: number,
   *   cooldowns?: { energyBurst?: number, aerialDash?: number },
   *   chargeLevel?: number,
   *   charging?: boolean,
   *   transformation?: string | null,
   * }} state
   */
  update(state) {
    const energy = state.energy ?? 0;
    this.energyFill.style.width = `${energy}%`;

    const charging = state.charging ?? false;
    const chargeLevel = state.chargeLevel ?? 0;
    if (charging) {
      this.chargeTrack.classList.remove('hidden');
      this.chargeFill.style.width = `${chargeLevel * 100}%`;
    } else {
      this.chargeTrack.classList.add('hidden');
    }

    const transform = state.transformation;
    if (transform) {
      this.transformEl.classList.remove('hidden');
      const label = transform.replace(/Mode$/, '').toUpperCase();
      this.transformEl.textContent = `${label} ACTIVE`;
    } else {
      this.transformEl.classList.add('hidden');
    }

    const combo = state.comboIndex ?? 0;
    const timer = state.comboTimer ?? 0;
    if (combo > 0 && timer > 0) {
      this.comboEl.textContent = `COMBO x${combo}`;
      this.comboEl.classList.add('active');
    } else {
      this.comboEl.textContent = 'COMBO x0';
      this.comboEl.classList.remove('active');
    }

    const cds = state.cooldowns ?? {};
    this._setCooldown(this.abilityQ.cdEl, cds.energyBurst ?? 0, 4);
    this._setCooldown(this.abilityE.cdEl, cds.aerialDash ?? 0, 2.5);
  }

  /**
   * @param {HTMLElement} el
   * @param {number} remaining
   * @param {number} total
   */
  _setCooldown(el, remaining, total) {
    if (remaining <= 0) {
      el.textContent = '';
      el.style.height = '0%';
      el.parentElement?.classList.remove('on-cooldown');
      return;
    }
    el.parentElement?.classList.add('on-cooldown');
    el.textContent = remaining.toFixed(1);
    el.style.height = `${(remaining / total) * 100}%`;
  }

  dispose() {
    this.root.remove();
  }
}
