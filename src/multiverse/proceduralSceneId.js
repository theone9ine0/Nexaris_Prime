/**
 * Procedural multiverse scene id helpers (PR14.5).
 */

export const MAX_MULTIVERSE_DEPTH = 15;

/**
 * @param {number} seed
 * @returns {string}
 */
export function proceduralSceneIdFromSeed(seed) {
  return `multiverse_${seed >>> 0}`;
}

/**
 * @param {string} sceneId
 * @returns {boolean}
 */
export function isProceduralSceneId(sceneId) {
  return typeof sceneId === 'string' && sceneId.startsWith('multiverse_');
}

/**
 * @param {string} sceneId
 * @returns {number | null}
 */
export function seedFromProceduralSceneId(sceneId) {
  if (!isProceduralSceneId(sceneId)) return null;
  const match = sceneId.match(/^multiverse_(\d+)/);
  return match ? parseInt(match[1], 10) >>> 0 : null;
}

/**
 * @param {import('../scenes/SceneBase.js').SceneBase | null} scene
 * @returns {number}
 */
export function getMultiverseDepth(scene) {
  return scene?.scene?.userData?.multiverseDepth ?? 0;
}
