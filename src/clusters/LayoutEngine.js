/**
 * Procedural shard placement: circle, spiral, grid (local offsets from origin).
 */
export class LayoutEngine {
  /**
   * @param {number} count
   * @param {{ x?: number, y?: number, z?: number }} [center]
   * @param {'circle' | 'spiral' | 'grid'} [mode]
   * @param {{ radius?: number, spacing?: number }} [options]
   * @returns {Array<{ x: number, y: number, z: number }>}
   */
  static compute(count, center = {}, mode = 'circle', options = {}) {
    const cx = center.x ?? 0;
    const cy = center.y ?? 0;
    const cz = center.z ?? 0;
    const radius = options.radius ?? 1.2;
    const spacing = options.spacing ?? 1.0;

    if (count <= 0) return [];

    switch (mode) {
      case 'spiral':
        return LayoutEngine._spiral(count, cx, cy, cz, radius);
      case 'grid':
        return LayoutEngine._grid(count, cx, cy, cz, spacing);
      case 'circle':
      default:
        return LayoutEngine._circle(count, cx, cy, cz, radius);
    }
  }

  static _circle(n, cx, cy, cz, radius) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push({
        x: cx + Math.cos(a) * radius,
        y: cy,
        z: cz + Math.sin(a) * radius,
      });
    }
    return out;
  }

  static _spiral(n, cx, cy, cz, radius) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 0 : i / (n - 1);
      const a = t * Math.PI * 4;
      const r = radius * (0.35 + t * 0.65);
      out.push({
        x: cx + Math.cos(a) * r,
        y: cy + t * 0.25,
        z: cz + Math.sin(a) * r,
      });
    }
    return out;
  }

  static _grid(n, cx, cy, cz, spacing) {
    const cols = Math.ceil(Math.sqrt(n));
    const out = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      out.push({
        x: cx + (col - (cols - 1) / 2) * spacing,
        y: cy,
        z: cz + row * spacing * 0.85,
      });
    }
    return out;
  }
}
