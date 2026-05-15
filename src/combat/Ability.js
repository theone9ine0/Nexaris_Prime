/**
 * Stylized ability definitions (fictional energy attacks).
 */

/** @typedef {'energyBurst' | 'aerialDash'} AbilityId */

/**
 * @typedef {{
 *   id: AbilityId,
 *   name: string,
 *   energyCost: number,
 *   cooldown: number,
 *   damage?: number,
 *   knockback?: number,
 *   radius?: number,
 *   dashDistance?: number,
 *   duration: number,
 *   hitWindow?: { start: number, end: number },
 * }} AbilityDef
 */

/** @type {Record<AbilityId, AbilityDef>} */
export const ABILITIES = {
  energyBurst: {
    id: 'energyBurst',
    name: 'Energy Burst',
    energyCost: 35,
    cooldown: 4,
    damage: 18,
    knockback: 6,
    radius: 3.2,
    duration: 0.55,
    hitWindow: { start: 0.25, end: 0.5 },
  },
  aerialDash: {
    id: 'aerialDash',
    name: 'Aerial Dash',
    energyCost: 25,
    cooldown: 2.5,
    damage: 6,
    knockback: 2,
    dashDistance: 5,
    duration: 0.32,
    hitWindow: { start: 0.1, end: 0.85 },
  },
};

/**
 * @param {string} name
 * @returns {AbilityDef | null}
 */
export function getAbility(name) {
  return ABILITIES[/** @type {AbilityId} */ (name)] ?? null;
}
