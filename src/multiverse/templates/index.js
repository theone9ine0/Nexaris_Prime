import { floatingIslands } from './floatingIslands.js';
import { crystalCavern } from './crystalCavern.js';
import { retroConsole } from './retroConsole.js';
import { cyberGrid } from './cyberGrid.js';
import { voidDimension } from './voidDimension.js';

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   palette: { sky: number, ground: number, accent: number, fog: number },
 *   lighting: {
 *     ambient: number,
 *     ambientIntensity: number,
 *     directional: number,
 *     directionalIntensity: number,
 *     directionalPosition: [number, number, number],
 *   },
 *   fog: { color: number, near: number, far: number },
 *   terrain: 'floating' | 'cavern' | 'grid' | 'void',
 *   propTypes: string[],
 *   propDensity: number,
 *   shardAnimation: string,
 *   shardCount: [number, number],
 *   npcCount: [number, number],
 *   portalCount: [number, number],
 *   effects: {
 *     bloom?: { strength: number, radius: number, threshold: number },
 *     colorGrading?: Record<string, number>,
 *   },
 * }} DimensionTemplate
 */

export const DIMENSION_TEMPLATES = [
  floatingIslands,
  crystalCavern,
  retroConsole,
  cyberGrid,
  voidDimension,
];

/**
 * @param {string} id
 * @returns {DimensionTemplate | undefined}
 */
export function getTemplateById(id) {
  return DIMENSION_TEMPLATES.find((t) => t.id === id);
}

export { floatingIslands, crystalCavern, retroConsole, cyberGrid, voidDimension };
