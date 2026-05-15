/**
 * @typedef {{
 *   meshPatterns: string[],
 *   bonePatterns: string[],
 * }} AvatarSlotDef
 */

/** @typedef {keyof typeof AVATAR_SLOTS} AvatarSlotName */

/**
 * Customizable avatar slots and name-matching rules.
 */
export const AVATAR_SLOTS = {
  head: {
    meshPatterns: ['head', 'face', 'skull'],
    bonePatterns: ['head', 'neck'],
  },
  hair: {
    meshPatterns: ['hair', 'helmet'],
    bonePatterns: ['head'],
  },
  body: {
    meshPatterns: ['body', 'torso', 'chest', 'robot', 'mesh', 'skin'],
    bonePatterns: ['spine', 'chest', 'hips'],
  },
  outfit: {
    meshPatterns: ['outfit', 'cloth', 'armor', 'jacket', 'shirt'],
    bonePatterns: ['spine', 'chest'],
  },
  hands: {
    meshPatterns: ['hand', 'arm', 'wrist'],
    bonePatterns: ['hand', 'wrist'],
  },
  shoes: {
    meshPatterns: ['foot', 'shoe', 'boot', 'leg'],
    bonePatterns: ['foot', 'toe'],
  },
  accessory: {
    meshPatterns: ['accessory', 'hat', 'backpack'],
    bonePatterns: ['head', 'spine'],
  },
  weapon: {
    meshPatterns: ['weapon', 'sword', 'tool', 'gun'],
    bonePatterns: ['hand', 'wrist'],
  },
};

/**
 * @param {string} slot
 * @returns {AvatarSlotDef}
 */
export function getSlotDef(slot) {
  const def = AVATAR_SLOTS[/** @type {AvatarSlotName} */ (slot)];
  if (!def) {
    throw new Error(`Unknown avatar slot: ${slot}`);
  }
  return def;
}
