/**
 * PR39 — fictional transformation modes and aura type presets.
 */

/** @typedef {'BaseGlow' | 'Overdrive' | 'Ascended' | 'Elemental'} AuraType */
/** @typedef {'OverdriveMode' | 'AscendedMode' | 'UltraMode'} TransformationMode */
/** @typedef {'fire' | 'lightning' | 'void' | 'ice'} ElementalVariant */

/**
 * @typedef {{
 *   id: TransformationMode,
 *   label: string,
 *   auraType: AuraType,
 *   elemental?: ElementalVariant,
 *   color: number,
 *   colorSecondary: number,
 *   damageMult: number,
 *   energyRegenMult: number,
 *   dashDistMult: number,
 *   knockbackMult: number,
 *   duration: number,
 *   unlockAbilities: string[],
 *   springBoost: number,
 * }} TransformationDef
 */

/** @type {Record<TransformationMode, TransformationDef>} */
export const TRANSFORMATION_MODES = {
  OverdriveMode: {
    id: 'OverdriveMode',
    label: 'Overdrive',
    auraType: 'Overdrive',
    color: 0x44ccff,
    colorSecondary: 0x2266ff,
    damageMult: 1.25,
    energyRegenMult: 1.6,
    dashDistMult: 1.35,
    knockbackMult: 1.15,
    duration: 18,
    unlockAbilities: [],
    springBoost: 1.2,
  },
  AscendedMode: {
    id: 'AscendedMode',
    label: 'Ascended',
    auraType: 'Ascended',
    color: 0xaa66ff,
    colorSecondary: 0xff88cc,
    damageMult: 1.5,
    energyRegenMult: 2,
    dashDistMult: 1.55,
    knockbackMult: 1.3,
    duration: 14,
    unlockAbilities: ['energyBurst'],
    springBoost: 1.45,
  },
  UltraMode: {
    id: 'UltraMode',
    label: 'Ultra',
    auraType: 'Ascended',
    elemental: 'lightning',
    color: 0xffee66,
    colorSecondary: 0xff4488,
    damageMult: 1.85,
    energyRegenMult: 2.5,
    dashDistMult: 1.8,
    knockbackMult: 1.5,
    duration: 10,
    unlockAbilities: ['energyBurst', 'aerialDash'],
    springBoost: 1.7,
  },
};

/**
 * @typedef {{
 *   intensity: number,
 *   pulseSpeed: number,
 *   particleRate: number,
 *   shellOpacity: number,
 *   defaultColor: number,
 * }} AuraTypeDef
 */

/** @type {Record<AuraType, AuraTypeDef>} */
export const AURA_TYPES = {
  BaseGlow: {
    intensity: 0.35,
    pulseSpeed: 1.2,
    particleRate: 6,
    shellOpacity: 0.18,
    defaultColor: 0x66aaff,
  },
  Overdrive: {
    intensity: 0.75,
    pulseSpeed: 2.4,
    particleRate: 14,
    shellOpacity: 0.28,
    defaultColor: 0x44ccff,
  },
  Ascended: {
    intensity: 1.1,
    pulseSpeed: 3,
    particleRate: 22,
    shellOpacity: 0.38,
    defaultColor: 0xaa66ff,
  },
  Elemental: {
    intensity: 0.9,
    pulseSpeed: 2.8,
    particleRate: 18,
    shellOpacity: 0.32,
    defaultColor: 0xff8844,
  },
};

/** @type {Record<ElementalVariant, { color: number, colorSecondary: number }>} */
export const ELEMENTAL_PALETTES = {
  fire: { color: 0xff6644, colorSecondary: 0xffaa22 },
  lightning: { color: 0xaaddff, colorSecondary: 0xffff88 },
  void: { color: 0x6644aa, colorSecondary: 0x110022 },
  ice: { color: 0x88eeff, colorSecondary: 0xccffff },
};

export const CHARGE_DURATION = 2.2;
export const CHARGE_THRESHOLD = 0.98;

/**
 * @param {TransformationMode} mode
 * @returns {TransformationDef}
 */
export function getTransformation(mode) {
  return TRANSFORMATION_MODES[mode] ?? TRANSFORMATION_MODES.OverdriveMode;
}

/**
 * @param {AuraType} type
 * @param {ElementalVariant} [element]
 * @returns {{ typeDef: AuraTypeDef, color: number, colorSecondary: number }}
 */
export function resolveAuraPalette(type, element) {
  const typeDef = AURA_TYPES[type] ?? AURA_TYPES.BaseGlow;
  if (type === 'Elemental' && element && ELEMENTAL_PALETTES[element]) {
    const pal = ELEMENTAL_PALETTES[element];
    return { typeDef, color: pal.color, colorSecondary: pal.colorSecondary };
  }
  return {
    typeDef,
    color: typeDef.defaultColor,
    colorSecondary: typeDef.defaultColor,
  };
}
