/**
 * Lightweight 2D value noise + FBM (fast, no dependencies).
 */

const PERM = new Uint8Array(512);

/**
 * @param {number} seed
 */
export function initNoise(seed) {
  const rng = (n) => {
    n = (n + seed) | 0;
    n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
    n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng(i) * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

/**
 * @param {number} x
 * @param {number} y
 */
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * @param {number} x
 * @param {number} y
 */
export function noise2D(x, y) {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = PERM[PERM[xi] + yi];
  const ab = PERM[PERM[xi] + yi + 1];
  const ba = PERM[PERM[xi + 1] + yi];
  const bb = PERM[PERM[xi + 1] + yi + 1];
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (h, px, py) => {
    const h4 = h & 3;
    const u = h4 < 2 ? px : py;
    const v = h4 < 2 ? py : px;
    return ((h4 & 1) === 0 ? u : -u) + ((h4 & 2) === 0 ? v : -v);
  };
  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  );
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} [octaves]
 */
export function fbm2D(x, y, octaves = 4) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2D(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
