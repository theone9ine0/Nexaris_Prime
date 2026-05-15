/**
 * Portal visual themes keyed by dimension template id (PR14.5).
 */

/** @typedef {'ring' | 'arch' | 'crystal' | 'void'} PortalFrameStyle */

/**
 * @typedef {{
 *   frameStyle: PortalFrameStyle,
 *   color: number,
 *   colorOuter: number,
 *   shaderVariant: number,
 *   radiusScale: number,
 * }} PortalThemeConfig
 */

/** @type {Record<string, PortalThemeConfig>} */
export const PORTAL_THEMES = {
  floatingIslands: {
    frameStyle: 'ring',
    color: 0xffd966,
    colorOuter: 0x87b8ff,
    shaderVariant: 0,
    radiusScale: 1,
  },
  crystalCavern: {
    frameStyle: 'crystal',
    color: 0xaa66ff,
    colorOuter: 0x44ccff,
    shaderVariant: 1,
    radiusScale: 1.05,
  },
  retroConsole: {
    frameStyle: 'arch',
    color: 0x00ff88,
    colorOuter: 0x2244aa,
    shaderVariant: 2,
    radiusScale: 0.95,
  },
  cyberGrid: {
    frameStyle: 'ring',
    color: 0x00e5ff,
    colorOuter: 0x0066ff,
    shaderVariant: 3,
    radiusScale: 1.1,
  },
  voidDimension: {
    frameStyle: 'void',
    color: 0x6688cc,
    colorOuter: 0x110022,
    shaderVariant: 4,
    radiusScale: 1,
  },
};

const DEFAULT_THEME = PORTAL_THEMES.floatingIslands;

/**
 * @param {string} [templateId]
 * @returns {PortalThemeConfig}
 */
export function getPortalThemeForDimension(templateId) {
  return PORTAL_THEMES[templateId] ?? DEFAULT_THEME;
}
