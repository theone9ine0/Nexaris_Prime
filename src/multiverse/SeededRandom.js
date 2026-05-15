/**
 * Deterministic PRNG (mulberry32) for procedural generation.
 */
export class SeededRandom {
  /**
   * @param {number} [seed]
   */
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this._state = this.seed;
  }

  /**
   * @returns {number} 0..1
   */
  next() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * @param {number} min
   * @param {number} max
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * @param {number} min
   * @param {number} max
   */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  /**
   * @param {unknown[]} array
   */
  pick(array) {
    return array[this.int(0, array.length - 1)];
  }

  /**
   * @param {number} n
   */
  shuffle(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = this.int(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
