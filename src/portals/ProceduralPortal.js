import { Portal } from './Portal.js';
import { getPortalThemeForDimension } from './portalThemes.js';
import { proceduralSceneIdFromSeed } from '../multiverse/proceduralSceneId.js';

/**
 * @typedef {import('./Portal.js').PortalOptions} PortalOptions
 */

/**
 * PR14.5 — procedural portal factory with dimension-themed visuals.
 */
export class ProceduralPortal {
  /**
   * @param {PortalOptions & {
   *   visualTheme?: string,
   *   isProcedural?: boolean,
   *   shaderVariant?: number,
   *   colorOuter?: number,
   * }} options
   * @returns {Portal}
   */
  static create(options) {
    const theme = getPortalThemeForDimension(options.visualTheme);
    const radius = (options.radius ?? 0.9) * theme.radiusScale;

    return new Portal({
      ...options,
      radius,
      frameStyle: options.frameStyle ?? theme.frameStyle,
      color: options.color ?? theme.color,
      colorOuter: options.colorOuter ?? theme.colorOuter,
      shaderVariant: options.shaderVariant ?? theme.shaderVariant,
      visualTheme: options.visualTheme,
      isProcedural: true,
    });
  }

  /**
   * @param {number} seed
   * @returns {string}
   */
  static sceneIdForSeed(seed) {
    return proceduralSceneIdFromSeed(seed);
  }
}
