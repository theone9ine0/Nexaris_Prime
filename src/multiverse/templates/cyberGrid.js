/** @type {import('./index.js').DimensionTemplate} */
export const cyberGrid = {
  id: 'cyberGrid',
  name: 'Cyber Grid',
  palette: {
    sky: 0x020818,
    ground: 0x061828,
    accent: 0x00e5ff,
    fog: 0x041020,
  },
  lighting: {
    ambient: 0x112244,
    ambientIntensity: 0.4,
    directional: 0x00ccff,
    directionalIntensity: 1,
    directionalPosition: [5, 14, -3],
  },
  fog: { color: 0x041020, near: 12, far: 50 },
  terrain: 'grid',
  propTypes: ['console', 'artifact', 'crystal'],
  propDensity: 0.28,
  shardAnimation: 'glow',
  shardCount: [5, 10],
  npcCount: [1, 3],
  portalCount: [2, 3],
  effects: {
    bloom: { strength: 0.5, radius: 0.55, threshold: 0.18 },
    colorGrading: { saturation: 1.25, tint: 0x00aacc, tintStrength: 0.15, vignette: 0.22 },
  },
};
