/** @type {import('./index.js').DimensionTemplate} */
export const retroConsole = {
  id: 'retroConsole',
  name: 'Retro Console World',
  palette: {
    sky: 0x1a1a2e,
    ground: 0x16213e,
    accent: 0x00ff88,
    fog: 0x0f0f1a,
  },
  lighting: {
    ambient: 0x223344,
    ambientIntensity: 0.5,
    directional: 0x00ffaa,
    directionalIntensity: 0.7,
    directionalPosition: [0, 10, 5],
  },
  fog: { color: 0x0f0f1a, near: 10, far: 40 },
  terrain: 'grid',
  propTypes: ['console', 'crystal', 'rock'],
  propDensity: 0.35,
  shardAnimation: 'both',
  shardCount: [3, 7],
  npcCount: [1, 2],
  portalCount: [1, 3],
  effects: {
    bloom: { strength: 0.4, radius: 0.5, threshold: 0.2 },
    colorGrading: { saturation: 1.15, tint: 0x00aa66, tintStrength: 0.12, vignette: 0.2 },
  },
};
